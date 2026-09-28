# ClearFlowHR — Autonomous HR Escalation Referee (AER)

> **MVP Sprint 1** — Hệ thống tự động phân loại và xử lý đơn xin nghỉ phép: Auto-Approve, Reject, và Escalate (HITL).

---

## 🚀 Chạy nhanh (localhost)

```bash
# 1. Cài dependencies
pnpm install

# 2. Khởi động development server
pnpm run dev
```

Mở trình duyệt tại **http://localhost:4647** → Dashboard AER. Port có thể đổi bằng biến `PORT`.

Nếu cần gọi OpenRouter, sao chép `.env.example` thành `.env` và đặt `OPENROUTER_API_KEY`. Các thiết lập model và timeout cũng được đọc từ `.env`.

---

## 📋 Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu |
|---------|---------------------|
| Node.js | ≥ 22.x              |
| pnpm    | 12.5.1 (được ghim trong `package.json`) |

Kích hoạt Corepack để dùng phiên bản pnpm được ghim trong dự án.

---

## 📁 Kiến trúc thư mục

```
ClearFlowHR/
├── Dockerfile            # Multi-stage production image
├── .dockerignore         # Excludes local secrets and development files
├── .env.example          # Local configuration template
├── public/               # Frontend dashboard (single HTML file, no build step)
│   └── index.html
├── src/
│   ├── index.ts          # Express server entry point (default port 4647)
│   ├── api/routes/
│   │   ├── evaluate.ts   # POST /api/v1/evaluate
│   │   ├── override.ts   # POST /api/v1/override
│   │   └── schemas.ts    # Zod data contracts
│   ├── core/
│   │   ├── orchestrator.ts        # Decision pipeline controller
│   │   └── rules/
│   │       ├── eligibility.ts     # Eligibility matrix (employment status × leave type)
│   │       ├── leave_balance.ts   # Balance sufficiency checks
│   │       └── authority.ts       # Approval tier routing (TIER_1/2/3)
│   ├── ai/
│   │   ├── escalation_synthesizer.ts  # Escalation question synthesis (template fallback)
│   │   └── vlm_parser.ts              # VLM document parser
│   └── ledger/
│       └── audit.ts       # SHA-256 cryptographic receipts
└── tests/
    └── benchmark/          # 15 validation test cases
        ├── 01_auto_approve.test.ts   # Cases 01–04
        ├── 02_reject.test.ts         # Cases 05–07
        ├── 03_escalate_u2_policy.test.ts  # Cases 08–10
        ├── 04_escalate_u3_authority.test.ts  # Cases 11–13
        └── 05_edge_cases.test.ts    # Cases 14–15
```

---

## 🔌 API Reference

### `GET /health`
Kiểm tra server hoạt động.
```json
{ "status": "ok", "service": "AER — Autonomous HR Escalation Referee" }
```

---

### `POST /api/v1/evaluate`

**Request body:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000001",
  "employee_id": "<SHA-256 hex của employee ID>",
  "employee_name": "Nguyen Van A",
  "employment_status": "CONFIRMED",
  "leave_type": "ANNUAL",
  "start_date": "2026-10-01",
  "end_date": "2026-10-03",
  "days_requested": 3,
  "leave_balance": {
    "annual_days_remaining": 10,
    "sick_days_remaining": 30,
    "maternity_weeks_remaining": 26,
    "unpaid_days_used_ytd": 0
  },
  "attached_documents": [],
  "submitted_at": "2026-09-22T00:00:00.000Z"
}
```

**Response:**
```json
{
  "decision_id": "uuid-v4",
  "outcome": "AUTO_APPROVE | ESCALATE | REJECT",
  "uncertainty_category": "NONE | U1_DATA | U2_POLICY | U3_AUTHORITY",
  "policy_basis": "Article citation string",
  "escalation_question": "(only for ESCALATE)",
  "cryptographic_receipt": "<SHA-256 hex, 64 chars>",
  "evaluated_at": "ISO-8601 timestamp"
}
```

**Status codes:**
- `200` — AUTO_APPROVE hoặc REJECT
- `202` — ESCALATE (cần Human-in-the-Loop)
- `400` — Validation error (Zod)

---

### `POST /api/v1/override`

Nhận resolution của reviewer và trả về receipt SHA-256. Payload được kiểm tra bằng Zod. Xác thực danh tính reviewer và ghi ledger bền vững chưa được triển khai.

---

## 🔑 Decision Logic (Deterministic)

```
Request
  │
  ▼ Step 1: VLM Document Parse (nếu có attached_documents)
  │         → U1_DATA nếu fail/blurry → ESCALATE
  │
  ▼ Step 2: Eligibility Check (employment_status × leave_type matrix)
  │         → HARD_REJECT → REJECT (Article 8.2, 9.1)
  │         → POLICY_AMBIGUOUS → ESCALATE U2_POLICY (Article 8.2/34, 10.3)
  │
  ▼ Step 3: Leave Balance Check
  │         → Insufficient → REJECT (Article 11.1)
  │
  ▼ Step 4: Authority Tier Routing
  │         → TIER_1 (≤5 ngày, standard types) → AUTO_APPROVE
  │         → TIER_2 (6–14 ngày) → ESCALATE U3_AUTHORITY (Article 20.2)
  │         → TIER_3 (≥15 ngày, MATERNITY, PATERNITY) → ESCALATE U3_AUTHORITY (Article 20.3)
  │
  ▼ Step 5: AUTO_APPROVE
```

---

## 🧪 Chạy Tests

```bash
# Toàn bộ 15 benchmark test cases
pnpm run test:benchmark

# Một file cụ thể
pnpm vitest run tests/benchmark/01_auto_approve.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm run lint --fix
```

---

## 📊 Smoke Tests (5 case BTC kiểm tra hệ thống chạy được)

Xem chi tiết tại [`tests/SMOKE_TESTS.md`](./tests/SMOKE_TESTS.md) hoặc chạy trực tiếp từ tab **Smoke Tests** trên Dashboard.

| # | Kịch bản | Expected |
|---|----------|----------|
| S1 | CONFIRMED + ANNUAL + 3 ngày | AUTO_APPROVE |
| S2 | PROBATION + ANNUAL + 2 ngày | REJECT (Art. 8.2) |
| S3 | RESIGNED + SICK + 3 ngày | REJECT (Art. 9.1) |
| S4 | CONFIRMED + ANNUAL + 8 ngày | ESCALATE U3_AUTHORITY |
| S5 | PROBATION + MATERNITY + 84 ngày | ESCALATE U2_POLICY |

---

## 📋 Benchmark (15 case cho BTC)

Xem [`tests/BENCHMARK_CASES.md`](./tests/BENCHMARK_CASES.md) để biết định dạng input/output của tất cả 15 case.

---

## 🔐 Security Notes

- `employee_id` phải là SHA-256 hex của ID gốc (không bao giờ log PII thô).
- Mọi quyết định đều có `cryptographic_receipt` (SHA-256 digest).
- LLM chỉ được dùng để sinh ngôn ngữ cho `escalation_question` — không bao giờ tính toán nghiệp vụ.
- `leave_balance` hiện là snapshot do caller gửi lên; dịch vụ chưa giữ hoặc khấu trừ số dư bền vững.
- Các hàm ghi ledger trong `src/ledger/audit.ts` hiện là stub; receipt không thay thế lưu trữ kiểm toán bền vững.

---

## 🐳 Chạy bằng Docker

```bash
docker build -t clearflowhr .
docker run --rm -p 4647:4647 --env-file .env clearflowhr
```

Tạo `.env` từ `.env.example` trước khi chạy nếu cần cấu hình OpenRouter. Có thể đổi port bằng `-e PORT=...`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ |
| Framework | Express 5 |
| Language | TypeScript 7 |
| Validation | Zod 4 |
| Testing | Vitest 5 |
| Package Manager | pnpm |
| Frontend | Plain HTML/CSS/JS (no build step) |
