import { describe, it, expect } from "vitest";
import { overrideRouter } from "../src/api/routes/override.js";
import { hashPii } from "../src/ledger/audit.js";
import type { Request, Response } from "express";

function createMockContext(body: any) {
  let statusCode = 200;
  let responseData: any = null;

  const req = {
    body,
  } as unknown as Request;

  const res = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(data: any) {
      responseData = data;
      return this as Response;
    },
  } as unknown as Response;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

describe("POST /api/v1/override", () => {
  const dummyDecisionId = "a0000000-0000-4000-a000-000000000001";
  const dummyRequestId = "b0000000-0000-4000-a000-000000000001";
  const reviewerHash = hashPii("HR_DIRECTOR_01");

  it("should successfully record an APPROVE resolution and return a 64-char receipt", async () => {
    const ctx = createMockContext({
      decision_id: dummyDecisionId,
      request_id: dummyRequestId,
      reviewer_id: reviewerHash,
      resolution: "APPROVE",
      reviewer_notes: "Approved after reviewing medical certificate scan.",
      override_at: new Date().toISOString(),
    });

    // Extract the route handler from router stack
    const layer = (overrideRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/override" && l.route.methods.post
    );
    expect(layer).toBeDefined();

    await layer.route.stack[0].handle(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    expect(data.decision_id).toBe(dummyDecisionId);
    expect(data.final_status).toBe("APPROVED");
    expect(data.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
    expect(data.recorded_at).toBeDefined();
  });

  it("should successfully record a REJECT resolution", async () => {
    const ctx = createMockContext({
      decision_id: dummyDecisionId,
      request_id: dummyRequestId,
      reviewer_id: reviewerHash,
      resolution: "REJECT",
      reviewer_notes: "Rejected due to lack of authentic medical stamp.",
      override_at: new Date().toISOString(),
    });

    const layer = (overrideRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/override" && l.route.methods.post
    );
    await layer.route.stack[0].handle(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    expect(data.final_status).toBe("REJECTED");
    expect(data.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should reject payload with missing new_leave_type when resolution is SWITCH_LEAVE_TYPE", async () => {
    const ctx = createMockContext({
      decision_id: dummyDecisionId,
      request_id: dummyRequestId,
      reviewer_id: reviewerHash,
      resolution: "SWITCH_LEAVE_TYPE",
      override_at: new Date().toISOString(),
    });

    const layer = (overrideRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/override" && l.route.methods.post
    );
    await layer.route.stack[0].handle(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(400);
    const data = ctx.getData();
    expect(data.error).toBe("VALIDATION_FAILED");
  });

  it("should succeed for SWITCH_LEAVE_TYPE when new_leave_type is provided", async () => {
    const ctx = createMockContext({
      decision_id: dummyDecisionId,
      request_id: dummyRequestId,
      reviewer_id: reviewerHash,
      resolution: "SWITCH_LEAVE_TYPE",
      new_leave_type: "UNPAID",
      reviewer_notes: "Switched from annual to unpaid leave for probation employee.",
      override_at: new Date().toISOString(),
    });

    const layer = (overrideRouter as any).stack.find(
      (l: any) => l.route && l.route.path === "/override" && l.route.methods.post
    );
    await layer.route.stack[0].handle(ctx.req, ctx.res);

    expect(ctx.getStatus()).toBe(200);
    const data = ctx.getData();
    expect(data.final_status).toBe("LEAVE_TYPE_SWITCHED");
    expect(data.cryptographic_receipt).toMatch(/^[a-f0-9]{64}$/);
  });
});
