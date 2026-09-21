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
import { HitlOverrideRequestSchema } from "./schemas.js";

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

  // Step 2: TODO (Phase 2) — verify decision_id exists and is in ESCALATED_AWAITING_HITL state.
  // Step 3: TODO (Phase 2) — apply reviewer resolution to workflow state machine.
  // Step 4: TODO (Phase 2) — generate override cryptographic receipt via audit.ts.
  // Step 5: TODO (Phase 2) — append to audit ledger with hashed reviewer_id.

  res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Phase 2 implementation pending." });
});
