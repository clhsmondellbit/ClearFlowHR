/**
 * @file orchestrator.ts
 * @description The AER decision orchestrator — the single source of truth for all evaluation logic.
 *
 * Execution pipeline (deterministic, per AGENTS.md §2):
 *   1. Apply hard eligibility rejections → REJECT without document processing.
 *   2. Run VLM parser on attached documents → U1_DATA if any failure.
 *   3. Escalate policy-ambiguous eligibility → U2_POLICY.
 *   4. Run leave balance check → REJECT if insufficient.
 *   5. Run authority routing → ESCALATE (U3_AUTHORITY) if tier > TIER_1.
 *   6. If all pass → AUTO_APPROVE.
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
  EvidenceAssessment,
  LeaveType,
  UncertaintyCategory,
  DecisionOutcome,
} from "../api/routes/schemas.js";
import {
  DetectedEvidenceTypeSchema,
  EvaluationResponseSchema,
} from "../api/routes/schemas.js";
import { evaluateLeaveBalance } from "./rules/leave_balance.js";
import { evaluateEligibility } from "./rules/eligibility.js";
import { evaluateAuthority, isTierAutoApprovable } from "./rules/authority.js";
import { analyzeAttachments } from "../ai/vlm_parser.js";
import { generateEvaluationReceipt } from "../ledger/audit.js";
import { synthesizeEscalationQuestion } from "../ai/escalation_synthesizer.js";
import type { VlmParseOutcome } from "../ai/vlm_parser.js";

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

const NON_SICK_LEAVE_TYPES: readonly LeaveType[] = [
  "ANNUAL",
  "MATERNITY",
  "PATERNITY",
  "UNPAID",
  "COMPASSIONATE",
];

const EVIDENCE_TYPE_LEAVE_TYPES: Record<string, readonly LeaveType[] | null> = {
  C65_HD: ["SICK"],
  SICK_MEDICAL_DOCUMENT: ["SICK"],
  MATERNITY_CERTIFICATE: ["MATERNITY"],
  GENERAL_LEAVE_FORM: NON_SICK_LEAVE_TYPES,
  OTHER: [],
  UNKNOWN: null,
};

function normalizeFormType(formType: string): string {
  return formType
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function assessEvidence(
  documents: EmployeeLeaveRequest["attached_documents"],
  outcomes: VlmParseOutcome[],
  leaveType: LeaveType
): EvidenceAssessment[] {
  return documents.map((document, index) => {
    const outcome = outcomes[index];
    const detectedType = outcome?.success
      ? DetectedEvidenceTypeSchema.parse(outcome.result.detected_document_type)
      : null;
    const applicableLeaveTypes = detectedType
      ? EVIDENCE_TYPE_LEAVE_TYPES[detectedType]
      : null;
    const relevance = !applicableLeaveTypes
      ? "UNKNOWN"
      : applicableLeaveTypes.includes(leaveType)
        ? "RELEVANT"
        : "NOT_RELEVANT";

    return {
      document_id: document.document_id,
      declared_form_type: document.form_type,
      detected_document_type: detectedType,
      leave_type: leaveType,
      relevance,
      analysis_status: outcome?.success ? "ANALYZED" : "FAILED",
      red_stamp_detected: outcome?.success ? outcome.result.red_stamp_detected : null,
      signature_detected: outcome?.success ? outcome.result.signature_detected : null,
      confidence_score: outcome?.success ? outcome.result.confidence_score : null,
      failure_reason: outcome?.success ? null : outcome?.failure_reason ?? "MODEL_UNAVAILABLE",
    };
  });
}

function isDeclaredC65Form(formType: string): boolean {
  const normalized = normalizeFormType(formType);
  return normalized === "C65" || normalized.startsWith("C65HD");
}

/**
 * Runs the full AER evaluation pipeline for a leave request.
 *
 * AUTO_APPROVE and REJECT use deterministic checks only. ESCALATE uses a
 * deterministic question template unless LLM enrichment is explicitly enabled.
 *
 * @param request - A Zod-validated EmployeeLeaveRequest.
 * @returns A complete EvaluationResponse ready for API serialization.
 */
export async function runEvaluation(
  request: EmployeeLeaveRequest
): Promise<EvaluationResponse> {
  const decision_id = randomUUID();
  const evaluated_at = new Date().toISOString();
  let evidenceAssessments: EvidenceAssessment[] = [];
  const respond = (blueprint: ResponseBlueprint) =>
    buildResponse({ ...blueprint, evidence_assessments: evidenceAssessments });

  // Apply deterministic hard rejections before evidence checks. A rejected request
  // must not be escalated just because its supporting document is missing or unreadable.
  const eligibility = evaluateEligibility(request);
  if (eligibility.outcome === "INELIGIBLE_HARD_REJECT") {
    evidenceAssessments = request.attached_documents.map((document) => ({
      document_id: document.document_id,
      declared_form_type: document.form_type,
      detected_document_type: null,
      leave_type: request.leave_type,
      relevance: "UNKNOWN",
      analysis_status: "SKIPPED",
      red_stamp_detected: null,
      signature_detected: null,
      confidence_score: null,
      failure_reason: null,
    }));

    return respond({
      decision_id,
      evaluated_at,
      outcome: "REJECT",
      uncertainty_category: "NONE",
      policy_basis: eligibility.policy_basis,
    });
  }

  if (request.leave_type === "SICK" && request.attached_documents.length === 0) {
    evidenceAssessments = [{
      document_id: null,
      declared_form_type: null,
      detected_document_type: null,
      leave_type: request.leave_type,
      relevance: "UNKNOWN",
      analysis_status: "MISSING",
      red_stamp_detected: null,
      signature_detected: null,
      confidence_score: null,
      failure_reason: "MISSING_DOCUMENT",
    }];
    const policy_basis =
      "U1_DATA — No supporting medical document was attached to the sick leave request. " +
      "The required evidence must be submitted for manual review.";
    const escalation_question = await synthesizeEscalationQuestion({
      employee_name: request.employee_name,
      leave_type: request.leave_type,
      days_requested: request.days_requested,
      policy_basis,
      uncertainty_category: "U1_DATA",
    });

    return respond({
      decision_id,
      evaluated_at,
      outcome: "ESCALATE",
      uncertainty_category: "U1_DATA",
      policy_basis,
      escalation_question,
    });
  }

  // ── Step 1: VLM document analysis ─────────────────────────────────────────
  if (request.attached_documents.length > 0) {
    const vlmResults = await analyzeAttachments(request.attached_documents);
    evidenceAssessments = assessEvidence(
      request.attached_documents,
      vlmResults,
      request.leave_type
    );
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

      return respond({
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

    const hasRelevantEvidence = evidenceAssessments.some(
      (assessment) => assessment.relevance === "RELEVANT"
    );
    const unrelatedEvidence = evidenceAssessments.find(
      (assessment) => assessment.relevance === "NOT_RELEVANT"
    );
    const unclassifiedSickEvidence = request.leave_type === "SICK" && !hasRelevantEvidence
      ? evidenceAssessments.find((assessment) => assessment.relevance === "UNKNOWN")
      : undefined;
    const evidenceToReview = unrelatedEvidence ?? unclassifiedSickEvidence;

    if (!hasRelevantEvidence && request.leave_type === "SICK" && unrelatedEvidence) {
      return respond({
        decision_id,
        evaluated_at,
        outcome: "REJECT",
        uncertainty_category: "NONE",
        policy_basis:
          `SICK evidence check — Document ${unrelatedEvidence.document_id} was identified as ` +
          `${unrelatedEvidence.detected_document_type}, which is not medical evidence for sick leave. ` +
          "Submit a new request with a relevant medical certificate.",
      });
    }

    if (!hasRelevantEvidence && evidenceToReview) {
      const isUnclassified = evidenceToReview.relevance === "UNKNOWN";
      const policy_basis =
        isUnclassified
          ? `U1_DATA — Supporting document ${evidenceToReview.document_id} could not be classified ` +
            `as medical evidence for this ${request.leave_type} leave. Route the request to an authorized ` +
            "reviewer to request suitable evidence or reject it."
          : `U1_DATA — Attached document ${evidenceToReview.document_id} was identified as ` +
            `${evidenceToReview.detected_document_type}, which does not match the requested ` +
            `${request.leave_type} leave. The evidence must be reviewed manually.`;
      const escalation_question = await synthesizeEscalationQuestion({
        employee_name: request.employee_name,
        leave_type: request.leave_type,
        days_requested: request.days_requested,
        policy_basis,
        uncertainty_category: "U1_DATA",
      });

      return respond({
        decision_id,
        evaluated_at,
        outcome: "ESCALATE",
        uncertainty_category: "U1_DATA",
        policy_basis,
        escalation_question,
      });
    }

    // Verify required visual authenticity markers for medical forms (C65-HD / BHXH)
    // General leave requests (ĐƠN XIN NGHỈ PHÉP) do not require hospital red stamps.
    const unverifiedDoc = vlmResults.find((r) => {
      if (!r.success) return false;
      const docDef = request.attached_documents.find((d) => d.document_id === r.result.document_id);
      const detectedType = r.result.detected_document_type;
      const isC65 = detectedType === "C65_HD" ||
        (detectedType === "UNKNOWN" && Boolean(docDef && isDeclaredC65Form(docDef.form_type)));

      if (request.leave_type === "SICK" && isC65 && !r.result.red_stamp_detected) {
        return true;
      }
      return false;
    });

    if (unverifiedDoc && unverifiedDoc.success) {
      const policy_basis =
        `U1_DATA — Document authenticity check failed for medical certificate (${unverifiedDoc.result.document_id}): ` +
        `official hospital red stamp not detected. Form C65-HD requires an official medical seal.`;

      const escalation_question = await synthesizeEscalationQuestion({
        employee_name: request.employee_name,
        leave_type: request.leave_type,
        days_requested: request.days_requested,
        policy_basis,
        uncertainty_category: "U1_DATA",
      });

      return respond({
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
  if (eligibility.outcome === "INELIGIBLE_POLICY_AMBIGUOUS") {
    const escalation_question = await synthesizeEscalationQuestion({
      employee_name: request.employee_name,
      leave_type: request.leave_type,
      days_requested: request.days_requested,
      policy_basis: eligibility.policy_basis,
      uncertainty_category: "U2_POLICY",
    });

    return respond({
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
    return respond({
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

    return respond({
      decision_id,
      evaluated_at,
      outcome: "ESCALATE",
      uncertainty_category: "U3_AUTHORITY",
      policy_basis: authority.policy_basis,
      escalation_question,
    });
  }

  // ── Step 5: AUTO_APPROVE ───────────────────────────────────────────────────
  return respond({
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
  evidence_assessments?: EvidenceAssessment[];
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
    evidence_assessments: blueprint.evidence_assessments ?? [],
  };

  if (blueprint.escalation_question !== undefined) {
    response.escalation_question = blueprint.escalation_question;
  }

  return EvaluationResponseSchema.parse(response);
}
