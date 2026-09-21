/**
 * @file helpers.ts
 * @description Test fixture factory for the 15-case AER benchmark suite.
 *
 * AGENTS.md §2 — DO NOT modify or delete any fixture in this file.
 * Add new fixtures only; never alter existing ones.
 */

import type { EmployeeLeaveRequest } from "../../src/api/routes/schemas.js";
import { hashPii } from "../../src/ledger/audit.js";

/**
 * Builds a minimal valid EmployeeLeaveRequest fixture.
 * Individual test cases override specific fields via spread.
 */
export function makeRequest(
  overrides: Partial<EmployeeLeaveRequest> & { employee_name?: string }
): EmployeeLeaveRequest {
  const name = overrides.employee_name ?? "Nguyen Van A";
  const base: EmployeeLeaveRequest = {
    request_id: "00000000-0000-4000-a000-000000000001",
    employee_id: hashPii("EMP-001"),
    employee_name: name,
    employment_status: "CONFIRMED",
    leave_type: "ANNUAL",
    start_date: "2026-10-01",
    end_date: "2026-10-03",
    days_requested: 3,
    leave_balance: {
      annual_days_remaining: 10,
      sick_days_remaining: 30,
      maternity_weeks_remaining: 26,
      unpaid_days_used_ytd: 0,
    },
    attached_documents: [],
    submitted_at: "2026-09-22T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}
