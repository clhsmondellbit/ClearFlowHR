import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { USER_ACCOUNTS } from "../../auth/accounts.js";
import { type AuthenticatedRequest } from "../../auth/session.js";
import { countOverlappingDepartmentRequests } from "../../core/impact_registry.js";
import { EmployeeLeaveRequestSchema } from "./schemas.js";

export const impactRouter: IRouter = Router();

const ImpactQuerySchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
}).strict().refine((value) => value.end_date >= value.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

const ImpactAwareEvaluationSchema = EmployeeLeaveRequestSchema.extend({
  delegated_to: z.string().min(1).optional(),
});

/** Require a real manager delegate for directors before the request reaches AER evaluation. */
export function requireDirectorDelegate(req: Request, res: Response, next: NextFunction): void {
  const account = (req as AuthenticatedRequest).account;
  if (!account) {
    next();
    return;
  }

  const baseRequest = EmployeeLeaveRequestSchema.safeParse(req.body);
  if (!baseRequest.success) {
    res.status(400).json({ error: "VALIDATION_FAILED", details: baseRequest.error.flatten() });
    return;
  }

  const ownEmployeeHash = createHash("sha256").update(account.employeeId).digest("hex");
  if (account.role === "EMPLOYEE" && baseRequest.data.employee_id !== ownEmployeeHash) {
    res.status(403).json({ error: "EMPLOYEE_ACCOUNT_MISMATCH" });
    return;
  }

  const isDirectorRequestingOwnLeave = account.role === "DIRECTOR"
    && baseRequest.data.employee_id === ownEmployeeHash;
  if (!isDirectorRequestingOwnLeave) {
    next();
    return;
  }

  const parsed = ImpactAwareEvaluationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() });
    return;
  }

  const delegate = USER_ACCOUNTS.find((candidate) =>
    candidate.employeeId === parsed.data.delegated_to && candidate.role === "MANAGER",
  );
  if (!delegate) {
    res.status(422).json({ error: "AUTHORIZED_MANAGER_DELEGATE_REQUIRED" });
    return;
  }

  next();
}

impactRouter.get("/", (req: Request, res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  const account = (req as AuthenticatedRequest).account;
  if (!account) {
    res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    return;
  }

  const parsed = ImpactQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() });
    return;
  }

  const request_count = countOverlappingDepartmentRequests({
    employee_id: createHash("sha256").update(account.employeeId).digest("hex"),
    department: account.department,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
  });
  res.status(200).json({ department: account.department, request_count });
});
