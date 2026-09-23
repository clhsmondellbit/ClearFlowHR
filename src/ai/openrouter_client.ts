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

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

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
  model: string;
  messages: OpenRouterMessage[];
  /** Max tokens to generate. Keep low for structured OCR responses. */
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable body)");
      throw new Error(
        `[AER] OpenRouter API error ${response.status}: ${body}`
      );
    }

    return (await response.json()) as OpenRouterResponse;
  } finally {
    clearTimeout(timer);
  }
}
