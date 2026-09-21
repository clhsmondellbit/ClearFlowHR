/**
 * @file escalation_synthesizer.ts
 * @description LLM escalation question synthesizer.
 *
 * THIS IS THE ONLY MODULE WHERE AN LLM IS PERMITTED.
 *
 * The LLM receives a pre-computed policy_basis and uncertainty_category
 * (determined entirely by the deterministic rules engine) and synthesizes
 * ONLY the natural language text of the escalation question.
 *
 * The LLM MUST NOT:
 *   - Change the outcome, uncertainty_category, or policy_basis.
 *   - Perform any leave balance calculation.
 *   - Interpret or verify labor laws.
 *   - Impute missing dates or data.
 *
 * AGENTS.md §5 Style:
 *   - Output must be a single-turn CLOSED question.
 *   - Example: "Employee X is requesting Y leave but Z (Violation of Article N.N).
 *     Decision: [Option A] or [Option B]?"
 *
 * NOTE: The LLM client is a configurable adapter. Currently ships with a
 *       deterministic template fallback (no external dependency) so the system
 *       works fully offline. A real LLM client can be plugged in Phase 3.
 */

import type { UncertaintyCategory, LeaveType } from "../api/routes/schemas.js";
import type { ApprovalTier } from "../core/rules/authority.js";

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface EscalationSynthesisInput {
  employee_name: string;
  leave_type: LeaveType;
  days_requested: number;
  policy_basis: string;
  uncertainty_category: UncertaintyCategory;
  required_tier?: ApprovalTier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-based synthesizer (deterministic fallback — no LLM runtime required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-uncertainty-category question templates.
 * These produce HITL-compliant closed questions per AGENTS.md §5.
 * LLM synthesis (Phase 3) will replace these with richer language while keeping
 * the same structural pattern — the logic (outcome, policy) will never change.
 */
const TEMPLATES: Record<
  Exclude<UncertaintyCategory, "NONE">,
  (input: EscalationSynthesisInput) => string
> = {
  U1_DATA: (i) =>
    `Employee ${i.employee_name} has submitted a ${i.leave_type} leave request ` +
    `(${i.days_requested} day(s)), but the attached supporting document could not be verified. ` +
    `Reason: ${i.policy_basis}. ` +
    `Decision: [Request Original Documents and Resubmit] or [Reject Request]?`,

  U2_POLICY: (i) =>
    `Employee ${i.employee_name} is requesting ${i.leave_type} leave ` +
    `(${i.days_requested} day(s)), but policy eligibility is ambiguous. ` +
    `Policy conflict: ${i.policy_basis}. ` +
    `Decision: [Approve as ${i.leave_type}] or [Switch to UNPAID Leave] or [Reject]?`,

  U3_AUTHORITY: (i) => {
    const tierLabel: Record<ApprovalTier, string> = {
      TIER_1_MANAGER: "Direct Manager",
      TIER_2_DEPT_HEAD: "Department Head",
      TIER_3_HR_DIRECTOR: "HR Director",
    };
    const tier = i.required_tier ? tierLabel[i.required_tier] : "HR Director";
    return (
      `Employee ${i.employee_name} is requesting ${i.leave_type} leave ` +
      `(${i.days_requested} day(s)), which requires ${tier} approval. ` +
      `Authority basis: ${i.policy_basis}. ` +
      `Decision: [Approve] or [Reject]?`
    );
  },
};

/**
 * Synthesizes a single-turn HITL escalation question.
 *
 * The question text is the ONLY LLM output surface in the entire AER system.
 * All outcome logic has been decided before this function is called.
 *
 * @param input - Pre-computed escalation context from the rules engine.
 * @returns A closed escalation question string ready for HITL display.
 */
export async function synthesizeEscalationQuestion(
  input: EscalationSynthesisInput
): Promise<string> {
  // Safety guard: NONE uncertainty should never reach the synthesizer.
  if (input.uncertainty_category === "NONE") {
    throw new Error(
      "[AER] synthesizeEscalationQuestion called with uncertainty_category=NONE. " +
        "This is a programming error — escalation questions are only generated for ESCALATE outcomes."
    );
  }

  // TODO (Phase 3): Replace template with actual LLM API call.
  // The call must be fire-and-forget for language enrichment only.
  // The model must be given the policy_basis as a fixed fact, not an input to reason about.
  //
  // Example system prompt:
  //   "You are an HR escalation assistant. Rewrite the following question in clear,
  //    professional Vietnamese/English (as configured). Do not change the options,
  //    the decision outcome, or the policy citation. Output only the rewritten question."

  const template = TEMPLATES[input.uncertainty_category];
  // Synchronous template — returns immediately (< 1ms, within 10ms SLA for escalation paths).
  return Promise.resolve(template(input));
}
