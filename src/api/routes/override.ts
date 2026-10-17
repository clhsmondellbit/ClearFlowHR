/**
 * @file override.ts
 * @description Route handler stub for POST /api/v1/override.
 *
 * Accepts a HITL reviewer's resolution for an ESCALATED decision.
 * Validates via Zod, records to audit ledger, and transitions workflow state.
 *
 * NOTE: Handler logic is a Phase 2 implementation stub.
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { HitlOverrideRequestSchema, type HitlOverrideResponse } from "./schemas.js";
import { generateOverrideReceipt, appendOverrideToLedger } from "../../ledger/audit.js";
import { resolvePendingLeaveDecision } from "../../core/pending_leave_decisions.js";

export const overrideRouter: IRouter = Router();

overrideRouter.post("/override", async (req: Request, res: Response): Promise<void> => {
  // Step 1: Validate inbound payload against Zod schema.
  const parseResult = HitlOverrideRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const { decision_id, reviewer_id, resolution } = parseResult.data;
  const decisionResolution = resolvePendingLeaveDecision(parseResult.data);
  if (decisionResolution === "DECISION_MISMATCH") {
    res.status(409).json({ error: "DECISION_REQUEST_MISMATCH" });
    return;
  }
  if (decisionResolution === "ALREADY_RESOLVED") {
    res.status(409).json({ error: "LEAVE_REQUEST_ALREADY_RESOLVED" });
    return;
  }
  if (decisionResolution === "INSUFFICIENT_BALANCE") {
    res.status(409).json({ error: "INSUFFICIENT_LEAVE_BALANCE" });
    return;
  }

  const recorded_at = new Date().toISOString();

  const final_status: HitlOverrideResponse["final_status"] =
    resolution === "APPROVE"
      ? "APPROVED"
      : resolution === "REJECT"
      ? "REJECTED"
      : "LEAVE_TYPE_SWITCHED";

  const cryptographic_receipt = generateOverrideReceipt({
    decision_id,
    final_status,
    recorded_at,
  });

  const response: HitlOverrideResponse = {
    decision_id,
    final_status,
    cryptographic_receipt,
    recorded_at,
  };

  // Append to audit ledger (PII is hashed)
  await appendOverrideToLedger(response, reviewer_id);

  res.status(200).json(response);
});

