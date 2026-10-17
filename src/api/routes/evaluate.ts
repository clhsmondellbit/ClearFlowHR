/**
 * @file evaluate.ts
 * @description Route handler for POST /api/v1/evaluate.
 *
 * Validates the inbound EmployeeLeaveRequest using Zod, then coordinates the
 * rules engine pipeline via the orchestrator. Returns a fully-formed EvaluationResponse.
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { createHash } from "node:crypto";
import { type AuthenticatedRequest } from "../../auth/session.js";
import { recordDepartmentLeaveRequest } from "../../core/impact_registry.js";
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

  // Step 2–5: Run the full deterministic evaluation pipeline via orchestrator.
  const response = await runEvaluation(parseResult.data);

  const account = (req as AuthenticatedRequest).account;
  const ownEmployeeHash = account
    ? createHash("sha256").update(account.employeeId).digest("hex")
    : "";
  if (account && parseResult.data.employee_id === ownEmployeeHash) {
    recordDepartmentLeaveRequest({
      request_id: parseResult.data.request_id,
      employee_id: parseResult.data.employee_id,
      department: account.department,
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
