/**
 * @file 03_escalate_u2_policy.test.ts
 * @description Benchmark Cases 08–10: ESCALATE with U2_POLICY scenarios.
 *
 * Cases:
 *   08 — PROBATION employee requests MATERNITY → ESCALATE U2_POLICY.
 *   09 — PROBATION employee requests PATERNITY → ESCALATE U2_POLICY.
 *   10 — CONTRACT employee requests MATERNITY → ESCALATE U2_POLICY.
 */

import { describe, it, expect } from "vitest";
import { runEvaluation } from "../../src/core/orchestrator.js";
import { makeRequest } from "./helpers.js";

describe("Benchmark Cases 08–10: ESCALATE (U2_POLICY)", () => {
  it("Case 08 — PROBATION + MATERNITY → ESCALATE U2_POLICY", async () => {
    const request = makeRequest({
      employment_status: "PROBATION",
      leave_type: "MATERNITY",
      days_requested: 84, // 12 weeks
      leave_balance: {
        annual_days_remaining: 0,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U2_POLICY");
    expect(result.escalation_question).toBeDefined();
    expect(result.escalation_question).toContain("Decision:");
    // Must be a closed question with options
    expect(result.escalation_question).toMatch(/\[.*\]/);
    expect(result.policy_basis).toContain("Article 8.2");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 09 — PROBATION + PATERNITY → ESCALATE U2_POLICY", async () => {
    const request = makeRequest({
      employment_status: "PROBATION",
      leave_type: "PATERNITY",
      days_requested: 5,
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U2_POLICY");
    expect(result.escalation_question).toBeDefined();
    expect(result.escalation_question).toContain("Decision:");
    expect(result.policy_basis).toContain("Article 8.2");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 10 — CONTRACT + MATERNITY → ESCALATE U2_POLICY", async () => {
    const request = makeRequest({
      employment_status: "CONTRACT",
      leave_type: "MATERNITY",
      days_requested: 112, // 16 weeks
      leave_balance: {
        annual_days_remaining: 5,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U2_POLICY");
    expect(result.escalation_question).toBeDefined();
    expect(result.policy_basis).toContain("Article 10.3");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
});
