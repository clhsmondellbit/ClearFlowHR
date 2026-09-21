## 1. Project Overview

Project: Autonomous HR Escalation Referee (AER).
Function: A middleware system that automatically processes and arbitrates leave, sick, and maternity requests from the HRM system. AER acts as a gatekeeper, performing automatic approvals with low latency (< 10ms) for valid cases and automatically escalating exceptions via a single-turn Human-in-the-Loop interaction protocol.
Tech Stack: Node.js, TypeScript, Express, Zod (Schema Validation), Qwen2.5-VL (Local VLM OCR), and SHA-256 hashing for the audit ledger.

## 2. Scope and Safety Boundaries

* **Always:** Update or write new unit tests in the `tests/` directory when altering any deterministic logic related to leave balances. All API payloads must pass through Zod schema validation.


* **Ask first:** Before installing new dependencies (especially third-party AI or image processing libraries), modifying the State Machine flow in `src/core/workflow.ts`, or changing the `EmployeeLeaveRequest` schema.


* **Never:** Absolutely DO NOT use LLMs to calculate leave balances, verify labor laws, or determine authority limits. LLMs are strictly reserved for synthesizing language to generate escalation questions. Do not log personally identifiable information (PII) in plain text without SHA-256 hashing. Do not modify or delete the sample JSON data in the `tests/benchmark/` directory.



## 3. Runnable Command Sequence

Use these exact commands. It is mandatory to run local tests and linters after any changes affecting the arbitration logic:

* Package Manager: `pnpm` (Do NOT use npm or yarn).


* Install dependencies: `pnpm install`
* Type check: `pnpm tsc --noEmit`
* Run linting: `pnpm run lint --fix`
* Run validation test (15-case Benchmark): `pnpm run test:benchmark`
* Run a specific single test: `pnpm vitest run path/to/file.test.ts`

* Start dev server: `pnpm run dev`

## 4. Repository Architecture Wayfinding

* `src/api/routes`: Contains RESTful endpoints (POST `/api/v1/evaluate`, POST `/api/v1/override`).


* `src/core/rules`: Deterministic Rules Engine. This is the core logic containing leave balance calculations and authority checks.
* `src/core/workflow.ts`: Manages the Human-in-the-Loop (Interrupt & Resume) flow.


* `src/ai/vlm_parser.ts`: Local Vision-Language Model module. Responsible for detecting red stamps and signatures on C65-HD forms.


* `src/ledger/audit.ts`: Handles Ed25519/SHA-256 hash generation for cryptographic receipts of all actions.


* `tests/benchmark/`: Stores 15 independent validation cases for evaluator benchmarking.

## 5. Style Examples and Dos/Don'ts

### Deterministic Data Contracts

Always define clear structures using Zod to ensure the consistency of the 3-dimensional uncertainty state.

```typescript
// Do: Strictly format the Zod Schema according to the Uncertainty specifications
export const EvaluationResponseSchema = z.object({
  decision_id: z.string().uuid(),
  outcome: z.enum(["AUTO_APPROVE", "ESCALATE", "REJECT"]),
  uncertainty_category: z.enum(["U1_DATA", "U2_POLICY", "U3_AUTHORITY", "NONE"]),
  policy_basis: z.string(),
  escalation_question: z.string().optional(),
  cryptographic_receipt: z.string()
});

```

### Contextual Framing for HITL (Escalation Questions)

* **Do:** Frame single-turn closed questions: "Employee Nguyen Van A is requesting annual leave but is on probation (Violation of Article 8.2). Decision: [Switch to Unpaid Leave] or [Reject]?".


* **Don't:** Do not use open-ended questions that ask the AI or human for general opinions: "What do you think about this case, please provide your feedback?".



### Failure Handling

* If the VLM times out or the image is too blurry for layout analysis, the workflow MUST NOT fail open. The state must transition to `ESCALATE` with the reason `U1_DATA` (Data Uncertainty) and request original documents. Do not use LLMs to impute missing dates.