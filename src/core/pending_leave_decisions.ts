import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type {
  EmployeeLeaveRequest,
  EvaluationResponse,
  HitlOverrideRequest,
} from "../api/routes/schemas.js";
import { LeaveTypeSchema } from "../api/routes/schemas.js";
import {
  applyApprovedLeaveBalance,
  findAccountByEmployeeHash,
} from "../auth/accounts.js";

interface PendingLeaveDecision {
  decision_id: string;
  employee_id: string;
  leave_type: EmployeeLeaveRequest["leave_type"];
  days_requested: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const PendingLeaveDecisionSchema = z.object({
  decision_id: z.string().uuid(),
  employee_id: z.string().regex(/^[a-f0-9]{64}$/),
  leave_type: LeaveTypeSchema,
  days_requested: z.number().int().positive(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
}).strict();

const PendingLeaveDecisionsSchema = z.record(z.string().uuid(), PendingLeaveDecisionSchema);
const PENDING_DECISIONS_PATH = process.env["AER_PENDING_LEAVE_STATE_FILE"] ??
  resolve(process.cwd(), "data/pending-leave-decisions.json");
const pendingLeaveDecisions = new Map<string, PendingLeaveDecision>();

function persistPendingDecisions(): void {
  const state = Object.fromEntries(pendingLeaveDecisions);
  const temporaryPath = `${PENDING_DECISIONS_PATH}.${process.pid}.tmp`;

  try {
    mkdirSync(dirname(PENDING_DECISIONS_PATH), { recursive: true });
    writeFileSync(temporaryPath, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporaryPath, PENDING_DECISIONS_PATH);
  } catch {
    throw new Error("[AER/decisions] Could not persist pending leave decisions.");
  }
}

function restorePendingDecisions(): void {
  let rawState: string;
  try {
    rawState = readFileSync(PENDING_DECISIONS_PATH, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    console.warn("[AER/decisions] Pending leave decisions could not be read.");
    return;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawState);
  } catch {
    console.warn("[AER/decisions] Pending leave decisions are invalid.");
    return;
  }

  const parsed = PendingLeaveDecisionsSchema.safeParse(decoded);
  if (!parsed.success) {
    console.warn("[AER/decisions] Pending leave decisions failed validation.");
    return;
  }
  for (const [requestId, decision] of Object.entries(parsed.data)) {
    pendingLeaveDecisions.set(requestId, decision);
  }
}

restorePendingDecisions();

export type LeaveDecisionResolutionResult =
  | "RESOLVED"
  | "NOT_TRACKED"
  | "DECISION_MISMATCH"
  | "ALREADY_RESOLVED"
  | "INSUFFICIENT_BALANCE";

export function rememberPendingLeaveDecision(
  request: EmployeeLeaveRequest,
  response: EvaluationResponse
): void {
  if (response.outcome !== "ESCALATE") return;

  const previous = pendingLeaveDecisions.get(request.request_id);
  pendingLeaveDecisions.set(request.request_id, {
    decision_id: response.decision_id,
    employee_id: request.employee_id,
    leave_type: request.leave_type,
    days_requested: request.days_requested,
    status: "PENDING",
  });
  try {
    persistPendingDecisions();
  } catch (error) {
    if (previous) pendingLeaveDecisions.set(request.request_id, previous);
    else pendingLeaveDecisions.delete(request.request_id);
    throw error;
  }
}

export function resolvePendingLeaveDecision(
  request: Pick<HitlOverrideRequest, "request_id" | "decision_id" | "resolution" | "new_leave_type">
): LeaveDecisionResolutionResult {
  const pending = pendingLeaveDecisions.get(request.request_id);
  if (!pending) return "NOT_TRACKED";
  if (pending.decision_id !== request.decision_id) return "DECISION_MISMATCH";
  if (pending.status !== "PENDING") return "ALREADY_RESOLVED";

  if (request.resolution !== "REJECT") {
    const account = findAccountByEmployeeHash(pending.employee_id);
    if (!account) return "NOT_TRACKED";

    const approvedLeaveType = request.resolution === "SWITCH_LEAVE_TYPE"
      ? request.new_leave_type
      : pending.leave_type;
    if (!approvedLeaveType) return "NOT_TRACKED";

    const balanceResult = applyApprovedLeaveBalance(
      account,
      `override:${request.request_id}`,
      approvedLeaveType,
      pending.days_requested
    );
    if (balanceResult === "INSUFFICIENT") return "INSUFFICIENT_BALANCE";
  }

  const previousStatus = pending.status;
  pending.status = request.resolution === "REJECT" ? "REJECTED" : "APPROVED";
  try {
    persistPendingDecisions();
  } catch (error) {
    pending.status = previousStatus;
    throw error;
  }
  return "RESOLVED";
}
