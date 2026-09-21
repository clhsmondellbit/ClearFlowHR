/**
 * @file 04_escalate_u3_authority.test.ts
 * @description Benchmark Cases 11–13: ESCALATE with U3_AUTHORITY scenarios.
 *
 * Cases:
 *   11 — CONFIRMED + ANNUAL + 8 days (>5, ≤14) → ESCALATE U3_AUTHORITY (TIER_2).
 *   12 — CONFIRMED + SICK + 20 days (>14) → ESCALATE U3_AUTHORITY (TIER_3).
 *   13 — CONFIRMED + MATERNITY + valid balance → ESCALATE U3_AUTHORITY (always TIER_3).
 */

import { describe, it, expect } from "vitest";
import { runEvaluation } from "../../src/core/orchestrator.js";
import { makeRequest } from "./helpers.js";

describe("Benchmark Cases 11–13: ESCALATE (U3_AUTHORITY)", () => {
  it("Case 11 — CONFIRMED + ANNUAL + 8 days (TIER_2 range) → ESCALATE U3_AUTHORITY", async () => {
    const request = makeRequest({
      employment_status: "CONFIRMED",
      leave_type: "ANNUAL",
      days_requested: 8,
      leave_balance: {
        annual_days_remaining: 12,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U3_AUTHORITY");
    expect(result.escalation_question).toBeDefined();
    expect(result.escalation_question).toContain("Department Head");
    expect(result.escalation_question).toContain("Decision:");
    expect(result.policy_basis).toContain("Article 20.2");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 12 — CONFIRMED + SICK + 20 days (TIER_3 range) → ESCALATE U3_AUTHORITY", async () => {
    const request = makeRequest({
      employment_status: "CONFIRMED",
      leave_type: "SICK",
      days_requested: 20,
      leave_balance: {
        annual_days_remaining: 10,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U3_AUTHORITY");
    expect(result.escalation_question).toBeDefined();
    expect(result.escalation_question).toContain("HR Director");
    expect(result.policy_basis).toContain("Article 20.3");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 13 — CONFIRMED + MATERNITY + valid balance → ESCALATE U3_AUTHORITY (always TIER_3)", async () => {
    const request = makeRequest({
      employment_status: "CONFIRMED",
      leave_type: "MATERNITY",
      days_requested: 126, // 18 weeks
      leave_balance: {
        annual_days_remaining: 10,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U3_AUTHORITY");
    expect(result.escalation_question).toBeDefined();
    expect(result.escalation_question).toContain("HR Director");
    expect(result.policy_basis).toContain("Article 20.3");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
});
