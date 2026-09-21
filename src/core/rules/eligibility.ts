/**
 * @file eligibility.ts
 * @description Deterministic eligibility rules engine.
 *
 * Validates whether an employee's employment status permits the requested leave type.
 * References:
 *   - Article 8.2: Probationary employees are ineligible for paid annual leave.
 *   - Article 9.1: Resigned employees may not initiate new leave requests.
 *   - Article 10.3: Contract employees have restricted maternity/paternity entitlements.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - All logic is deterministic lookup table evaluation — no LLM.
 *   - Returns policy citations for full auditability.
 */

import type {
  EmployeeLeaveRequest,
  EmploymentStatus,
  LeaveType,
} from "../../api/routes/schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type EligibilityOutcome =
  | "ELIGIBLE"
  | "INELIGIBLE_HARD_REJECT"    // Clear rule violation → REJECT
  | "INELIGIBLE_POLICY_AMBIGUOUS"; // Grey-area → ESCALATE with U2_POLICY

export interface EligibilityRuleResult {
  outcome: EligibilityOutcome;
  policy_basis: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility matrix
// Each cell: null = eligible, string = reason for ineligibility + outcome tag
// ─────────────────────────────────────────────────────────────────────────────

type EligibilityCell =
  | null                                                // Eligible
  | { type: "HARD_REJECT"; policy_basis: string }       // Deterministic rejection
  | { type: "POLICY_AMBIGUOUS"; policy_basis: string }; // Escalate U2_POLICY

const ELIGIBILITY_MATRIX: Record<EmploymentStatus, Record<LeaveType, EligibilityCell>> = {
  CONFIRMED: {
    ANNUAL:         null,
    SICK:           null,
    MATERNITY:      null,
    PATERNITY:      null,
    UNPAID:         null,
    COMPASSIONATE:  null,
  },

  PROBATION: {
    ANNUAL: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 8.2 — Employees on probation are ineligible for paid annual leave. " +
        "Probationary period must be completed before annual leave accrual begins.",
    },
    SICK: null, // Sick leave is permitted during probation.
    MATERNITY: {
      type: "POLICY_AMBIGUOUS",
      policy_basis:
        "Article 8.2 / Article 34 — Maternity leave entitlement during probation is policy-ambiguous. " +
        "Labor law guarantees maternity rights, but internal policy restricts probationary benefits. " +
        "Escalating for HR Director review.",
    },
    PATERNITY: {
      type: "POLICY_AMBIGUOUS",
      policy_basis:
        "Article 8.2 / Article 34.2 — Paternity leave entitlement during probation requires " +
        "HR Director confirmation due to policy ambiguity.",
    },
    UNPAID: null, // Unpaid leave is available to all statuses.
    COMPASSIONATE: null, // Compassionate leave is universally permitted.
  },

  CONTRACT: {
    ANNUAL: null, // Contract employees accrue annual leave pro-rata.
    SICK:   null,
    MATERNITY: {
      type: "POLICY_AMBIGUOUS",
      policy_basis:
        "Article 10.3 — Contract employee maternity entitlement depends on contract duration " +
        "and social insurance contribution period. Escalating for verification.",
    },
    PATERNITY: {
      type: "POLICY_AMBIGUOUS",
      policy_basis:
        "Article 10.3 — Contract employee paternity entitlement requires verification of " +
        "social insurance coverage period.",
    },
    UNPAID:        null,
    COMPASSIONATE: null,
  },

  RESIGNED: {
    ANNUAL: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests. " +
        "Any remaining annual leave balance is settled via payout.",
    },
    SICK: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests.",
    },
    MATERNITY: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests.",
    },
    PATERNITY: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests.",
    },
    UNPAID: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests.",
    },
    COMPASSIONATE: {
      type: "HARD_REJECT",
      policy_basis:
        "Article 9.1 — Resigned employees may not initiate new leave requests.",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates employment eligibility for the requested leave type.
 *
 * This is a pure lookup against the deterministic ELIGIBILITY_MATRIX.
 * No LLM involvement. Executes in O(1).
 *
 * @param request - The validated EmployeeLeaveRequest.
 * @returns EligibilityRuleResult with outcome and policy_basis.
 */
export function evaluateEligibility(
  request: EmployeeLeaveRequest
): EligibilityRuleResult {
  const cell =
    ELIGIBILITY_MATRIX[request.employment_status][request.leave_type];

  if (cell === null) {
    return {
      outcome: "ELIGIBLE",
      policy_basis: `Employment status '${request.employment_status}' is eligible for ${request.leave_type} leave.`,
    };
  }

  if (cell.type === "HARD_REJECT") {
    return { outcome: "INELIGIBLE_HARD_REJECT", policy_basis: cell.policy_basis };
  }

  return { outcome: "INELIGIBLE_POLICY_AMBIGUOUS", policy_basis: cell.policy_basis };
}
