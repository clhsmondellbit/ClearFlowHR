/**
 * @file leave_balance.ts
 * @description Deterministic leave balance validation rules.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - ALL calculations are pure integer arithmetic in TypeScript.
 *   - LLMs MUST NOT be used here under any circumstances.
 *   - This module has no side effects; it is a pure function library.
 */

import type { EmployeeLeaveRequest, LeaveType } from "../../api/routes/schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type BalanceRuleOutcome = "OK" | "INSUFFICIENT" | "EXCEEDED_MATERNITY_LIMIT";

export interface BalanceRuleResult {
  outcome: BalanceRuleOutcome;
  /** Policy article citation for the outcome. */
  policy_basis: string;
  /** Days available in the relevant balance bucket. */
  balance_available: number;
  /** Days actually requested. */
  days_requested: number;
  /** Shortfall (positive = deficit). 0 when OK. */
  shortfall: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum annual leave days allowed per calendar year (Article 11.1). */
export const MAX_ANNUAL_DAYS = 12;

/** Maximum sick leave days per calendar year without specialist certificate (Article 12.1). */
export const MAX_SICK_DAYS_NO_CERT = 30;

/** Maximum maternity leave in weeks per event (Article 34, Labor Code). */
export const MAX_MATERNITY_WEEKS = 26;

/** Maximum paternity leave days per birth event (Article 34.2). */
export const MAX_PATERNITY_DAYS = 14;

/** Maximum compassionate leave days per event (Article 15.1). */
export const MAX_COMPASSIONATE_DAYS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Core validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the requested leave days against the employee's current leave balances.
 *
 * All logic is deterministic integer math — no LLM involvement.
 *
 * @param request - The validated EmployeeLeaveRequest.
 * @returns BalanceRuleResult with outcome, policy_basis, and shortfall details.
 */
export function evaluateLeaveBalance(request: EmployeeLeaveRequest): BalanceRuleResult {
  const { leave_type, days_requested, leave_balance } = request;

  return BALANCE_CHECKERS[leave_type](days_requested, leave_balance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-leave-type balance checkers (pure functions)
// ─────────────────────────────────────────────────────────────────────────────

type BalanceChecker = (
  daysRequested: number,
  balance: EmployeeLeaveRequest["leave_balance"]
) => BalanceRuleResult;

const BALANCE_CHECKERS: Record<LeaveType, BalanceChecker> = {
  ANNUAL: (days, balance) => {
    const available = balance.annual_days_remaining;
    const shortfall = Math.max(0, days - available);
    return {
      outcome: shortfall > 0 ? "INSUFFICIENT" : "OK",
      policy_basis:
        shortfall > 0
          ? `Article 11.1 — Employee has ${available} annual leave days remaining; ${days} requested (shortfall: ${shortfall}).`
          : `Article 11.1 — Annual leave balance sufficient (${available} available, ${days} requested).`,
      balance_available: available,
      days_requested: days,
      shortfall,
    };
  },

  SICK: (days, balance) => {
    const available = balance.sick_days_remaining;
    const shortfall = Math.max(0, days - available);
    return {
      outcome: shortfall > 0 ? "INSUFFICIENT" : "OK",
      policy_basis:
        shortfall > 0
          ? `Article 12.1 — Employee has ${available} sick leave days remaining; ${days} requested (shortfall: ${shortfall}).`
          : `Article 12.1 — Sick leave balance sufficient (${available} available, ${days} requested).`,
      balance_available: available,
      days_requested: days,
      shortfall,
    };
  },

  MATERNITY: (days, balance) => {
    // days_requested in this context represents days; convert limit to days (weeks × 7).
    const limitDays = balance.maternity_weeks_remaining * 7;
    const shortfall = Math.max(0, days - limitDays);
    if (days > MAX_MATERNITY_WEEKS * 7) {
      return {
        outcome: "EXCEEDED_MATERNITY_LIMIT",
        policy_basis: `Article 34 (Labor Code) — Maternity leave cannot exceed ${MAX_MATERNITY_WEEKS} weeks (${MAX_MATERNITY_WEEKS * 7} days). ${days} days requested.`,
        balance_available: limitDays,
        days_requested: days,
        shortfall: days - MAX_MATERNITY_WEEKS * 7,
      };
    }
    return {
      outcome: shortfall > 0 ? "INSUFFICIENT" : "OK",
      policy_basis:
        shortfall > 0
          ? `Article 34 — Maternity leave balance insufficient (${limitDays} days available, ${days} requested).`
          : `Article 34 — Maternity leave balance sufficient (${limitDays} days available, ${days} requested).`,
      balance_available: limitDays,
      days_requested: days,
      shortfall,
    };
  },

  PATERNITY: (days, _balance) => {
    const shortfall = Math.max(0, days - MAX_PATERNITY_DAYS);
    return {
      outcome: shortfall > 0 ? "INSUFFICIENT" : "OK",
      policy_basis:
        shortfall > 0
          ? `Article 34.2 — Paternity leave capped at ${MAX_PATERNITY_DAYS} days. ${days} days requested (shortfall: ${shortfall}).`
          : `Article 34.2 — Paternity leave within allowable limit (${days} of ${MAX_PATERNITY_DAYS} days).`,
      balance_available: MAX_PATERNITY_DAYS,
      days_requested: days,
      shortfall,
    };
  },

  UNPAID: (days, balance) => {
    // Unpaid leave has no hard balance cap but tracks YTD usage for reporting.
    // Deterministic: always OK (no balance ceiling). YTD logged for audit.
    const ytdUsed = balance.unpaid_days_used_ytd;
    return {
      outcome: "OK",
      policy_basis: `Article 16.1 — Unpaid leave approved; ${ytdUsed + days} total unpaid days YTD after this request.`,
      balance_available: Number.MAX_SAFE_INTEGER,
      days_requested: days,
      shortfall: 0,
    };
  },

  COMPASSIONATE: (days, _balance) => {
    const shortfall = Math.max(0, days - MAX_COMPASSIONATE_DAYS);
    return {
      outcome: shortfall > 0 ? "INSUFFICIENT" : "OK",
      policy_basis:
        shortfall > 0
          ? `Article 15.1 — Compassionate leave capped at ${MAX_COMPASSIONATE_DAYS} days per event. ${days} days requested (shortfall: ${shortfall}).`
          : `Article 15.1 — Compassionate leave within allowable limit (${days} of ${MAX_COMPASSIONATE_DAYS} days).`,
      balance_available: MAX_COMPASSIONATE_DAYS,
      days_requested: days,
      shortfall,
    };
  },
};
