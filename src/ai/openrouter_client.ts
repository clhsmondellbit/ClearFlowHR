/**
 * @file openrouter_client.ts
 * @description Shared ShopAIKey client using Anthropic's Messages API.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - This client is used ONLY for:
 *       1. Structural OCR of C65-HD forms (vlm_parser.ts) — stamp/signature detection.
 *       2. Natural language synthesis of HITL escalation questions (escalation_synthesizer.ts).
 *   - MUST NOT be used for leave balance calculations, policy decisions, or date imputation.
 *   - All LLM outputs in vlm_parser.ts are structural JSON parsed deterministically.
 *   - All LLM outputs in escalation_synthesizer.ts are language-only rewrites of a pre-decided question.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return (
    process.env["ANTHROPIC_BASE_URL"] ||
    process.env["OPENROUTER_BASE_URL"] ||
    "https://api.shopaikey.com"
  )
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
}

/**
 * Reads the API key from the environment.
 * Returns null if not configured — callers must handle the missing-key case
 * by falling back to deterministic stubs (fail-safe, not fail-open).
 */
export function getApiKey(): string | null {
  if (
    !process.env["ANTHROPIC_API_KEY"]?.trim() &&
    !process.env["OPENROUTER_API_KEY"]?.trim()
  ) {
    try {
      process.loadEnvFile();
    } catch {
      // .env is optional
    }
  }
  return (
    process.env["ANTHROPIC_API_KEY"]?.trim() ||
    process.env["OPENROUTER_API_KEY"]?.trim() ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface OpenRouterRequest {
  /** A single model. Use models to try ordered model fallbacks. */
  model?: string;
  /** Ordered model IDs. Later models are tried when an earlier one is unavailable or rate-limited. */
  models?: string[];
  messages: OpenRouterMessage[];
  /** Max tokens to generate. Keep low for structured OCR responses. */
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterResponse {
  choices: Array<{
    finish_reason?: string | null;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

const AnthropicImageSourceSchema = z.union([
  z.object({
    type: z.literal("base64"),
    media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    data: z.string().min(1),
  }),
  z.object({ type: z.literal("url"), url: z.string().url() }),
]);

const AnthropicContentBlockSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), source: AnthropicImageSourceSchema }),
]);

const AnthropicRequestSchema = z.object({
  model: z.string().min(1),
  max_tokens: z.number().int().positive(),
  system: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.array(AnthropicContentBlockSchema).min(1),
  })).min(1),
  temperature: z.number().min(0).max(1).optional(),
});

const AnthropicResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
  }).passthrough()),
  stop_reason: z.string().nullable().optional(),
  usage: z.object({ output_tokens: z.number().nonnegative().optional() }).passthrough().optional(),
}).passthrough();

type AnthropicRequest = z.infer<typeof AnthropicRequestSchema>;

/**
 * A sanitized AI provider HTTP failure. Provider response bodies are deliberately
 * excluded because they can contain account identifiers or request metadata.
 */
export class OpenRouterHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("[AER] AI provider request failed (HTTP " + status + ").");
    this.name = "OpenRouterHttpError";
    this.status = status;
  }
}

/** A retryable 429 response with a bounded local cooldown. */
export class OpenRouterRateLimitError extends OpenRouterHttpError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(429);
    this.name = "OpenRouterRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.message =
      "[AER] AI provider request rate limited (HTTP 429). Retry after " +
      Math.ceil(retryAfterMs / 1_000) +
      "s.";
  }
}

const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 300_000;
const rateLimitUntilByModel = new Map<string, number>();

function getRequestModels(payload: OpenRouterRequest): string[] {
  const candidates = payload.models
    ?.map((model) => model.trim())
    .filter((model) => model.length > 0);

  if (candidates && candidates.length > 0) return candidates;
  if (payload.model?.trim()) return [payload.model.trim()];

  throw new Error("[AER] AI request requires a model or models.");
}

function getConfiguredRateLimitCooldownMs(): number {
  const configured = Number(process.env["OPENROUTER_RATE_LIMIT_COOLDOWN_MS"]);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, MAX_RATE_LIMIT_COOLDOWN_MS)
    : DEFAULT_RATE_LIMIT_COOLDOWN_MS;
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1_000), MAX_RATE_LIMIT_COOLDOWN_MS);
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isNaN(retryAt)) return null;
  return Math.min(
    Math.max(0, retryAt - Date.now()),
    MAX_RATE_LIMIT_COOLDOWN_MS
  );
}

function getActiveRateLimitCooldownMs(models: string[]): number {
  const now = Date.now();
  const latestBlockedUntil = Math.max(
    0,
    ...models.map((model) => rateLimitUntilByModel.get(model) ?? 0)
  );
  return Math.max(0, latestBlockedUntil - now);
}

function rememberRateLimit(models: string[], cooldownMs: number): void {
  const blockedUntil = Date.now() + cooldownMs;
  for (const model of models) {
    const existingBlockedUntil = rateLimitUntilByModel.get(model) ?? 0;
    rateLimitUntilByModel.set(model, Math.max(existingBlockedUntil, blockedUntil));
  }
}

/**
 * Builds a model route from a primary model and optional comma-separated
 * fallbacks. Anthropic Messages accepts one model per request, so the client
 * tries these models sequentially when a model is unavailable or rate-limited.
 */
export function createOpenRouterModelRoute(
  primaryModel: string,
  fallbackModelsValue: string | undefined
): Pick<OpenRouterRequest, "model" | "models"> {
  const models = Array.from(
    new Set(
      [primaryModel, ...(fallbackModelsValue?.split(",") ?? [])]
        .map((model) => model.trim())
        .filter((model) => model.length > 0)
    )
  );

  if (models.length === 0) {
    throw new Error("[AER] At least one AI model must be configured.");
  }

  return models.length === 1 ? { model: models[0] } : { models };
}

/** Returns a safe operational summary that is suitable for application logs. */
export function getOpenRouterFailureSummary(error: unknown): string {
  if (error instanceof OpenRouterRateLimitError) {
    return (
      "rate limited (HTTP 429; retry in " +
      Math.ceil(error.retryAfterMs / 1_000) +
      "s)"
    );
  }
  if (error instanceof OpenRouterHttpError) {
    return "upstream request failed (HTTP " + error.status + ")";
  }
  if (isOpenRouterTimeout(error)) return "request timed out";
  return "network request failed";
}

/** Detects aborts without exposing the underlying error message in logs. */
export function isOpenRouterTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.includes("aborted") ||
      error.message.includes("abort"))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls ShopAIKey's Anthropic Messages endpoint. The legacy OpenRouter types
 * remain as the internal call contract to avoid coupling callers to a provider.
 *
 * @param payload   - Internal chat-style request, translated to Anthropic format.
 * @param timeoutMs - Abort timeout in milliseconds (default: 5000ms per AGENTS.md §5).
 * @returns The Anthropic text response normalized to the existing internal shape.
 * @throws  If the network request fails, times out, or the API returns a non-2xx status.
 *          Error messages never include the provider response body.
 */
export async function callOpenRouter(
  payload: OpenRouterRequest,
  timeoutMs = 5_000
): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "[AER] No Anthropic API key is configured. Cannot call ShopAIKey."
    );
  }

  const configuredModels = getRequestModels(payload);
  const models = configuredModels.filter(
    (model) => getActiveRateLimitCooldownMs([model]) === 0
  );
  if (models.length === 0) {
    const activeCooldownMs = getActiveRateLimitCooldownMs(configuredModels);
    throw new OpenRouterRateLimitError(activeCooldownMs);
  }

  let lastError: unknown;
  for (const model of models) {
    const requestPayload = toAnthropicRequest(payload, model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${getBaseUrl()}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const cooldownMs =
            parseRetryAfterMs(response.headers.get("retry-after")) ??
            getConfiguredRateLimitCooldownMs();
          rememberRateLimit([model], cooldownMs);
          lastError = new OpenRouterRateLimitError(cooldownMs);
        } else {
          lastError = new OpenRouterHttpError(response.status);
        }

        if ([400, 401, 403, 408, 413, 415, 422].includes(response.status)) {
          throw lastError;
        }
        continue;
      }

      const parsedResponse = AnthropicResponseSchema.safeParse(await response.json());
      if (!parsedResponse.success) {
        throw new OpenRouterHttpError(502);
      }

      const body = parsedResponse.data;
      const text = body.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      return {
        choices: [{
          finish_reason: body.stop_reason ?? "unknown",
          message: { role: "assistant", content: text },
        }],
        usage: body.usage?.output_tokens === undefined
          ? undefined
          : { completion_tokens: body.usage.output_tokens },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new OpenRouterHttpError(503);
}

function toAnthropicRequest(payload: OpenRouterRequest, model: string): AnthropicRequest {
  const systemParts: string[] = [];
  const messages = payload.messages.flatMap((message) => {
    if (message.role === "system") {
      const text = typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join("\n");
      if (text.trim()) systemParts.push(text);
      return [];
    }

    const content = typeof message.content === "string"
      ? [{ type: "text" as const, text: message.content }]
      : message.content.map((part) => {
          if (part.type === "text") {
            return { type: "text" as const, text: part.text ?? "" };
          }
          if (part.type === "image_url" && part.image_url?.url) {
            return { type: "image" as const, source: toAnthropicImageSource(part.image_url.url) };
          }
          throw new Error("[AER] Unsupported AI content block.");
        });

    return [{ role: message.role, content }];
  });

  const candidate = {
    model,
    max_tokens: payload.max_tokens ?? 1024,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    messages,
    ...(payload.temperature === undefined ? {} : { temperature: payload.temperature }),
  };
  const parsed = AnthropicRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error("[AER] AI request payload failed validation.");
  }
  return parsed.data;
}

function toAnthropicImageSource(url: string) {
  const dataUri = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(url);
  if (dataUri) {
    return {
      type: "base64" as const,
      media_type: dataUri[1]!.toLowerCase() as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: dataUri[2]!,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("[AER] AI image must be an HTTPS URL or an image Base64 data URI.");
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error("[AER] AI image URL must use HTTPS.");
  }
  return { type: "url" as const, url: parsedUrl.toString() };
}
