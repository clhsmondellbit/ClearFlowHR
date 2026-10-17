import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttachedDocument } from "../src/api/routes/schemas.js";
import {
  callOpenRouter,
  createOpenRouterModelRoute,
  OpenRouterRateLimitError,
  type OpenRouterRequest,
} from "../src/ai/openrouter_client.js";
import { synthesizeEscalationQuestion } from "../src/ai/escalation_synthesizer.js";
import { parseDocument } from "../src/ai/vlm_parser.js";

const environmentKeys = [
  "AI_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_RATE_LIMIT_COOLDOWN_MS",
  "NODE_ENV",
  "SYNTH_FALLBACK_MODELS",
  "SYNTH_MODEL",
  "VITEST",
  "VLM_MODEL",
  "VLM_FALLBACK_MODELS",
] as const;

const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]])
);

function restoreEnvironment(): void {
  for (const key of environmentKeys) {
    const originalValue = originalEnvironment.get(key);
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}

function makeRequest(model: string): OpenRouterRequest {
  return {
    model,
    messages: [{ role: "user", content: "test request" }],
  };
}

function makeDocument(): AttachedDocument {
  return {
    document_id: "a0000000-0000-4000-a000-000000000001",
    form_type: "C65-HD",
    content_ref: "data:image/png;base64,AA==",
    mime_type: "image/png",
  };
}

afterEach(() => {
  restoreEnvironment();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenRouter resilience", () => {
  it("builds a de-duplicated ordered model fallback route", () => {
    expect(
      createOpenRouterModelRoute(
        "primary-model",
        "fallback-one, primary-model, , fallback-two"
      )
    ).toEqual({
      models: ["primary-model", "fallback-one", "fallback-two"],
    });
  });

  it("uses Claude Opus 5.5 by default for escalation synthesis", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.AI_MODEL;
    delete process.env.SYNTH_MODEL;
    delete process.env.SYNTH_FALLBACK_MODELS;
    delete process.env.NODE_ENV;
    delete process.env.VITEST;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  "The annual leave request has an uncertain policy basis. Decision: [Approve as ANNUAL] or [Switch to UNPAID Leave] or [Reject]?",
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await synthesizeEscalationQuestion({
      employee_name: "Test Employee",
      leave_type: "ANNUAL",
      days_requested: 2,
      policy_basis: "test policy basis",
      uncertainty_category: "U2_POLICY",
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(init.body)) as {
      model?: string;
      reasoning?: unknown;
    };
    expect(requestBody.model).toBe("claude-opus-5-5");
    expect(requestBody.reasoning).toBeUndefined();
  });

  it("uses Claude Opus 5.5 with the ShopAIKey endpoint by default for VLM", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.OPENROUTER_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.VLM_MODEL;
    delete process.env.VLM_FALLBACK_MODELS;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  '{"red_stamp_detected":true,"signature_detected":true,"confidence_score":0.9,"extracted_issue_date":null,"extracted_issuing_authority":null}',
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseDocument(makeDocument());

    expect(result).toMatchObject({ success: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.shopaikey.com/v1/chat/completions"
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(init.body)) as {
      model?: string;
      reasoning?: unknown;
    };
    expect(requestBody.model).toBe("claude-opus-5-5");
    expect(requestBody.reasoning).toBeUndefined();
  });

  it("redacts rate-limit response bodies and skips repeated calls during cooldown", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Provider returned error" },
          user_id: "user_should_never_reach_logs",
        }),
        {
          status: 429,
          headers: { "retry-after": "10" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await callOpenRouter(makeRequest("rate-limited-model"));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OpenRouterRateLimitError);
    expect(caught).toMatchObject({ status: 429, retryAfterMs: 10_000 });
    expect(caught instanceof Error ? caught.message : "").not.toContain(
      "user_should_never_reach_logs"
    );

    await expect(
      callOpenRouter(makeRequest("rate-limited-model"))
    ).rejects.toBeInstanceOf(OpenRouterRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends configured VLM model fallbacks to OpenRouter", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.VLM_MODEL = "vlm-primary";
    process.env.VLM_FALLBACK_MODELS =
      "vlm-fallback-one, vlm-primary, vlm-fallback-two";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  '{"red_stamp_detected":true,"signature_detected":true,"confidence_score":0.9,"extracted_issue_date":null,"extracted_issuing_authority":null}',
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseDocument(makeDocument());

    expect(result).toMatchObject({ success: true });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(init.body)) as {
      models?: string[];
      model?: string;
    };
    expect(requestBody.models).toEqual([
      "vlm-primary",
      "vlm-fallback-one",
      "vlm-fallback-two",
    ]);
    expect(requestBody.model).toBeUndefined();
  });

  it("maps a VLM 429 to a safe U1_DATA-compatible failure without logging provider metadata", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.VLM_MODEL = "vlm-rate-limit-model";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Provider returned error" },
          user_id: "user_should_never_reach_logs",
        }),
        { status: 429 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await parseDocument(makeDocument());

    expect(result).toEqual({
      success: false,
      failure_reason: "MODEL_UNAVAILABLE",
      document_id: "a0000000-0000-4000-a000-000000000001",
    });
    const logOutput = logSpy.mock.calls.flat().join(" ");
    expect(logOutput).toContain("HTTP 429");
    expect(logOutput).not.toContain("user_should_never_reach_logs");
    expect(logOutput).not.toContain("Provider returned error");
  });
});
