/**
 * @file orchestrator.ts
 * @description The AER decision orchestrator — the single source of truth for all evaluation logic.
 *
 * Execution pipeline (deterministic, per AGENTS.md §2):
 *   1. Run VLM parser on attached documents → U1_DATA if any failure.
 *   2. Run eligibility check → REJECT (hard) or ESCALATE (U2_POLICY) if ineligible.
 *   3. Run leave balance check → REJECT if insufficient.
 *   4. Run authority routing → ESCALATE (U3_AUTHORITY) if tier > TIER_1.
 *   5. If all pass → AUTO_APPROVE.
 *
 * LLM involvement is limited to Step 6 (escalation_question synthesis), which is invoked
 * ONLY when the outcome is already determined to be ESCALATE. The LLM never touches logic.
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - This file orchestrates deterministic functions only.
 *   - LLMs MUST NOT change any outcome field or policy_basis.
 */

import { randomUUID } from "node:crypto";
import type {
  EmployeeLeaveRequest,
  EvaluationResponse,
  UncertaintyCategory,
  DecisionOutcome,
} from "../api/routes/schemas.js";
import { evaluateLeaveBalance } from "./rules/leave_balance.js";
import { evaluateEligibility } from "./rules/eligibility.js";
import { evaluateAuthority, isTierAutoApprovable } from "./rules/authority.js";
import { analyzeAttachments } from "../ai/vlm_parser.js";
import { generateEvaluationReceipt } from "../ledger/audit.js";
import { synthesizeEscalationQuestion } from "../ai/escalation_synthesizer.js";

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full AER evaluation pipeline for a leave request.
 *
 * Guaranteed to return within the 10ms SLA for AUTO_APPROVE and REJECT
 * (no LLM call in those paths). ESCALATE path adds LLM synthesis latency.
 *
 * @param request - A Zod-validated EmployeeLeaveRequest.
 * @returns A complete EvaluationResponse ready for API serialization.
 */
export async function runEvaluation(
  request: EmployeeLeaveRequest
): Promise<EvaluationResponse> {
  const decision_id = randomUUID();
  const evaluated_at = new Date().toISOString();

  // ── Step 1: VLM document analysis ─────────────────────────────────────────
  if (request.attached_documents.length > 0) {
    const vlmResults = await analyzeAttachments(request.attached_documents);
    const failure = vlmResults.find((r) => !r.success);

    if (failure && !failure.success) {
      const escalation_question = await synthesizeEscalationQuestion({
        employee_name: request.employee_name,
        leave_type: request.leave_type,
        days_requested: request.days_requested,
        policy_basis:
          `U1_DATA — VLM failed to parse attached document (${failure.document_id}): ` +
          `${failure.failure_reason}. Original C65-HD form cannot be verified.`,
        uncertainty_category: "U1_DATA",
      });

      return buildResponse({
        decision_id,
        evaluated_at,
        outcome: "ESCALATE",
        uncertainty_category: "U1_DATA",
        policy_basis:
          `U1_DATA — Document analysis failed for document ${failure.document_id}: ` +
          `${failure.failure_reason}. Original documents must be submitted for manual review.`,
        escalation_question,
      });
    }

    // Verify required visual authenticity markers (stamp + signature) on C65-HD form
    const unverifiedDoc = vlmResults.find(
      (r) => r.success && (!r.result.red_stamp_detected || !r.result.signature_detected)
    );

    if (unverifiedDoc && unverifiedDoc.success) {
      const missingList: string[] = [];
      if (!unverifiedDoc.result.red_stamp_detected) missingList.push("official red stamp not detected");
      if (!unverifiedDoc.result.signature_detected) missingList.push("authorized signature not detected");

      const policy_basis =
        `U1_DATA — Document authenticity check failed for document (${unverifiedDoc.result.document_id}): ` +
        `${missingList.join(", ")}. Valid C65-HD forms require both stamp and signature.`;

      const escalation_question = await synthesizeEscalationQuestion({
        employee_name: request.employee_name,
        leave_type: request.leave_type,
        days_requested: request.days_requested,
        policy_basis,
        uncertainty_category: "U1_DATA",
      });

      return buildResponse({
        decision_id,
        evaluated_at,
        outcome: "ESCALATE",
        uncertainty_category: "U1_DATA",
        policy_basis,
        escalation_question,
      });
    }
  }

  // ── Step 2: Eligibility check ──────────────────────────────────────────────
  const eligibility = evaluateEligibility(request);

  if (eligibility.outcome === "INELIGIBLE_HARD_REJECT") {
    return buildResponse({
      decision_id,
      evaluated_at,
      outcome: "REJECT",
      uncertainty_category: "NONE",
      policy_basis: eligibility.policy_basis,
    });
  }

  if (eligibility.outcome === "INELIGIBLE_POLICY_AMBIGUOUS") {
    const escalation_question = await synthesizeEscalationQuestion({
      employee_name: request.employee_name,
      leave_type: request.leave_type,
      days_requested: request.days_requested,
      policy_basis: eligibility.policy_basis,
      uncertainty_category: "U2_POLICY",
    });

    return buildResponse({
      decision_id,
      evaluated_at,
      outcome: "ESCALATE",
      uncertainty_category: "U2_POLICY",
      policy_basis: eligibility.policy_basis,
      escalation_question,
    });
  }

  // ── Step 3: Leave balance check ────────────────────────────────────────────
  const balance = evaluateLeaveBalance(request);

  if (balance.outcome !== "OK") {
    return buildResponse({
      decision_id,
      evaluated_at,
      outcome: "REJECT",
      uncertainty_category: "NONE",
      policy_basis: balance.policy_basis,
    });
  }

  // ── Step 4: Authority routing ──────────────────────────────────────────────
  const authority = evaluateAuthority(request);

  if (!isTierAutoApprovable(authority.required_tier!)) {
    const escalation_question = await synthesizeEscalationQuestion({
      employee_name: request.employee_name,
      leave_type: request.leave_type,
      days_requested: request.days_requested,
      policy_basis: authority.policy_basis,
      uncertainty_category: "U3_AUTHORITY",
      required_tier: authority.required_tier ?? undefined,
    });

    return buildResponse({
      decision_id,
      evaluated_at,
      outcome: "ESCALATE",
      uncertainty_category: "U3_AUTHORITY",
      policy_basis: authority.policy_basis,
      escalation_question,
    });
  }

  // ── Step 5: AUTO_APPROVE ───────────────────────────────────────────────────
  return buildResponse({
    decision_id,
    evaluated_at,
    outcome: "AUTO_APPROVE",
    uncertainty_category: "NONE",
    policy_basis:
      `All checks passed — ${request.days_requested} day(s) of ${request.leave_type} leave ` +
      `auto-approved under ${authority.required_tier} authority. ` +
      `${balance.policy_basis} ${authority.policy_basis}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal builder
// ─────────────────────────────────────────────────────────────────────────────

interface ResponseBlueprint {
  decision_id: string;
  evaluated_at: string;
  outcome: DecisionOutcome;
  uncertainty_category: UncertaintyCategory;
  policy_basis: string;
  escalation_question?: string;
}

function buildResponse(blueprint: ResponseBlueprint): EvaluationResponse {
  const cryptographic_receipt = generateEvaluationReceipt({
    decision_id: blueprint.decision_id,
    outcome: blueprint.outcome,
    uncertainty_category: blueprint.uncertainty_category,
    policy_basis: blueprint.policy_basis,
    evaluated_at: blueprint.evaluated_at,
  });

  const response: EvaluationResponse = {
    decision_id: blueprint.decision_id,
    outcome: blueprint.outcome,
    uncertainty_category: blueprint.uncertainty_category,
    policy_basis: blueprint.policy_basis,
    cryptographic_receipt,
    evaluated_at: blueprint.evaluated_at,
  };

  if (blueprint.escalation_question !== undefined) {
    response.escalation_question = blueprint.escalation_question;
  }

  return response;
}
