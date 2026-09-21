/**
 * @file workflow.ts
 * @description Human-in-the-Loop (HITL) Interrupt & Resume state machine.
 *
 * Manages the lifecycle of leave request evaluations through defined workflow states.
 * The state machine coordinates between the deterministic rules engine (src/core/rules/*)
 * and the HITL override endpoint (POST /api/v1/override).
 *
 * SAFETY BOUNDARY (AGENTS.md §2):
 *   - This file MUST NOT be modified without "Ask First" consent.
 *   - State transitions are deterministic — no LLM involvement.
 *   - The LLM is invoked only to synthesize the escalation_question text
 *     AFTER the rules engine has already determined the outcome and uncertainty category.
 *
 * NOTE: Full state persistence and LLM synthesis integration are Phase 2.
 *       This stub defines the state types and transition interface.
 */

import type { EvaluationResponse, EmployeeLeaveRequest } from "../api/routes/schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Workflow State Machine
// ─────────────────────────────────────────────────────────────────────────────

/** All possible states in the leave request evaluation lifecycle. */
export type WorkflowState =
  | "PENDING_EVALUATION"    // Request received; awaiting rules engine processing.
  | "AUTO_APPROVED"         // Rules engine determined AUTO_APPROVE; no human review needed.
  | "REJECTED"              // Rules engine determined REJECT; no human review needed.
  | "ESCALATED_AWAITING_HITL" // Rules engine ESCALATED; waiting for human reviewer input.
  | "OVERRIDE_APPROVED"     // Human reviewer approved after escalation.
  | "OVERRIDE_REJECTED"     // Human reviewer rejected after escalation.
  | "LEAVE_TYPE_SWITCHED";  // Human reviewer switched leave type after escalation.

/** An active workflow session tracking state for a single leave request. */
export interface WorkflowSession {
  request_id: string;
  decision_id: string | null;
  state: WorkflowState;
  evaluation_response: EvaluationResponse | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Transition Logic (Stub)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new workflow session for an incoming leave request.
 *
 * @param request - The validated EmployeeLeaveRequest.
 * @returns A new WorkflowSession in PENDING_EVALUATION state.
 */
export function createWorkflowSession(request: EmployeeLeaveRequest): WorkflowSession {
  const now = new Date().toISOString();
  return {
    request_id: request.request_id,
    decision_id: null,
    state: "PENDING_EVALUATION",
    evaluation_response: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Transitions a workflow session based on a completed evaluation response.
 *
 * Valid transitions:
 *   PENDING_EVALUATION → AUTO_APPROVED       (outcome: AUTO_APPROVE)
 *   PENDING_EVALUATION → REJECTED            (outcome: REJECT)
 *   PENDING_EVALUATION → ESCALATED_AWAITING_HITL (outcome: ESCALATE)
 *
 * @stub Full in-memory / DB state persistence is Phase 2.
 */
export function transitionFromEvaluation(
  session: WorkflowSession,
  response: EvaluationResponse
): WorkflowSession {
  const stateMap: Record<EvaluationResponse["outcome"], WorkflowState> = {
    AUTO_APPROVE: "AUTO_APPROVED",
    REJECT: "REJECTED",
    ESCALATE: "ESCALATED_AWAITING_HITL",
  };

  return {
    ...session,
    decision_id: response.decision_id,
    state: stateMap[response.outcome],
    evaluation_response: response,
    updated_at: new Date().toISOString(),
  };
}
