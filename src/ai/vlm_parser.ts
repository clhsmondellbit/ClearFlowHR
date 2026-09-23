/**
 * @file vlm_parser.ts
 * @description Vision-Language Model (VLM) integration for C65-HD form analysis via OpenRouter.
 *
 * Model: Uses OpenRouter's vision-capable model (google/gemini-flash-1.5) for OCR.
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

import type { AttachedDocument } from "../api/routes/schemas.js";
import { callOpenRouter, getApiKey } from "./openrouter_client.js";

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

/** VLM request timeout in milliseconds. */
const VLM_TIMEOUT_MS = parseInt(process.env["VLM_TIMEOUT_MS"] ?? "15000", 10);

/**
 * OpenRouter model used for vision/OCR tasks.
 * Uses google/gemma-4-26b-a4b-it (or VLM_MODEL from env) for multimodal document analysis.
 */
const VLM_MODEL = process.env["VLM_MODEL"] ?? "google/gemma-4-26b-a4b-it";

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — structural extraction only, no policy reasoning
// ─────────────────────────────────────────────────────────────────────────────

const VLM_SYSTEM_PROMPT = `\
You are a document layout analysis tool for Vietnamese HR medical forms (C65-HD standard).
Your ONLY job is to detect specific visual elements and extract dates/authority names.
You MUST NOT interpret policy, calculate leave entitlements, or make decisions.
You MUST NOT impute or guess missing dates — return null if a field is unreadable.

Respond ONLY with a valid JSON object using this exact schema (no markdown, no prose):
{
  "red_stamp_detected": boolean,
  "signature_detected": boolean,
  "confidence_score": number (0.0 to 1.0, based on image clarity),
  "extracted_issue_date": "YYYY-MM-DD" | null,
  "extracted_issuing_authority": string | null
}`;

// ─────────────────────────────────────────────────────────────────────────────
// VLM Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an attached document using the OpenRouter vision API.
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
  // Guard: unsupported format (PDFs cannot be sent as image_url to vision models)
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
      `[AER/vlm_parser] OPENROUTER_API_KEY not set — escalating document ${document.document_id} as MODEL_UNAVAILABLE`
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
        model: VLM_MODEL,
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
      VLM_TIMEOUT_MS
    );

    const rawContent = response.choices[0]?.message?.content ?? "";

    // Extract JSON object substring, ignoring any reasoning or wrapper text
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: {
      red_stamp_detected: boolean;
      signature_detected: boolean;
      confidence_score: number;
      extracted_issue_date: string | null;
      extracted_issuing_authority: string | null;
    };

    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      console.error(
        `[AER/vlm_parser] Failed to parse VLM JSON response for document ${document.document_id}:`,
        rawContent
      );
      // Treat as data uncertainty — do not fail open
      return {
        success: false,
        failure_reason: "IMAGE_QUALITY_TOO_LOW",
        document_id: document.document_id,
      };
    }

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
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("aborted") || message.includes("abort");
    console.error(`[AER/vlm_parser] VLM call failed for document ${document.document_id}:`, message);
    return {
      success: false,
      failure_reason: isTimeout ? "TIMEOUT" : "MODEL_UNAVAILABLE",
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
