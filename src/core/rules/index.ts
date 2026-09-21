/**
 * @file index.ts
 * @description Rules engine barrel export.
 *
 * All leave balance calculations, eligibility checks, and authority routing are exported here.
 * SAFETY BOUNDARY: No LLM involvement in any export of this module.
 */

export { evaluateLeaveBalance } from "./leave_balance.js";
export type { BalanceRuleResult, BalanceRuleOutcome } from "./leave_balance.js";

export { evaluateEligibility } from "./eligibility.js";
export type { EligibilityRuleResult, EligibilityOutcome } from "./eligibility.js";

export { evaluateAuthority, isTierAutoApprovable } from "./authority.js";
export type { AuthorityRuleResult, AuthorityOutcome, ApprovalTier } from "./authority.js";
