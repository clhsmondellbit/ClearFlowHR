/**
 * @file openrouter_client.ts
 * @description Shared HTTP client for the OpenRouter API.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - This client is used ONLY for:
 *       1. Structural OCR of C65-HD forms (vlm_parser.ts) — stamp/signature detection.
 *       2. Natural language synthesis of HITL escalation questions (escalation_synthesizer.ts).
 *   - MUST NOT be used for leave balance calculations, policy decisions, or date imputation.
 *   - All LLM outputs in vlm_parser.ts are structural JSON parsed deterministically.
 *   - All LLM outputs in escalation_synthesizer.ts are language-only rewrites of a pre-decided question.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return (process.env["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1")
    .replace(/\/+$/, "");
}

/**
 * Reads the API key from the environment.
 * Returns null if not configured — callers must handle the missing-key case
 * by falling back to deterministic stubs (fail-safe, not fail-open).
 */
export function getApiKey(): string | null {
  if (!process.env["OPENROUTER_API_KEY"]) {
    try {
      process.loadEnvFile();
    } catch {
      // .env is optional
    }
  }
  return process.env["OPENROUTER_API_KEY"] ?? null;
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
  /** A single model. Use models when OpenRouter should try ordered model fallbacks. */
  model?: string;
  /** Ordered model IDs. OpenRouter tries later models when an earlier one is unavailable or rate-limited. */
  models?: string[];
  messages: OpenRouterMessage[];
  /** Max tokens to generate. Keep low for structured OCR responses. */
  max_tokens?: number;
  temperature?: number;
  /** Disable hidden reasoning when a short, direct structured response is required. */
  reasoning?: { enabled?: boolean };
  /** Request a JSON object for model outputs that must be parsed as JSON. */
  response_format?: { type: "json_object" };
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

/**
 * A sanitized OpenRouter HTTP failure. Provider response bodies are deliberately
 * excluded because they can contain account identifiers or request metadata.
 */
export class OpenRouterHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("[AER] OpenRouter request failed (HTTP " + status + ").");
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
      "[AER] OpenRouter request rate limited (HTTP 429). Retry after " +
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

  throw new Error("[AER] OpenRouter request requires a model or models.");
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
 * Builds a valid OpenRouter model route from a primary model and optional
 * comma-separated fallbacks. Duplicates and blank values are ignored.
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
    throw new Error("[AER] At least one OpenRouter model must be configured.");
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
 * Calls the OpenRouter chat completions endpoint.
 *
 * @param payload   - The chat completion request body.
 * @param timeoutMs - Abort timeout in milliseconds (default: 5000ms per AGENTS.md §5).
 * @returns The parsed OpenRouterResponse.
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
      "[AER] OPENROUTER_API_KEY is not set. Cannot call OpenRouter API."
    );
  }

  const models = getRequestModels(payload);
  const activeCooldownMs = getActiveRateLimitCooldownMs(models);
  if (activeCooldownMs > 0) {
    throw new OpenRouterRateLimitError(activeCooldownMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const cooldownMs =
          parseRetryAfterMs(response.headers.get("retry-after")) ??
          getConfiguredRateLimitCooldownMs();
        rememberRateLimit(models, cooldownMs);
        throw new OpenRouterRateLimitError(cooldownMs);
      }
      throw new OpenRouterHttpError(response.status);
    }

    return (await response.json()) as OpenRouterResponse;
  } finally {
    clearTimeout(timer);
  }
}
