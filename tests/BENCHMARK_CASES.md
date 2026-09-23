# 📋 AER Benchmark — 15 Test Cases (Format Reference cho BTC)

> **Mục đích:** Tài liệu này giúp BTC hiểu **định dạng chung** của input/output mà hệ thống xử lý,
> từ đó tự tạo thêm test case ngoài theo cùng format.

---

## Format chung của một Test Case

### Input (POST /api/v1/evaluate)

| Field | Type | Bắt buộc | Ví dụ |
|-------|------|----------|-------|
| `request_id` | UUID v4 string | ✅ | `"00000000-0000-4000-a000-000000000001"` |
| `employee_id` | SHA-256 hex (64 chars) | ✅ | `"6b86b273..."` |
| `employee_name` | string (1–120 chars) | ✅ | `"Nguyen Van A"` |
| `employment_status` | `CONFIRMED \| PROBATION \| CONTRACT \| RESIGNED` | ✅ | `"CONFIRMED"` |
| `leave_type` | `ANNUAL \| SICK \| MATERNITY \| PATERNITY \| UNPAID \| COMPASSIONATE` | ✅ | `"ANNUAL"` |
| `start_date` | YYYY-MM-DD | ✅ | `"2026-10-01"` |
| `end_date` | YYYY-MM-DD | ✅ | `"2026-10-03"` |
| `days_requested` | integer > 0 | ✅ | `3` |
| `leave_balance.annual_days_remaining` | integer ≥ 0 | ✅ | `10` |
| `leave_balance.sick_days_remaining` | integer ≥ 0 | ✅ | `30` |
| `leave_balance.maternity_weeks_remaining` | integer ≥ 0 | ✅ | `26` |
| `leave_balance.unpaid_days_used_ytd` | integer ≥ 0 | ✅ | `0` |
| `attached_documents` | array (có thể rỗng `[]`) | ✅ | `[]` |
| `submitted_at` | ISO 8601 datetime | ✅ | `"2026-09-22T00:00:00.000Z"` |

### Output (Response)

| Field | Type | Luôn có | Mô tả |
|-------|------|---------|-------|
| `decision_id` | UUID v4 | ✅ | ID duy nhất của quyết định |
| `outcome` | `AUTO_APPROVE \| ESCALATE \| REJECT` | ✅ | Kết quả xử lý |
| `uncertainty_category` | `NONE \| U1_DATA \| U2_POLICY \| U3_AUTHORITY` | ✅ | Loại không chắc chắn |
| `policy_basis` | string | ✅ | Điều khoản chính sách áp dụng |
| `escalation_question` | string | Chỉ khi `ESCALATE` | Câu hỏi closed-question cho HITL |
| `cryptographic_receipt` | SHA-256 hex (64 chars) | ✅ | Biên lai mật mã |
| `evaluated_at` | ISO 8601 datetime | ✅ | Thời điểm xử lý |

**HTTP Status:**
- `200` → `AUTO_APPROVE` hoặc `REJECT`
- `202` → `ESCALATE`
- `400` → Validation error

---

## Ma trận Quyết định

| Employment Status | Leave Type | Days | Expected Outcome | Category |
|------------------|-----------|------|-----------------|----------|
| CONFIRMED | ANNUAL/SICK/UNPAID/COMPASSIONATE | ≤ 5 | AUTO_APPROVE | NONE |
| CONFIRMED | ANNUAL/SICK | 6–14 | ESCALATE | U3_AUTHORITY |
| CONFIRMED | ANNUAL/SICK/UNPAID | ≥ 15 | ESCALATE | U3_AUTHORITY |
| CONFIRMED | MATERNITY | bất kỳ | ESCALATE | U3_AUTHORITY |
| CONFIRMED | PATERNITY | bất kỳ | ESCALATE | U3_AUTHORITY |
| CONFIRMED | ANNUAL | bất kỳ | REJECT nếu thiếu số dư | NONE |
| PROBATION | ANNUAL | bất kỳ | REJECT (Art. 8.2) | NONE |
| PROBATION | SICK/UNPAID/COMPASSIONATE | ≤ 5 | AUTO_APPROVE | NONE |
| PROBATION | MATERNITY/PATERNITY | bất kỳ | ESCALATE | U2_POLICY |
| CONTRACT | ANNUAL/SICK/UNPAID | ≤ 5 | AUTO_APPROVE | NONE |
| CONTRACT | MATERNITY/PATERNITY | bất kỳ | ESCALATE | U2_POLICY |
| RESIGNED | tất cả | bất kỳ | REJECT (Art. 9.1) | NONE |

---

## Case 01 — AUTO_APPROVE: CONFIRMED + ANNUAL + 3 ngày

```
Employment: CONFIRMED | Leave: ANNUAL | Days: 3 | Balance: 10 ngày còn
Expected: AUTO_APPROVE | Category: NONE | Policy: Article 20.1
```

**Lý do:** Nhân viên chính thức, số dư đủ, 3 ngày ≤ 5 ngày (TIER_1 Manager).

---

## Case 02 — AUTO_APPROVE: CONFIRMED + SICK + 3 ngày

```
Employment: CONFIRMED | Leave: SICK | Days: 3 | Balance: 30 ngày còn
Expected: AUTO_APPROVE | Category: NONE
```

**Lý do:** Nghỉ ốm trong phạm vi tự động duyệt.

---

## Case 03 — AUTO_APPROVE: CONFIRMED + UNPAID + 2 ngày

```
Employment: CONFIRMED | Leave: UNPAID | Days: 2
Expected: AUTO_APPROVE | Category: NONE | Policy: Article 16.1
```

**Lý do:** Nghỉ không lương không có giới hạn số dư, TIER_1.

---

## Case 04 — AUTO_APPROVE: CONFIRMED + COMPASSIONATE + 3 ngày

```
Employment: CONFIRMED | Leave: COMPASSIONATE | Days: 3
Expected: AUTO_APPROVE | Category: NONE
```

**Lý do:** Nghỉ tang lễ được phép toàn bộ trạng thái nhân viên.

---

## Case 05 — REJECT: PROBATION + ANNUAL (Article 8.2)

```
Employment: PROBATION | Leave: ANNUAL | Days: 2
Expected: REJECT | Category: NONE | Policy: Article 8.2
```

**Lý do:** Nhân viên thử việc không được nghỉ phép năm — vi phạm Điều 8.2 (hard rule).

**escalation_question:** không có (REJECT không cần HITL)

---

## Case 06 — REJECT: RESIGNED + SICK (Article 9.1)

```
Employment: RESIGNED | Leave: SICK | Days: 3
Expected: REJECT | Category: NONE | Policy: Article 9.1
```

**Lý do:** Nhân viên đã nghỉ việc không thể tạo đơn nghỉ phép mới.

---

## Case 07 — REJECT: Insufficient Balance

```
Employment: CONFIRMED | Leave: ANNUAL | Days: 5 | Balance: 2 ngày còn (thiếu 3)
Expected: REJECT | Category: NONE | Policy: Article 11.1 (shortfall)
```

**Lý do:** Số dư nghỉ phép không đủ — hệ thống từ chối tự động.

---

## Case 08 — ESCALATE U2_POLICY: PROBATION + MATERNITY

```
Employment: PROBATION | Leave: MATERNITY | Days: 84
Expected: ESCALATE | Category: U2_POLICY | Policy: Article 8.2 / Article 34
```

**Lý do:** Xung đột chính sách — Luật Lao động đảm bảo quyền thai sản nhưng nội quy hạn chế quyền lợi thử việc.

**escalation_question mẫu:**
> "Employee Nguyen Van A is requesting MATERNITY leave (84 day(s)), but policy eligibility is ambiguous. Policy conflict: Article 8.2 / Article 34 — Maternity leave entitlement during probation is policy-ambiguous... Decision: [Approve as MATERNITY] or [Switch to UNPAID Leave] or [Reject]?"

---

## Case 09 — ESCALATE U2_POLICY: PROBATION + PATERNITY

```
Employment: PROBATION | Leave: PATERNITY | Days: 5
Expected: ESCALATE | Category: U2_POLICY | Policy: Article 8.2 / Article 34.2
```

**Lý do:** Tương tự Case 08, dành cho nghỉ thai sản bố.

---

## Case 10 — ESCALATE U2_POLICY: CONTRACT + MATERNITY

```
Employment: CONTRACT | Leave: MATERNITY | Days: 112
Expected: ESCALATE | Category: U2_POLICY | Policy: Article 10.3
```

**Lý do:** Nhân viên hợp đồng cần xác minh thời gian đóng BHXH để xác định quyền hưởng thai sản.

---

## Case 11 — ESCALATE U3_AUTHORITY: CONFIRMED + ANNUAL + 8 ngày (TIER_2)

```
Employment: CONFIRMED | Leave: ANNUAL | Days: 8 | Balance: 12 còn
Expected: ESCALATE | Category: U3_AUTHORITY | Policy: Article 20.2
```

**Lý do:** 8 ngày > 5 ngày (TIER_1 limit) → cần Department Head duyệt.

**escalation_question mẫu:**
> "Employee Pham Thi D is requesting ANNUAL leave (8 day(s)), which requires Department Head approval. Authority basis: Article 20.2... Decision: [Approve] or [Reject]?"

---

## Case 12 — ESCALATE U3_AUTHORITY: CONFIRMED + SICK + 20 ngày (TIER_3)

```
Employment: CONFIRMED | Leave: SICK | Days: 20 | Balance: 30 còn
Expected: ESCALATE | Category: U3_AUTHORITY | Policy: Article 20.3
```

**Lý do:** 20 ngày > 14 ngày (TIER_2 limit) → cần HR Director duyệt.

**escalation_question** chứa `"HR Director"`.

---

## Case 13 — ESCALATE U3_AUTHORITY: CONFIRMED + MATERNITY (luôn TIER_3)

```
Employment: CONFIRMED | Leave: MATERNITY | Days: 126 | Balance: 26 tuần còn
Expected: ESCALATE | Category: U3_AUTHORITY | Policy: Article 20.3
```

**Lý do:** MATERNITY luôn yêu cầu HR Director ký duyệt bất kể số ngày.

---

## Case 14 — Edge Case: Determinism của Cryptographic Receipt

```
Input: CONFIRMED + ANNUAL + 2 ngày (giống nhau, gọi 2 lần song song)
Expected: Cả 2 đều AUTO_APPROVE, receipt đều hợp lệ SHA-256
```

**Lý do:** Kiểm tra tính deterministic của logic — cùng input luôn cho cùng outcome.
`decision_id` sẽ khác nhau (UUID ngẫu nhiên) nhưng `outcome` và `uncertainty_category` phải giống nhau.

---

## Case 15 — Edge Case: Receipt luôn là SHA-256 hợp lệ qua tất cả outcome

```
Gọi 3 lần với:
  - AUTO_APPROVE: CONFIRMED + ANNUAL + 1 ngày
  - REJECT: PROBATION + ANNUAL + 1 ngày
  - ESCALATE: CONFIRMED + ANNUAL + 10 ngày
Expected: Cả 3 đều có cryptographic_receipt khớp regex /^[a-f0-9]{64}$/
```

---

## 📌 Gợi ý BTC tạo thêm Test Case

Để tạo test case mới, BTC thay đổi các trường sau và dự đoán expected output dựa theo ma trận ở trên:

```json
{
  "employment_status": "<CONFIRMED|PROBATION|CONTRACT|RESIGNED>",
  "leave_type": "<ANNUAL|SICK|MATERNITY|PATERNITY|UNPAID|COMPASSIONATE>",
  "days_requested": <số nguyên dương>,
  "leave_balance": {
    "annual_days_remaining": <số ngày còn (phải >= days_requested để pass balance check)>
  }
}
```

**Biến thể thú vị để test:**
- CONTRACT + PATERNITY → ESCALATE U2_POLICY
- CONFIRMED + SICK + 14 ngày (boundary TIER_2) → ESCALATE U3_AUTHORITY
- CONFIRMED + SICK + 15 ngày (boundary TIER_3) → ESCALATE U3_AUTHORITY
- PROBATION + SICK + 3 ngày (SICK được phép trong thử việc) → AUTO_APPROVE
- PROBATION + COMPASSIONATE + 2 ngày → AUTO_APPROVE
- RESIGNED + UNPAID → REJECT (Art. 9.1)
- CONFIRMED + ANNUAL + 5 ngày (boundary TIER_1, balance = 5) → AUTO_APPROVE
- CONFIRMED + ANNUAL + 5 ngày (balance = 4, thiếu 1) → REJECT (Art. 11.1)
