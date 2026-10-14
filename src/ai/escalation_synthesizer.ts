/**
 * @file escalation_synthesizer.ts
 * @description LLM escalation question synthesizer via OpenRouter.
 *
 * THIS IS THE ONLY MODULE WHERE AN LLM IS PERMITTED FOR LANGUAGE GENERATION.
 *
 * The LLM receives a pre-computed policy_basis and uncertainty_category
 * (determined entirely by the deterministic rules engine) and synthesizes
 * ONLY the natural language text of the escalation question.
 *
 * The LLM MUST NOT:
 *   - Change the outcome, uncertainty_category, or policy_basis.
 *   - Perform any leave balance calculation.
 *   - Interpret or verify labor laws.
 *   - Impute missing dates or data.
 *
 * AGENTS.md §5 Style:
 *   - Output must be a single-turn CLOSED question.
 *   - Example: "Employee X is requesting Y leave but Z (Violation of Article N.N).
 *     Decision: [Option A] or [Option B]?"
 *
 * Fallback: If OPENROUTER_API_KEY is absent or the API call fails, the
 * deterministic template is used — the system remains fully functional offline.
 */

import type { UncertaintyCategory, LeaveType } from "../api/routes/schemas.js";
import type { ApprovalTier } from "../core/rules/authority.js";
import {
  callOpenRouter,
  createOpenRouterModelRoute,
  getApiKey,
  getOpenRouterFailureSummary,
} from "./openrouter_client.js";

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface EscalationSynthesisInput {
  employee_name: string;
  leave_type: LeaveType;
  days_requested: number;
  policy_basis: string;
  uncertainty_category: UncertaintyCategory;
  required_tier?: ApprovalTier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-based synthesizer (deterministic fallback — no LLM runtime required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-uncertainty-category question templates.
 * These produce HITL-compliant closed questions per AGENTS.md §5.
 * LLM synthesis will enrich language quality while keeping the same structure.
 */
const TEMPLATES: Record<
  Exclude<UncertaintyCategory, "NONE">,
  (input: EscalationSynthesisInput) => string
> = {
  U1_DATA: (i) =>
    `Employee ${i.employee_name} has submitted a ${i.leave_type} leave request ` +
    `(${i.days_requested} day(s)), but the attached supporting document could not be verified. ` +
    `Reason: ${i.policy_basis}. ` +
    `Decision: [Request Original Documents and Resubmit] or [Reject Request]?`,

  U2_POLICY: (i) =>
    `Employee ${i.employee_name} is requesting ${i.leave_type} leave ` +
    `(${i.days_requested} day(s)), but policy eligibility is ambiguous. ` +
    `Policy conflict: ${i.policy_basis}. ` +
    `Decision: [Approve as ${i.leave_type}] or [Switch to UNPAID Leave] or [Reject]?`,

  U3_AUTHORITY: (i) => {
    const tierLabel: Record<ApprovalTier, string> = {
      TIER_1_MANAGER: "Direct Manager",
      TIER_2_DEPT_HEAD: "Department Head",
      TIER_3_HR_DIRECTOR: "HR Director",
    };
    const tier = i.required_tier ? tierLabel[i.required_tier] : "HR Director";
    return (
      `Employee ${i.employee_name} is requesting ${i.leave_type} leave ` +
      `(${i.days_requested} day(s)), which requires ${tier} approval. ` +
      `Authority basis: ${i.policy_basis}. ` +
      `Decision: [Approve] or [Reject]?`
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LLM synthesis via OpenRouter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Model for escalation question language enrichment.
 * A text-only model is sufficient — no vision capability needed here.
 */
function getSynthesisModel(): string {
  return process.env["SYNTH_MODEL"] ?? process.env["AI_MODEL"] ?? "gpt-6-luna";
}

function getSynthesisModelRoute() {
  return createOpenRouterModelRoute(
    getSynthesisModel(),
    process.env["SYNTH_FALLBACK_MODELS"]
  );
}

const SYNTH_SYSTEM_PROMPT = `\
You are a professional HR escalation assistant. Your ONLY task is to rewrite the provided \
escalation question in clear, concise, professional English.

Rules you MUST follow:
1. Rewrite only the text before the final Decision clause.
2. Copy the entire final Decision clause exactly as provided, including every option.
3. Preserve all policy citations exactly as written.
4. Keep the result as a single closed question.
5. Do NOT change the outcome, options, or policy citation.
6. Do NOT add new information, opinions, or recommendations.
7. Do NOT calculate leave balances or interpret labor laws.
8. Output ONLY the rewritten question — no preamble, no explanation.`;

let invalidOutputWarningLogged = false;

function validateAndPreserveDecisionClause(
  generatedText: string,
  templateQuestion: string
): string | null {
  const decisionClauseStart = templateQuestion.lastIndexOf("Decision:");
  if (decisionClauseStart < 0) return null;

  const decisionClause = templateQuestion.slice(decisionClauseStart);
  const marker = /\bdecision\b\s*[:：—-]?/i.exec(generatedText);
  const firstOption = generatedText.indexOf("[");
  const prefixEnd = marker?.index ?? firstOption;
  if (prefixEnd <= 0) return null;

  const prefix = generatedText.slice(0, prefixEnd).trim().replace(/[\s.,;:!?-]+$/, "");
  const requiredOptions = decisionClause.match(/\[[^\]]+\]/g) ?? [];
  const requiredCitations = templateQuestion.match(/\bArticle\s+[\d.]+(?:\s*\([^)]*\))?/gi) ?? [];

  if (
    !prefix ||
    requiredOptions.length === 0 ||
    !requiredOptions.every((option) => generatedText.includes(option)) ||
    !requiredCitations.every((citation) => generatedText.includes(citation))
  ) {
    return null;
  }

  return `${prefix}. ${decisionClause}`;
}

/**
 * Attempts to enrich the template question via OpenRouter.
 * Returns the template verbatim if the API is unavailable or fails.
 */
async function enrichWithLlm(
  templateQuestion: string,
  input: EscalationSynthesisInput
): Promise<string> {
  try {
    const response = await callOpenRouter(
      {
        ...getSynthesisModelRoute(),
        messages: [
          { role: "system", content: SYNTH_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Rewrite only the wording before the final Decision clause. Copy that clause exactly. ` +
              `Rewrite the following HR escalation question for employee "${input.employee_name}" ` +
              `(${input.leave_type} leave, ${input.days_requested} day(s), ` +
              `uncertainty: ${input.uncertainty_category}):\n\n${templateQuestion}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
        reasoning: { enabled: false },
      },
      8_000 // timeout for enrichment
    );

    const choice = response.choices[0];
    let enriched = choice?.message?.content?.trim() ?? "";
    // Remove any <think>...</think> reasoning blocks from modern reasoning models
    enriched = enriched.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    const validatedQuestion = validateAndPreserveDecisionClause(enriched, templateQuestion);
    if (validatedQuestion) return validatedQuestion;

    if (!invalidOutputWarningLogged) {
      console.warn(
        "[AER/escalation_synthesizer] LLM rewrite did not preserve decision options or policy citations; " +
          `using template fallback (finish_reason=${choice?.finish_reason ?? "unknown"}, ` +
          `reasoning_tokens=${response.usage?.completion_tokens_details?.reasoning_tokens ?? 0})`
      );
      invalidOutputWarningLogged = true;
    }
    return templateQuestion;
  } catch (err) {
    const failureSummary = getOpenRouterFailureSummary(err);
    console.warn(
      "[AER/escalation_synthesizer] LLM enrichment unavailable (" +
        failureSummary +
        ") — using template fallback"
    );
    return templateQuestion;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthesizes a single-turn HITL escalation question.
 *
 * Flow:
 *   1. Build the deterministic template question (always done first).
 *   2. If in test suite (Vitest) or offline, return the deterministic template immediately (< 1ms).
 *   3. If OPENROUTER_API_KEY is set in dev/prod, attempt LLM language enrichment.
 *   4. If LLM fails or format is invalid, return the template verbatim.
 *
 * The question text is the ONLY LLM output surface in the entire AER system.
 * All outcome logic has been decided before this function is called.
 *
 * @param input - Pre-computed escalation context from the rules engine.
 * @returns A closed escalation question string ready for HITL display.
 */
export async function synthesizeEscalationQuestion(
  input: EscalationSynthesisInput
): Promise<string> {
  // Safety guard: NONE uncertainty should never reach the synthesizer.
  if (input.uncertainty_category === "NONE") {
    throw new Error(
      "[AER] synthesizeEscalationQuestion called with uncertainty_category=NONE. " +
        "This is a programming error — escalation questions are only generated for ESCALATE outcomes."
    );
  }

  const template = TEMPLATES[input.uncertainty_category];
  const templateQuestion = template(input);

  // During automated unit/benchmark testing or when offline, use the deterministic template immediately
  if (process.env["NODE_ENV"] === "test" || Boolean(process.env["VITEST"]) || !getApiKey()) {
    return templateQuestion;
  }

  // Attempt LLM enrichment — always falls back to template on failure
  return enrichWithLlm(templateQuestion, input);
}
