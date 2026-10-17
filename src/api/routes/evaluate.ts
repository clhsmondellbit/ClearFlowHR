/**
 * @file evaluate.ts
 * @description Route handler for POST /api/v1/evaluate.
 *
 * Validates the inbound EmployeeLeaveRequest using Zod, then coordinates the
 * rules engine pipeline via the orchestrator. Returns a fully-formed EvaluationResponse.
 */

import { Router, type Request, type Response, type IRouter } from "express";
import {
  applyApprovedLeaveBalance,
  findAccountByEmployeeHash,
  toLeaveBalanceSnapshot,
} from "../../auth/accounts.js";
import { recordDepartmentLeaveRequest } from "../../core/impact_registry.js";
import { rememberPendingLeaveDecision } from "../../core/pending_leave_decisions.js";
import { EmployeeLeaveRequestSchema, type EvaluationResponse } from "./schemas.js";
import { runEvaluation } from "../../core/orchestrator.js";

export const evaluateRouter: IRouter = Router();

evaluateRouter.post("/evaluate", async (req: Request, res: Response): Promise<void> => {
  // Step 1: Validate inbound payload against Zod schema.
  const parseResult = EmployeeLeaveRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const employeeAccount = findAccountByEmployeeHash(parseResult.data.employee_id);
  const evaluationRequest = employeeAccount
    ? { ...parseResult.data, leave_balance: toLeaveBalanceSnapshot(employeeAccount) }
    : parseResult.data;

  // Use the server-side balance for every employee account tracked by AER.
  const evaluationStartedAt = Date.now();
  const response = await runEvaluation(evaluationRequest);
  console.info(
    `[AER/evaluate] Evaluation completed ` +
      `(outcome=${response.outcome}, elapsed_ms=${Date.now() - evaluationStartedAt})`
  );

  if (employeeAccount && response.outcome === "AUTO_APPROVE") {
    const balanceResult = applyApprovedLeaveBalance(
      employeeAccount,
      parseResult.data.request_id,
      parseResult.data.leave_type,
      parseResult.data.days_requested
    );
    if (balanceResult === "INSUFFICIENT") {
      res.status(409).json({ error: "LEAVE_BALANCE_CHANGED_RETRY" });
      return;
    }
  }

  if (employeeAccount && response.outcome === "ESCALATE") {
    rememberPendingLeaveDecision(evaluationRequest, response);
  }

  if (employeeAccount) {
    recordDepartmentLeaveRequest({
      request_id: parseResult.data.request_id,
      employee_id: parseResult.data.employee_id,
      department: employeeAccount.department,
      start_date: parseResult.data.start_date,
      end_date: parseResult.data.end_date,
      outcome: response.outcome,
    });
  }

  const statusCode =
    response.outcome === "REJECT" ? 200
    : response.outcome === "ESCALATE" ? 202
    : 200; // AUTO_APPROVE

  res.status(statusCode).json(response);
});

/** Re-exported for use in tests and consumers. */
export type { EvaluationResponse };
