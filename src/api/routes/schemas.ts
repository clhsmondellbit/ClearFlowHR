/**
 * @file schemas.ts
 * @description Core Zod data contracts for the Autonomous HR Escalation Referee (AER).
 *
 * SAFETY CONTRACT:
 *   - LLMs MUST NOT be used to validate any field in these schemas.
 *   - All validation is deterministic (Zod + TypeScript).
 *   - PII fields (employee_id, employee_name) are hashed before persistence (see src/ledger/audit.ts).
 *   - The cryptographic_receipt field is MANDATORY on every EvaluationResponse to ensure
 *     full auditability of all decisions made by the system.
 *
 * Uncertainty taxonomy:
 *   U1_DATA      — Missing, corrupted, or unreadable source data (e.g., VLM timeout, blurry form).
 *   U2_POLICY    — Ambiguous policy interpretation (e.g., probationary vs. confirmed leave rules).
 *   U3_AUTHORITY — Approver authority limit exceeded or approver chain is unclear.
 *   NONE         — No uncertainty; decision is AUTO_APPROVE or REJECT with full confidence.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

/** Leave types recognized by the HRM system. */
export const LeaveTypeSchema = z.enum([
  "ANNUAL",
  "SICK",
  "MATERNITY",
  "PATERNITY",
  "UNPAID",
  "COMPASSIONATE",
]);

/** Three-dimensional uncertainty classification per AGENTS.md §5. */
export const UncertaintyCategorySchema = z.enum([
  "U1_DATA",       // Data uncertainty: missing/corrupted/illegible source data
  "U2_POLICY",     // Policy uncertainty: ambiguous rule interpretation
  "U3_AUTHORITY",  // Authority uncertainty: approver limit exceeded or chain unclear
  "NONE",          // No uncertainty — full deterministic resolution
]);

/** Possible outcomes for a leave evaluation. */
export const DecisionOutcomeSchema = z.enum([
  "AUTO_APPROVE",  // All checks passed; leave is automatically approved.
  "ESCALATE",      // One or more uncertainty dimensions triggered; HITL required.
  "REJECT",        // Deterministic rule violation with no ambiguity.
]);

/** Employment status influencing leave eligibility rules (Article 8.2 context). */
export const EmploymentStatusSchema = z.enum([
  "PROBATION",
  "CONFIRMED",
  "CONTRACT",
  "RESIGNED",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Supporting value schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents an attached document (e.g., C65-HD medical certificate).
 * The VLM parser (src/ai/vlm_parser.ts) processes these for red stamps and signatures.
 */
export const AttachedDocumentSchema = z.object({
  document_id: z.string().uuid(),
  form_type: z.string().min(1).describe("e.g. 'C65-HD', 'MATERNITY_CERT'"),
  /** Base64-encoded image content or a secure internal URL. */
  content_ref: z.string().min(1),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

/** Leave balance snapshot from the HRM system — computed deterministically, never by LLM. */
export const LeaveBalanceSchema = z.object({
  annual_days_remaining: z.number().int().min(0),
  sick_days_remaining: z.number().int().min(0),
  maternity_weeks_remaining: z.number().int().min(0),
  unpaid_days_used_ytd: z.number().int().min(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// Primary Request Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/evaluate
 *
 * Inbound payload from the HRM system representing a single leave request.
 *
 * IMPORTANT: Changing this schema requires "Ask First" consent per AGENTS.md §2.
 */
export const EmployeeLeaveRequestSchema = z.object({
  /** Unique identifier for this specific leave request event. */
  request_id: z.string().uuid(),

  /** SHA-256 hash of the employee's national ID or payroll ID — never plain PII. */
  employee_id: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "employee_id must be a lowercase SHA-256 hex digest"),

  /** Employee's display name. Will be hashed in the audit ledger before persistence. */
  employee_name: z.string().min(1).max(120),

  employment_status: EmploymentStatusSchema,

  leave_type: LeaveTypeSchema,

  /** ISO 8601 date strings (YYYY-MM-DD). */
  start_date: z.string().date(),
  end_date: z.string().date(),

  /** Number of calendar/business days requested — provided by HRM, not computed by LLM. */
  days_requested: z.number().int().positive(),

  leave_balance: LeaveBalanceSchema,

  /** Optional: attached medical or legal documents for VLM parsing. */
  attached_documents: z.array(AttachedDocumentSchema).optional().default([]),

  /** ISO 8601 timestamp when the HRM system created this request. */
  submitted_at: z.string().datetime(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Response Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response payload returned by POST /api/v1/evaluate.
 *
 * The `cryptographic_receipt` is MANDATORY. It is a SHA-256 digest over the
 * canonical JSON of (decision_id + outcome + uncertainty_category + policy_basis + timestamp).
 * Generated by src/ledger/audit.ts — never by an LLM.
 *
 * The `escalation_question` is present only when outcome === "ESCALATE" and is the
 * ONLY field whose text is synthesized by the LLM (language only, not logic).
 */
export const EvaluationResponseSchema = z.object({
  /** UUID v4 generated by the rules engine for this specific decision event. */
  decision_id: z.string().uuid(),

  outcome: DecisionOutcomeSchema,

  /**
   * Mandatory uncertainty classification.
   * - "NONE" when outcome is AUTO_APPROVE or REJECT.
   * - U1/U2/U3 when outcome is ESCALATE.
   */
  uncertainty_category: UncertaintyCategorySchema,

  /**
   * Human-readable citation of the policy or rule basis for the decision.
   * e.g. "Article 8.2 — Probationary employees ineligible for paid annual leave."
   * Populated by the deterministic rules engine; not generated by LLM.
   */
  policy_basis: z.string().min(1),

  /**
   * Single-turn closed question for the HITL reviewer.
   * Present only when outcome === "ESCALATE".
   * Synthesized by LLM for language quality; logic is pre-determined by rules engine.
   * Must be a closed question per AGENTS.md §5 style guide.
   */
  escalation_question: z.string().optional(),

  /**
   * MANDATORY cryptographic receipt.
   * SHA-256 hex digest over the canonical decision payload.
   * Generated by src/ledger/audit.ts.
   */
  cryptographic_receipt: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "cryptographic_receipt must be a lowercase SHA-256 hex digest"),

  /** ISO 8601 timestamp of when this evaluation was completed. */
  evaluated_at: z.string().datetime(),
})
  // Business rule: escalation questions are required when and only when outcome is ESCALATE.
  .refine(
    (data) =>
      data.outcome === "ESCALATE"
        ? data.escalation_question !== undefined && data.escalation_question.trim().length > 0
        : true,
    {
      message: "escalation_question is required when outcome is ESCALATE",
      path: ["escalation_question"],
    }
  )
  // Business rule: uncertainty_category must be NONE for non-ESCALATE outcomes.
  .refine(
    (data) =>
      data.outcome !== "ESCALATE" ? data.uncertainty_category === "NONE" : true,
    {
      message: "uncertainty_category must be 'NONE' for AUTO_APPROVE and REJECT outcomes",
      path: ["uncertainty_category"],
    }
  )
  // Business rule: uncertainty_category must NOT be NONE when ESCALATE.
  .refine(
    (data) =>
      data.outcome === "ESCALATE" ? data.uncertainty_category !== "NONE" : true,
    {
      message: "uncertainty_category must specify U1_DATA, U2_POLICY, or U3_AUTHORITY when outcome is ESCALATE",
      path: ["uncertainty_category"],
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// HITL Override Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/override
 *
 * Payload submitted by an authorized human reviewer to resolve a previously
 * ESCALATE decision. The override is recorded in the audit ledger.
 */
export const HitlOverrideRequestSchema = z.object({
  /** The decision_id from the original EvaluationResponse that was ESCALATE. */
  decision_id: z.string().uuid(),

  /** The request_id of the original EmployeeLeaveRequest. */
  request_id: z.string().uuid(),

  /** SHA-256 hash of the reviewer's employee/HR system ID — never plain PII. */
  reviewer_id: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "reviewer_id must be a lowercase SHA-256 hex digest"),

  resolution: z.enum([
    "APPROVE",          // Reviewer approves the leave request.
    "REJECT",           // Reviewer rejects the leave request.
    "SWITCH_LEAVE_TYPE", // Reviewer switches leave type (e.g., annual → unpaid).
  ]),

  /**
   * Required when resolution === "SWITCH_LEAVE_TYPE".
   * Specifies the new leave type to apply.
   */
  new_leave_type: LeaveTypeSchema.optional(),

  /** Free-text rationale from the reviewer (for audit trail). Max 1000 chars. */
  reviewer_notes: z.string().max(1000).optional(),

  /** ISO 8601 timestamp of the override action. */
  override_at: z.string().datetime(),
})
  .refine(
    (data) =>
      data.resolution === "SWITCH_LEAVE_TYPE"
        ? data.new_leave_type !== undefined
        : true,
    {
      message: "new_leave_type is required when resolution is SWITCH_LEAVE_TYPE",
      path: ["new_leave_type"],
    }
  );

/** Response returned after a successful HITL override. */
export const HitlOverrideResponseSchema = z.object({
  decision_id: z.string().uuid(),
  final_status: z.enum(["APPROVED", "REJECTED", "LEAVE_TYPE_SWITCHED"]),
  cryptographic_receipt: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "cryptographic_receipt must be a lowercase SHA-256 hex digest"),
  recorded_at: z.string().datetime(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

export type LeaveType = z.infer<typeof LeaveTypeSchema>;
export type UncertaintyCategory = z.infer<typeof UncertaintyCategorySchema>;
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;
export type AttachedDocument = z.infer<typeof AttachedDocumentSchema>;
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;
export type EmployeeLeaveRequest = z.infer<typeof EmployeeLeaveRequestSchema>;
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;
export type HitlOverrideRequest = z.infer<typeof HitlOverrideRequestSchema>;
export type HitlOverrideResponse = z.infer<typeof HitlOverrideResponseSchema>;
