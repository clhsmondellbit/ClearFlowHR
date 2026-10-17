/**
 * @file vlm_parser.ts
 * @description Vision-Language Model (VLM) integration for C65-HD form analysis via ShopAIKey.
 *
 * Model: Uses the configured Anthropic vision-capable model for OCR.
 * Falls back gracefully when the API key is absent or the call fails.
 *
 * Responsibilities:
 *   - Detect red official stamps on C65-HD medical/legal forms.
 *   - Verify presence of authorized signatures.
 *   - Extract form metadata (issue date, issuing authority) for downstream rules validation.
 *
 * SAFETY BOUNDARY (AGENTS.md §2 & §5 Failure Handling):
 *   - VLM output is STRUCTURAL ONLY (stamp present/absent, signature present/absent).
 *   - VLM MUST NOT be used to interpret policy, calculate dates, or verify labor law compliance.
 *   - On VLM timeout or image quality failure → workflow transitions to ESCALATE with U1_DATA.
 *   - Missing dates from blurry images MUST NOT be imputed by LLM.
 *   - The model response is parsed as structured JSON; free-text reasoning is discarded.
 */

import { z } from "zod";
import type { AttachedDocument } from "../api/routes/schemas.js";
import {
  callOpenRouter,
  createOpenRouterModelRoute,
  getApiKey,
  getOpenRouterFailureSummary,
  isOpenRouterTimeout,
} from "./openrouter_client.js";

// ─────────────────────────────────────────────────────────────────────────────
// VLM Analysis Result Types
// ─────────────────────────────────────────────────────────────────────────────

/** The structured output of a successful VLM analysis pass on a single document. */
export interface VlmAnalysisResult {
  document_id: string;
  /** True if a red official stamp was detected with sufficient confidence. */
  red_stamp_detected: boolean;
  /** True if a handwritten or printed authorized signature was detected. */
  signature_detected: boolean;
  /** VLM confidence score [0.0 – 1.0]. Below 0.70 triggers U1_DATA escalation. */
  confidence_score: number;
  /** Extracted issue date in YYYY-MM-DD format, or null if unreadable. */
  extracted_issue_date: string | null;
  /** Extracted issuing authority name, or null if unreadable. */
  extracted_issuing_authority: string | null;
}

/** Outcome of calling parseDocument — discriminated union for safe error handling. */
export type VlmParseOutcome =
  | { success: true; result: VlmAnalysisResult }
  | {
      success: false;
      /** Reason for failure — triggers U1_DATA escalation in the rules engine. */
      failure_reason: "TIMEOUT" | "IMAGE_QUALITY_TOO_LOW" | "MODEL_UNAVAILABLE" | "UNSUPPORTED_FORMAT";
      document_id: string;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum acceptable confidence score for a VLM result to be trusted. */
const CONFIDENCE_THRESHOLD = 0.70;
const DEFAULT_VLM_TIMEOUT_MS = 30_000;
const MAX_VLM_TIMEOUT_MS = 60_000;

const VlmModelOutputSchema = z.object({
  red_stamp_detected: z.boolean(),
  signature_detected: z.boolean(),
  confidence_score: z.number().min(0).max(1),
  extracted_issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  extracted_issuing_authority: z.string().nullable(),
});

function getVlmTimeoutMs(): number {
  const configuredTimeout = Number(process.env["VLM_TIMEOUT_MS"]);
  return Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0
    ? Math.min(configuredTimeout, MAX_VLM_TIMEOUT_MS)
    : DEFAULT_VLM_TIMEOUT_MS;
}

function getVlmModel(): string {
  return process.env["VLM_MODEL"] ?? process.env["AI_MODEL"] ?? "claude-opus-5-5";
}

function getVlmModelRoute() {
  return createOpenRouterModelRoute(
    getVlmModel(),
    process.env["VLM_FALLBACK_MODELS"]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — structural extraction only, no policy reasoning
// ─────────────────────────────────────────────────────────────────────────────

const VLM_SYSTEM_PROMPT = `\
You analyze images of Vietnamese HR medical evidence, especially C65-HD forms.
Use only what is visibly present in the image. Inspect the whole page, including edges,
overlapping marks, and partially faded areas. Your ONLY job is visual extraction.
You MUST NOT interpret policy, calculate leave entitlements, or make decisions.

RED STAMP DETECTION (Vietnamese: dấu mộc đỏ / dấu đóng đỏ):
- Set red_stamp_detected to true only when visible red ink has a stamp/seal-like
  structure. Consider shape, borders, internal text or emblem, ink texture, and placement
  together. Vietnamese clinic or hospital stamps are often circular, but stamps may also
  be oval or rectangular, faint, rotated, partly cropped, or overlapped by handwriting.
- Do not require every stamp feature to be visible. A partial mark is a stamp when the
  visible structure is still distinctive enough to identify it as one.
- Red color alone is not evidence of a stamp. Do not count typed red text, highlights,
  underlines, logos, letterheads, check marks, handwriting, or decorative graphics.
- If a red mark could be either a stamp or an unrelated mark, set red_stamp_detected to
  false and lower confidence_score below 0.70 when the ambiguity prevents verification.
- A clear page with no stamp may have high confidence. confidence_score measures how
  clearly the image supports the visual assessment; it is not the probability that a stamp
  exists. Use a score below 0.70 when blur, glare, low resolution, cropping, or occlusion
  makes the stamp's presence or absence uncertain.

OTHER EXTRACTION:
- Set signature_detected to true only for a visible handwritten or ink signature, not a
  printed or typed person's name. A signature can overlap a stamp; assess each separately.
- Extract the issue date only when its digits are legible. Return it as YYYY-MM-DD; if any
  part is unreadable or ambiguous, return null. Never infer or complete missing digits.
- Extract the issuing authority only from legible text naming it. Otherwise return null.

Respond ONLY with a valid JSON object using this exact schema (no markdown, no prose):
{
  "red_stamp_detected": boolean,
  "signature_detected": boolean,
  "confidence_score": number (0.0 to 1.0, based on visual assessability),
  "extracted_issue_date": "YYYY-MM-DD" | null,
  "extracted_issuing_authority": string | null
}`;

// ─────────────────────────────────────────────────────────────────────────────
// VLM Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an attached document using the Anthropic Messages vision API.
 *
 * Per AGENTS.md §5 Failure Handling:
 *   - If the API key is absent → returns MODEL_UNAVAILABLE (triggers U1_DATA escalation).
 *   - If the request times out → returns TIMEOUT.
 *   - If the image confidence is below threshold → returns IMAGE_QUALITY_TOO_LOW.
 *   - If the MIME type is unsupported → returns UNSUPPORTED_FORMAT.
 *   - All failures MUST cause the calling workflow to ESCALATE with U1_DATA.
 *
 * @param document - The attached document to analyze.
 * @returns A VlmParseOutcome discriminated union.
 */
export async function parseDocument(
  document: AttachedDocument
): Promise<VlmParseOutcome> {
  // Guard: unsupported format (PDFs are not converted to image blocks here)
  if (document.mime_type === "application/pdf") {
    return {
      success: false,
      failure_reason: "UNSUPPORTED_FORMAT",
      document_id: document.document_id,
    };
  }

  // Guard: no API key configured → safe failure
  if (!getApiKey()) {
    console.warn(
      `[AER/vlm_parser] Anthropic API key not set — escalating document ${document.document_id} as MODEL_UNAVAILABLE`
    );
    return {
      success: false,
      failure_reason: "MODEL_UNAVAILABLE",
      document_id: document.document_id,
    };
  }

  try {
    const response = await callOpenRouter(
      {
        ...getVlmModelRoute(),
        messages: [
          {
            role: "system",
            content: VLM_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  // content_ref is either a base64 data URI or a secure URL
                  url: document.content_ref,
                },
              },
              {
                type: "text",
                text: "Analyze this C65-HD form. Return only the JSON object as specified.",
              },
            ],
          },
        ],
        max_tokens: 256,
        temperature: 0, // deterministic extraction — no creative variance
      },
      getVlmTimeoutMs()
    );

    const choice = response.choices[0];
    const rawContent = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason ?? "unknown";
    const reasoningTokens = response.usage?.completion_tokens_details?.reasoning_tokens ?? 0;

    if (!rawContent.trim()) {
      console.warn(
        `[AER/vlm_parser] Empty VLM response for document ${document.document_id} ` +
          `(finish_reason=${finishReason}, reasoning_tokens=${reasoningTokens})`
      );
      return {
        success: false,
        failure_reason: "IMAGE_QUALITY_TOO_LOW",
        document_id: document.document_id,
      };
    }

    // Extract JSON object substring, ignoring any reasoning or wrapper text
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let modelOutput: unknown;
    try {
      modelOutput = JSON.parse(jsonText);
    } catch {
      console.warn(
        `[AER/vlm_parser] Invalid VLM JSON for document ${document.document_id} ` +
          `(finish_reason=${finishReason}, content_length=${rawContent.length})`
      );
      // Treat as data uncertainty — do not fail open
      return {
        success: false,
        failure_reason: "IMAGE_QUALITY_TOO_LOW",
        document_id: document.document_id,
      };
    }

    const outputResult = VlmModelOutputSchema.safeParse(modelOutput);
    if (!outputResult.success) {
      console.warn(
        `[AER/vlm_parser] VLM output did not match the expected fields for document ${document.document_id}`
      );
      return {
        success: false,
        failure_reason: "IMAGE_QUALITY_TOO_LOW",
        document_id: document.document_id,
      };
    }
    const parsed = outputResult.data;

    // Enforce confidence threshold
    if (parsed.confidence_score < CONFIDENCE_THRESHOLD) {
      return {
        success: false,
        failure_reason: "IMAGE_QUALITY_TOO_LOW",
        document_id: document.document_id,
      };
    }

    return {
      success: true,
      result: {
        document_id: document.document_id,
        red_stamp_detected: Boolean(parsed.red_stamp_detected),
        signature_detected: Boolean(parsed.signature_detected),
        confidence_score: parsed.confidence_score,
        // Safety: never accept a date that doesn't match ISO format — imputed dates are forbidden
        extracted_issue_date:
          typeof parsed.extracted_issue_date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(parsed.extracted_issue_date)
            ? parsed.extracted_issue_date
            : null,
        extracted_issuing_authority:
          typeof parsed.extracted_issuing_authority === "string" &&
          parsed.extracted_issuing_authority.trim().length > 0
            ? parsed.extracted_issuing_authority.trim()
            : null,
      },
    };
  } catch (err) {
    const failureSummary = getOpenRouterFailureSummary(err);
    console.error(
      "[AER/vlm_parser] VLM call unavailable for document " +
        document.document_id +
        " (" +
        failureSummary +
        "); escalating for manual data review"
    );
    return {
      success: false,
      failure_reason: isOpenRouterTimeout(err) ? "TIMEOUT" : "MODEL_UNAVAILABLE",
      document_id: document.document_id,
    };
  }
}

/**
 * Analyzes all attached documents for a leave request.
 * Returns an array of VlmParseOutcome (one per document).
 *
 * @param documents - Array of attached documents from EmployeeLeaveRequest.
 * @returns Array of VlmParseOutcome (one per document).
 */
export async function analyzeAttachments(
  documents: AttachedDocument[]
): Promise<VlmParseOutcome[]> {
  if (documents.length === 0) return [];
  return Promise.all(documents.map(parseDocument));
}
