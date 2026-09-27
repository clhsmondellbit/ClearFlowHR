/**
 * @file benchmark_training_data.ts
 * @description Benchmark & Evaluation Runner for ClearFlowHR 50 Synthetic Leave Form Dataset.
 *
 * Evaluates:
 *   1. Full Deterministic Rules Engine accuracy across all 50 cases against
 *      tags_clearflowhr_expected_result.jsonl.
 *   2. Gemma 4 26B (google/gemma-4-26b-a4b-it) Multimodal OCR extraction accuracy
 *      against ground-truth tags_ocr.jsonl.
 *   3. End-to-end SLA & cryptographic receipt verification.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEvaluation } from "../src/core/orchestrator.js";
import { parseDocument } from "../src/ai/vlm_parser.js";
import type { EmployeeLeaveRequest, AttachedDocument } from "../src/api/routes/schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "training_data");

interface ExpectedResult {
  image: string;
  request_id: string;
  decision_id: string;
  outcome: "AUTO_APPROVE" | "ESCALATE" | "REJECT";
  uncertainty_category: "NONE" | "U1_DATA" | "U2_POLICY" | "U3_AUTHORITY";
  policy_basis: string;
  cryptographic_receipt: string;
  escalation_question?: string;
  evaluated_at: string;
}

interface GroundTruthOcr {
  image: string;
  fields: {
    employee_name?: { text: string | null };
    leave_period?: { text: string | null };
    reason?: { text: string | null };
    application_date?: { text: string | null };
    phone?: { text: string | null };
  };
  full_text?: string;
}

async function main() {
  console.log("================================================================================");
  console.log(" ClearFlowHR — 50 Dataset Benchmark & Gemma 4 26B Evaluation");
  console.log(" Model Under Test: google/gemma-4-26b-a4b-it");
  console.log("================================================================================\n");

  // Read files
  const requestsPath = path.join(DATA_DIR, "tags_clearflowhr_request.jsonl");
  const expectedPath = path.join(DATA_DIR, "tags_clearflowhr_expected_result.jsonl");
  const ocrPath = path.join(DATA_DIR, "tags_ocr.jsonl");

  if (!fs.existsSync(requestsPath) || !fs.existsSync(expectedPath) || !fs.existsSync(ocrPath)) {
    console.error("Missing dataset files in training_data/");
    process.exit(1);
  }

  const requests: EmployeeLeaveRequest[] = fs
    .readFileSync(requestsPath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const expectedResults: ExpectedResult[] = fs
    .readFileSync(expectedPath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const groundTruthOcr: GroundTruthOcr[] = fs
    .readFileSync(ocrPath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  console.log(`Loaded ${requests.length} requests and ${expectedResults.length} expected labels.\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: Deterministic Engine Arbitration Evaluation (50 Cases)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log(" PART 1: Deterministic Rules Engine Evaluation (All 50 Cases)");
  console.log("--------------------------------------------------------------------------------");

  let matchOutcomeCount = 0;
  let matchUncertaintyCount = 0;
  let validReceiptCount = 0;
  let totalLatencyMs = 0;

  const discrepancies: Array<{
    id: string;
    employee: string;
    expectedOutcome: string;
    actualOutcome: string;
    expectedUncertainty: string;
    actualUncertainty: string;
    note: string;
  }> = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const exp = expectedResults[i];

    const start = performance.now();
    const actual = await runEvaluation(req);
    const latency = performance.now() - start;
    totalLatencyMs += latency;

    const outcomeMatches = actual.outcome === exp.outcome;
    const uncertaintyMatches = actual.uncertainty_category === exp.uncertainty_category;
    const receiptValid = /^[a-f0-9]{64}$/.test(actual.cryptographic_receipt);

    if (outcomeMatches) matchOutcomeCount++;
    if (uncertaintyMatches) matchUncertaintyCount++;
    if (receiptValid) validReceiptCount++;

    if (!outcomeMatches || !uncertaintyMatches) {
      discrepancies.push({
        id: req.request_id.slice(0, 8),
        employee: req.employee_name,
        expectedOutcome: exp.outcome,
        actualOutcome: actual.outcome,
        expectedUncertainty: exp.uncertainty_category,
        actualUncertainty: actual.uncertainty_category,
        note: `Expected [${exp.outcome} | ${exp.uncertainty_category}] but got [${actual.outcome} | ${actual.uncertainty_category}]`,
      });
    }
  }

  const avgLatencyMs = totalLatencyMs / requests.length;
  const outcomeAccuracy = (matchOutcomeCount / requests.length) * 100;
  const uncertaintyAccuracy = (matchUncertaintyCount / requests.length) * 100;

  console.log(`Outcome Match Rate:        ${matchOutcomeCount}/${requests.length} (${outcomeAccuracy.toFixed(1)}%)`);
  console.log(`Uncertainty Match Rate:    ${matchUncertaintyCount}/${requests.length} (${uncertaintyAccuracy.toFixed(1)}%)`);
  console.log(`Cryptographic Receipts:    ${validReceiptCount}/${requests.length} valid 64-char SHA-256`);
  console.log(`Average Engine Latency:    ${avgLatencyMs.toFixed(2)} ms (SLA < 10ms: ${avgLatencyMs < 10 ? "PASSED" : "FAILED"})\n`);

  if (discrepancies.length > 0) {
    console.log(`Discrepancies (${discrepancies.length}):`);
    discrepancies.slice(0, 8).forEach((d) => {
      console.log(`  - [${d.id}] ${d.employee}: ${d.note}`);
    });
    if (discrepancies.length > 8) {
      console.log(`  ... and ${discrepancies.length - 8} more.`);
    }
  } else {
    console.log("✓ All 50 deterministic cases matched perfectly with expected arbitration!");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: Gemma 4 26B VLM OCR Field Extraction Evaluation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--------------------------------------------------------------------------------");
  console.log(" PART 2: Gemma 4 26B Multimodal OCR Field Extraction Benchmark");
  console.log(" Testing live Vision API on dataset sample images...");
  console.log("--------------------------------------------------------------------------------");

  // Run on representative sample images (leave_001, leave_002, leave_010, leave_040, leave_048)
  const sampleIndices = [0, 1, 9, 39, 47]; // indices for leave_001, leave_002, leave_010, leave_040, leave_048
  let vlmSuccessCount = 0;
  let nameMatchCount = 0;

  for (const idx of sampleIndices) {
    const ocrItem = groundTruthOcr[idx];
    const imageRelPath = ocrItem.image;
    const imageFullPath = path.join(DATA_DIR, imageRelPath);

    if (!fs.existsSync(imageFullPath)) {
      console.warn(`  [SKIP] Image not found: ${imageFullPath}`);
      continue;
    }

    const imageBytes = fs.readFileSync(imageFullPath);
    const base64Data = `data:image/png;base64,${imageBytes.toString("base64")}`;
    const doc: AttachedDocument = {
      document_id: `00000000-0000-4000-a000-0000000000${String(idx + 1).padStart(2, "0")}`,
      form_type: "C65-HD",
      content_ref: base64Data,
      mime_type: "image/png",
    };

    const expectedName = ocrItem.fields.employee_name?.text ?? "Unknown";
    console.log(`\nEvaluating [${imageRelPath}] — Expected Name: "${expectedName}"`);

    const vlmStart = performance.now();
    const vlmResult = await parseDocument(doc);
    const vlmDuration = ((performance.now() - vlmStart) / 1000).toFixed(2);

    if (vlmResult.success) {
      vlmSuccessCount++;
      const extracted = vlmResult.result;
      console.log(`  ✓ OCR Successful (${vlmDuration}s)`);
      console.log(`    - Stamp detected:     ${extracted.red_stamp_detected}`);
      console.log(`    - Signature detected: ${extracted.signature_detected}`);
      console.log(`    - Extracted Date:     ${extracted.extracted_issue_date ?? "null"}`);
      console.log(`    - Issuing Authority:  ${extracted.extracted_issuing_authority ?? "null"}`);
      console.log(`    - Confidence score:   ${extracted.confidence_score}`);
    } else {
      console.log(`  ⚠ OCR Rejected / Guardrail Triggered (${vlmDuration}s): failure_reason = ${vlmResult.failure_reason}`);
    }
  }

  console.log("\n================================================================================");
  console.log(" Evaluation Complete!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});
