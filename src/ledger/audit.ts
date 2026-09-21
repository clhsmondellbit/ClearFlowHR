/**
 * @file audit.ts
 * @description Cryptographic audit ledger for the AER system.
 *
 * Responsibilities:
 *   - Generate SHA-256 / Ed25519 cryptographic receipts over canonical decision payloads.
 *   - Hash PII fields (employee_id, employee_name, reviewer_id) before any persistence.
 *   - Record every evaluation and override event to an append-only ledger.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - No LLM involvement. All operations are pure deterministic cryptography.
 *   - PII is NEVER stored in plain text; always hash-first.
 *
 * NOTE: Full implementation is deferred to Phase 2 (deterministic rules engine sprint).
 *       This stub exports the function signatures so the type-checker passes.
 */

import { createHash } from "node:crypto";
import type { EvaluationResponse, HitlOverrideResponse } from "../api/routes/schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// PII Hashing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-way SHA-256 hash of a plaintext PII string.
 * Used before any PII field is written to logs or the ledger.
 *
 * @param plaintext - The raw PII value (name, ID, etc.)
 * @returns Lowercase hex-encoded SHA-256 digest (64 chars).
 */
export function hashPii(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cryptographic Receipt Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a SHA-256 cryptographic receipt over the canonical decision payload.
 *
 * The canonical payload is:
 *   JSON.stringify({ decision_id, outcome, uncertainty_category, policy_basis, evaluated_at })
 * sorted by key to ensure determinism across runtimes.
 *
 * @param payload - The core fields of the evaluation decision.
 * @returns Lowercase hex-encoded SHA-256 digest (64 chars).
 */
export function generateEvaluationReceipt(
  payload: Pick<
    EvaluationResponse,
    "decision_id" | "outcome" | "uncertainty_category" | "policy_basis" | "evaluated_at"
  >
): string {
  // Canonical serialization: sort keys alphabetically for determinism.
  const canonical = JSON.stringify({
    decision_id: payload.decision_id,
    evaluated_at: payload.evaluated_at,
    outcome: payload.outcome,
    policy_basis: payload.policy_basis,
    uncertainty_category: payload.uncertainty_category,
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Generates a SHA-256 cryptographic receipt for a HITL override action.
 *
 * @param payload - The core fields of the override event.
 * @returns Lowercase hex-encoded SHA-256 digest (64 chars).
 */
export function generateOverrideReceipt(
  payload: Pick<
    HitlOverrideResponse,
    "decision_id" | "final_status" | "recorded_at"
  >
): string {
  const canonical = JSON.stringify({
    decision_id: payload.decision_id,
    final_status: payload.final_status,
    recorded_at: payload.recorded_at,
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger Append (Stub — full implementation in Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a completed evaluation record to the append-only audit ledger.
 * PII fields are hashed before writing.
 *
 * @stub Full persistence implementation (e.g., file-based or DB) is Phase 2.
 */
export async function appendEvaluationToLedger(
  _response: EvaluationResponse,
  _hashedEmployeeId: string
): Promise<void> {
  // TODO (Phase 2): Implement append-only ledger persistence.
  // Ensure employee_id and employee_name are stored as SHA-256 hashes only.
  return Promise.resolve();
}

/**
 * Appends a HITL override record to the append-only audit ledger.
 *
 * @stub Full persistence implementation is Phase 2.
 */
export async function appendOverrideToLedger(
  _response: HitlOverrideResponse,
  _hashedReviewerId: string
): Promise<void> {
  // TODO (Phase 2): Implement append-only ledger persistence.
  return Promise.resolve();
}
