/**
 * @file 01_auto_approve.test.ts
 * @description Benchmark Cases 01–04: AUTO_APPROVE happy-path scenarios.
 *
 * Cases:
 *   01 — CONFIRMED employee, ANNUAL leave, within balance, ≤5 days (TIER_1).
 *   02 — CONFIRMED employee, SICK leave, within balance, 3 days (TIER_1).
 *   03 — CONFIRMED employee, UNPAID leave, no ceiling (TIER_1, 2 days).
 *   04 — CONFIRMED employee, COMPASSIONATE leave, ≤5 days (TIER_1).
 */

import { describe, it, expect } from "vitest";
import { runEvaluation } from "../../src/core/orchestrator.js";
import { makeRequest } from "./helpers.js";

describe("Benchmark Cases 01–04: AUTO_APPROVE", () => {
  it("Case 01 — CONFIRMED + ANNUAL + within balance + ≤5 days → AUTO_APPROVE", async () => {
    const request = makeRequest({
      leave_type: "ANNUAL",
      days_requested: 3,
      leave_balance: {
        annual_days_remaining: 10,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("AUTO_APPROVE");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
    expect(result.escalation_question).toBeUndefined();
    expect(result.policy_basis).toContain("Article 20.1");
  });

  it("Case 02 — CONFIRMED + SICK + within balance + 3 days → AUTO_APPROVE", async () => {
    const request = makeRequest({
      leave_type: "SICK",
      days_requested: 3,
      leave_balance: {
        annual_days_remaining: 10,
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("AUTO_APPROVE");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 03 — CONFIRMED + UNPAID + 2 days → AUTO_APPROVE (no ceiling)", async () => {
    const request = makeRequest({
      leave_type: "UNPAID",
      days_requested: 2,
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("AUTO_APPROVE");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.policy_basis).toContain("Article 16.1");
  });

  it("Case 04 — CONFIRMED + COMPASSIONATE + 3 days (≤5) → AUTO_APPROVE", async () => {
    const request = makeRequest({
      leave_type: "COMPASSIONATE",
      days_requested: 3,
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("AUTO_APPROVE");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
});
