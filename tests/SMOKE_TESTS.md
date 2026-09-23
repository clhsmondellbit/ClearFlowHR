# 🧪 AER Smoke Tests — 5 Case Kiểm Tra Hệ Thống

> **Mục đích:** 5 case này dùng để BTC xác nhận hệ thống đang chạy được (smoke test).
> Chạy trực tiếp từ tab **Smoke Tests** trên Dashboard hoặc bằng curl bên dưới.

---

## Cách chạy nhanh

```bash
# Khởi động server trước
pnpm run dev

# Sau đó mở http://localhost:3000 → tab "Smoke Tests" → click "Run All 5 Smoke Tests"
```

---

## S1 — Happy Path: CONFIRMED + ANNUAL + 3 ngày → AUTO_APPROVE

**Mô tả:** Nhân viên chính thức xin nghỉ phép năm 3 ngày, số dư đủ, trong hạn mức TIER_1.

**Input:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000001",
  "employee_id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d",
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

**Expected output:**
```json
{
  "outcome": "AUTO_APPROVE",
  "uncertainty_category": "NONE",
  "policy_basis": "...Article 20.1...",
  "cryptographic_receipt": "<64-char sha256 hex>"
}
```

**Pass criteria:**
- `outcome === "AUTO_APPROVE"` ✅
- `uncertainty_category === "NONE"` ✅
- `escalation_question` không tồn tại ✅
- `cryptographic_receipt` khớp regex `/^[a-f0-9]{64}$/` ✅

---

## S2 — Hard Reject: PROBATION + ANNUAL → REJECT (Article 8.2)

**Mô tả:** Nhân viên đang thử việc xin nghỉ phép năm — vi phạm rõ ràng Điều 8.2.

**Input:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000002",
  "employee_id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d",
  "employee_name": "Tran Thi B",
  "employment_status": "PROBATION",
  "leave_type": "ANNUAL",
  "start_date": "2026-10-01",
  "end_date": "2026-10-02",
  "days_requested": 2,
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

**Expected output:**
```json
{
  "outcome": "REJECT",
  "uncertainty_category": "NONE",
  "policy_basis": "Article 8.2 — Employees on probation are ineligible for paid annual leave..."
}
```

**Pass criteria:**
- `outcome === "REJECT"` ✅
- `policy_basis` chứa `"Article 8.2"` ✅
- `policy_basis` chứa `"probation"` ✅

---

## S3 — Hard Reject: RESIGNED + SICK → REJECT (Article 9.1)

**Mô tả:** Nhân viên đã nghỉ việc không thể tạo đơn nghỉ phép mới — Điều 9.1.

**Input:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000003",
  "employee_id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d",
  "employee_name": "Le Van C",
  "employment_status": "RESIGNED",
  "leave_type": "SICK",
  "start_date": "2026-10-01",
  "end_date": "2026-10-03",
  "days_requested": 3,
  "leave_balance": {
    "annual_days_remaining": 5,
    "sick_days_remaining": 30,
    "maternity_weeks_remaining": 0,
    "unpaid_days_used_ytd": 0
  },
  "attached_documents": [],
  "submitted_at": "2026-09-22T00:00:00.000Z"
}
```

**Expected output:**
```json
{
  "outcome": "REJECT",
  "uncertainty_category": "NONE",
  "policy_basis": "Article 9.1 — Resigned employees may not initiate new leave requests."
}
```

**Pass criteria:**
- `outcome === "REJECT"` ✅
- `policy_basis` chứa `"Article 9.1"` ✅

---

## S4 — Authority Escalation: CONFIRMED + ANNUAL + 8 ngày → ESCALATE U3_AUTHORITY

**Mô tả:** Số ngày nghỉ (8) vượt hạn mức TIER_1 (5 ngày) → cần Department Head duyệt.

**Input:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000004",
  "employee_id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d",
  "employee_name": "Pham Thi D",
  "employment_status": "CONFIRMED",
  "leave_type": "ANNUAL",
  "start_date": "2026-10-01",
  "end_date": "2026-10-10",
  "days_requested": 8,
  "leave_balance": {
    "annual_days_remaining": 12,
    "sick_days_remaining": 30,
    "maternity_weeks_remaining": 26,
    "unpaid_days_used_ytd": 0
  },
  "attached_documents": [],
  "submitted_at": "2026-09-22T00:00:00.000Z"
}
```

**Expected output:**
```json
{
  "outcome": "ESCALATE",
  "uncertainty_category": "U3_AUTHORITY",
  "policy_basis": "Article 20.2 — Requests exceeding 5 days require Department Head approval...",
  "escalation_question": "...Department Head...Decision: [Approve] or [Reject]?"
}
```

**Pass criteria:**
- `outcome === "ESCALATE"` ✅
- `uncertainty_category === "U3_AUTHORITY"` ✅
- `escalation_question` chứa `"Department Head"` ✅
- `escalation_question` chứa `"Decision:"` ✅
- HTTP status `202` ✅

---

## S5 — Policy Escalation: PROBATION + MATERNITY + 84 ngày → ESCALATE U2_POLICY

**Mô tả:** Nhân viên thử việc xin nghỉ thai sản → mâu thuẫn chính sách, cần HR Director xét.

**Input:**
```json
{
  "request_id": "00000000-0000-4000-a000-000000000005",
  "employee_id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d",
  "employee_name": "Hoang Thi E",
  "employment_status": "PROBATION",
  "leave_type": "MATERNITY",
  "start_date": "2026-10-01",
  "end_date": "2027-01-02",
  "days_requested": 84,
  "leave_balance": {
    "annual_days_remaining": 0,
    "sick_days_remaining": 30,
    "maternity_weeks_remaining": 26,
    "unpaid_days_used_ytd": 0
  },
  "attached_documents": [],
  "submitted_at": "2026-09-22T00:00:00.000Z"
}
```

**Expected output:**
```json
{
  "outcome": "ESCALATE",
  "uncertainty_category": "U2_POLICY",
  "policy_basis": "Article 8.2 / Article 34 — Maternity leave entitlement during probation is policy-ambiguous...",
  "escalation_question": "...Decision: [Approve as MATERNITY] or [Switch to UNPAID Leave] or [Reject]?"
}
```

**Pass criteria:**
- `outcome === "ESCALATE"` ✅
- `uncertainty_category === "U2_POLICY"` ✅
- `policy_basis` chứa `"Article 8.2"` ✅
- `escalation_question` có dạng closed question với `[...]` options ✅
- HTTP status `202` ✅

---

## Curl Commands (chạy nhanh từ terminal)

```bash
# S1 — AUTO_APPROVE
curl -s -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"request_id":"00000000-0000-4000-a000-000000000001","employee_id":"6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d","employee_name":"Nguyen Van A","employment_status":"CONFIRMED","leave_type":"ANNUAL","start_date":"2026-10-01","end_date":"2026-10-03","days_requested":3,"leave_balance":{"annual_days_remaining":10,"sick_days_remaining":30,"maternity_weeks_remaining":26,"unpaid_days_used_ytd":0},"attached_documents":[],"submitted_at":"2026-09-22T00:00:00.000Z"}' | jq .outcome

# S2 — REJECT (Art 8.2)
curl -s -X POST http://localhost:3000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"request_id":"00000000-0000-4000-a000-000000000002","employee_id":"6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4d","employee_name":"Tran Thi B","employment_status":"PROBATION","leave_type":"ANNUAL","start_date":"2026-10-01","end_date":"2026-10-02","days_requested":2,"leave_balance":{"annual_days_remaining":10,"sick_days_remaining":30,"maternity_weeks_remaining":26,"unpaid_days_used_ytd":0},"attached_documents":[],"submitted_at":"2026-09-22T00:00:00.000Z"}' | jq .outcome
```
