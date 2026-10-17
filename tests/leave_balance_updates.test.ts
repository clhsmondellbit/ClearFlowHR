import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmployeeLeaveRequest,
  EvaluationResponse,
} from "../src/api/routes/schemas.js";

let stateDirectory: string;

beforeEach(() => {
  stateDirectory = mkdtempSync(join(tmpdir(), "aer-leave-balance-"));
  vi.stubEnv("AER_ACCOUNT_STATE_FILE", join(stateDirectory, "balances.json"));
  vi.stubEnv("AER_PENDING_LEAVE_STATE_FILE", join(stateDirectory, "pending.json"));
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  rmSync(stateDirectory, { recursive: true, force: true });
});

describe("approved sick leave balance updates", () => {
  it("deducts approved days once and restores the balance after a restart", async () => {
    const accounts = await import("../src/auth/accounts.js");
    const account = accounts.USER_ACCOUNTS[0];
    expect(account).toBeDefined();
    if (!account) throw new Error("Expected a seeded employee account");

    const requestId = "b0000000-0000-4000-a000-000000000011";
    expect(accounts.applyApprovedLeaveBalance(account, requestId, "SICK", 3)).toBe("APPLIED");
    expect(account.balance.sick).toBe(27);

    vi.resetModules();
    const restartedAccounts = await import("../src/auth/accounts.js");
    const restoredAccount = restartedAccounts.USER_ACCOUNTS[0];
    expect(restoredAccount?.balance.sick).toBe(27);
    if (!restoredAccount) throw new Error("Expected a restored employee account");
    expect(
      restartedAccounts.applyApprovedLeaveBalance(restoredAccount, requestId, "SICK", 3),
    ).toBe("ALREADY_APPLIED");
    expect(restoredAccount.balance.sick).toBe(27);
  });

  it("deducts sick days when an escalated request is approved by a reviewer", async () => {
    const accounts = await import("../src/auth/accounts.js");
    const account = accounts.USER_ACCOUNTS[0];
    expect(account).toBeDefined();
    if (!account) throw new Error("Expected a seeded employee account");

    const employeeHash = createHash("sha256").update(account.employeeId).digest("hex");
    const request = {
      request_id: "b0000000-0000-4000-a000-000000000012",
      employee_id: employeeHash,
      leave_type: "SICK",
      days_requested: 3,
    } as EmployeeLeaveRequest;
    const response = {
      decision_id: "a0000000-0000-4000-a000-000000000012",
      outcome: "ESCALATE",
    } as EvaluationResponse;
    const decisions = await import("../src/core/pending_leave_decisions.js");

    decisions.rememberPendingLeaveDecision(request, response);
    expect(decisions.resolvePendingLeaveDecision({
      request_id: request.request_id,
      decision_id: response.decision_id,
      resolution: "APPROVE",
    })).toBe("RESOLVED");
    expect(account.balance.sick).toBe(27);

    expect(decisions.resolvePendingLeaveDecision({
      request_id: request.request_id,
      decision_id: response.decision_id,
      resolution: "APPROVE",
    })).toBe("ALREADY_RESOLVED");
    expect(account.balance.sick).toBe(27);
  });
});
