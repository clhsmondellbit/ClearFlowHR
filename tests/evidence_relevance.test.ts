import { describe, expect, it, vi } from "vitest";
import { runEvaluation } from "../src/core/orchestrator.js";
import { makeRequest } from "./benchmark/helpers.js";

vi.mock("../src/ai/vlm_parser.js", () => ({
  analyzeAttachments: async (documents: Array<{ document_id: string; form_type: string }>) =>
    documents.map((document) => ({
      success: true as const,
      result: {
        document_id: document.document_id,
        detected_document_type: document.form_type === "UNKNOWN"
          ? "UNKNOWN" as const
          : "OTHER" as const,
        red_stamp_detected: false,
        signature_detected: false,
        confidence_score: 0.95,
        extracted_issue_date: null,
        extracted_issuing_authority: null,
      },
    })),
}));

function makeEvidence(formType: string) {
  return {
    document_id: formType === "UNKNOWN"
      ? "d0000000-0000-4000-a000-000000000022"
      : "d0000000-0000-4000-a000-000000000021",
    form_type: formType,
    content_ref: "data:image/png;base64,AA==",
    mime_type: "image/png" as const,
  };
}

describe("sick leave evidence relevance", () => {
  it("rejects a document classified as unrelated to sick leave", async () => {
    const result = await runEvaluation(makeRequest({
      leave_type: "SICK",
      attached_documents: [makeEvidence("OTHER")],
    }));

    expect(result.outcome).toBe("REJECT");
    expect(result.policy_basis).toContain("not medical evidence for sick leave");
    expect(result.evidence_assessments[0]?.relevance).toBe("NOT_RELEVANT");
  });

  it("routes an unclassified document to an authorized reviewer", async () => {
    const result = await runEvaluation(makeRequest({
      leave_type: "SICK",
      attached_documents: [makeEvidence("UNKNOWN")],
    }));

    expect(result.outcome).toBe("ESCALATE");
    expect(result.uncertainty_category).toBe("U1_DATA");
    expect(result.policy_basis).toContain("authorized reviewer");
    expect(result.evidence_assessments[0]?.relevance).toBe("UNKNOWN");
  });
});
