/**
 * @file authority.ts
 * @description Deterministic authority routing and approval limit rules.
 *
 * Determines the required approval authority tier for a leave request.
 * Authority limits are defined by policy — not computed by an LLM.
 *
 * Authority Tiers:
 *   TIER_1_MANAGER      — Direct line manager (up to 5 days any leave type).
 *   TIER_2_DEPT_HEAD    — Department head (6–14 days, or sensitive leave types).
 *   TIER_3_HR_DIRECTOR  — HR Director (15+ days, or maternity/paternity/RESIGNED edge cases).
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - All routing is deterministic threshold lookup — no LLM.
 *   - U3_AUTHORITY is raised only when the system cannot auto-determine the correct tier.
 */

import type { EmployeeLeaveRequest, LeaveType } from "../../api/routes/schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalTier =
  | "TIER_1_MANAGER"
  | "TIER_2_DEPT_HEAD"
  | "TIER_3_HR_DIRECTOR";

export type AuthorityOutcome =
  | "ROUTED"          // Tier determined; system can auto-approve (if other checks pass).
  | "ESCALATE_U3";    // Authority chain ambiguous; human must confirm approver.

export interface AuthorityRuleResult {
  outcome: AuthorityOutcome;
  required_tier: ApprovalTier | null; // null only when outcome is ESCALATE_U3
  policy_basis: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day-range thresholds per Article 20 (Approval Authority Policy)
// ─────────────────────────────────────────────────────────────────────────────

const TIER_1_MAX_DAYS = 5;
const TIER_2_MAX_DAYS = 14;
// 15+ days → TIER_3_HR_DIRECTOR

/** Leave types that always require at least TIER_2 regardless of duration. */
const ALWAYS_TIER2_OR_ABOVE: Set<LeaveType> = new Set([
  "MATERNITY",
  "PATERNITY",
]);

/** Leave types that always require TIER_3 (HR Director mandatory sign-off). */
const ALWAYS_TIER3: Set<LeaveType> = new Set([
  "MATERNITY", // All maternity leave requires HR Director per Article 34.
]);

// ─────────────────────────────────────────────────────────────────────────────
// Public evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the required approval authority tier for a leave request.
 *
 * Routing logic (deterministic, per Article 20):
 *   1. MATERNITY always → TIER_3_HR_DIRECTOR.
 *   2. PATERNITY or days > TIER_1_MAX_DAYS → at least TIER_2_DEPT_HEAD.
 *   3. days > TIER_2_MAX_DAYS → TIER_3_HR_DIRECTOR.
 *   4. Otherwise → TIER_1_MANAGER (auto-approvable).
 *
 * @param request - The validated EmployeeLeaveRequest.
 * @returns AuthorityRuleResult with routing tier and policy basis.
 */
export function evaluateAuthority(request: EmployeeLeaveRequest): AuthorityRuleResult {
  const { leave_type, days_requested } = request;

  // Rule 1: Absolute TIER_3 leave types.
  if (ALWAYS_TIER3.has(leave_type)) {
    return {
      outcome: "ROUTED",
      required_tier: "TIER_3_HR_DIRECTOR",
      policy_basis: `Article 20.3 — ${leave_type} leave mandates HR Director sign-off regardless of duration.`,
    };
  }

  // Rule 2: Days exceed TIER_2 limit → TIER_3.
  if (days_requested > TIER_2_MAX_DAYS) {
    return {
      outcome: "ROUTED",
      required_tier: "TIER_3_HR_DIRECTOR",
      policy_basis: `Article 20.3 — Requests exceeding ${TIER_2_MAX_DAYS} days require HR Director approval. ` +
        `${days_requested} days requested.`,
    };
  }

  // Rule 3: Sensitive types or days exceed TIER_1 limit → TIER_2.
  if (ALWAYS_TIER2_OR_ABOVE.has(leave_type) || days_requested > TIER_1_MAX_DAYS) {
    return {
      outcome: "ROUTED",
      required_tier: "TIER_2_DEPT_HEAD",
      policy_basis:
        days_requested > TIER_1_MAX_DAYS
          ? `Article 20.2 — Requests exceeding ${TIER_1_MAX_DAYS} days require Department Head approval. ` +
            `${days_requested} days requested.`
          : `Article 20.2 — ${leave_type} leave requires at minimum Department Head approval.`,
    };
  }

  // Rule 4: Within TIER_1 limits.
  return {
    outcome: "ROUTED",
    required_tier: "TIER_1_MANAGER",
    policy_basis: `Article 20.1 — ${days_requested} day(s) of ${leave_type} leave is within direct manager approval authority.`,
  };
}

/**
 * Returns true if the resolved tier allows the AER to auto-approve without HITL.
 * Auto-approve is only possible at TIER_1 (direct manager authority delegation).
 *
 * TIER_2 and TIER_3 always produce ESCALATE (U3_AUTHORITY) unless pre-authorized.
 */
export function isTierAutoApprovable(tier: ApprovalTier): boolean {
  return tier === "TIER_1_MANAGER";
}
