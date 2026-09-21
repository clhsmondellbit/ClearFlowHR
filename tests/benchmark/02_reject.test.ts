/**
 * @file 02_reject.test.ts
 * @description Benchmark Cases 05–07: Deterministic REJECT scenarios.
 *
 * Cases:
 *   05 — PROBATION employee requests ANNUAL leave → REJECT (Article 8.2 hard rule).
 *   06 — RESIGNED employee requests SICK leave → REJECT (Article 9.1 hard rule).
 *   07 — CONFIRMED employee, ANNUAL leave, balance insufficient → REJECT.
 */

import { describe, it, expect } from "vitest";
import { runEvaluation } from "../../src/core/orchestrator.js";
import { makeRequest } from "./helpers.js";

describe("Benchmark Cases 05–07: REJECT", () => {
  it("Case 05 — PROBATION + ANNUAL → REJECT (Article 8.2)", async () => {
    const request = makeRequest({
      employment_status: "PROBATION",
      leave_type: "ANNUAL",
      days_requested: 2,
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("REJECT");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.policy_basis).toContain("Article 8.2");
    expect(result.policy_basis).toContain("probation");
    expect(result.escalation_question).toBeUndefined();
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 06 — RESIGNED + SICK → REJECT (Article 9.1)", async () => {
    const request = makeRequest({
      employment_status: "RESIGNED",
      leave_type: "SICK",
      days_requested: 3,
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("REJECT");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.policy_basis).toContain("Article 9.1");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 07 — CONFIRMED + ANNUAL + insufficient balance → REJECT", async () => {
    const request = makeRequest({
      employment_status: "CONFIRMED",
      leave_type: "ANNUAL",
      days_requested: 5,
      leave_balance: {
        annual_days_remaining: 2, // only 2 days left — shortfall of 3
        sick_days_remaining: 30,
        maternity_weeks_remaining: 26,
        unpaid_days_used_ytd: 0,
      },
    });

    const result = await runEvaluation(request);

    expect(result.outcome).toBe("REJECT");
    expect(result.uncertainty_category).toBe("NONE");
    expect(result.policy_basis).toContain("Article 11.1");
    expect(result.policy_basis).toContain("shortfall");
    expect(result.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
});
