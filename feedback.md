# ĐÁNH GIÁ KỸ THUẬT SPRINT 1 — BAN GIÁM KHẢO HACKATHON

---

# Team the hackathon larper (Dự án: Leave Balance & Policy Referee)

---

## 1. What the Team Built

Nhóm **the hackathon larper** xây dựng **Leave Balance & Policy Escalation Referee** — hệ thống tiếp nhận, trích xuất minh chứng và thẩm định quỹ ngày phép cùng chính sách nghỉ phép của nhân viên doanh nghiệp:
* **Kiểm Soát Quỹ Phép Thực Tế (Leave Balance Ledger)**: Không chỉ kiểm tra giấy tờ y tế, hệ thống quản lý chi tiết số dư ngày phép năm còn lại của từng nhân viên (`leave_balance.ts`), tự động tính toán số ngày nghỉ có lương và không lương.
* **Bộ Quy Tắc Thẩm Quyền Phân Cấp (Hierarchical Authority Rules)**:
  * Nghỉ trong hạn mức số dư phép năm -> Tự động duyệt (`AUTO_APPROVE`).
  * Nghỉ ốm ngắn ngày có giấy khám hợp lệ -> Duyệt tự động chế độ BHXH.
  * Nghỉ vượt số dư phép hoặc nghỉ việc riêng đặc biệt -> Chuyển tiếp (`ESCALATE_U3_AUTHORITY`) lên Quản lý trực tiếp hoặc Giám đốc khối.
* **Tích hợp Thị Giác Máy Tính OpenRouter (VLM Parser)**: Sử dụng mô hình thị giác qua OpenRouter (`vlm_parser.ts`) để bóc tách giấy chứng nhận y tế và giấy tờ nghỉ việc riêng.
* **Giao Diện Điều Hành Tinh Gọn (Single-File Dashboard)**: Xây dựng giao diện web nhúng trực tiếp trong `public/index.html`, cho phép nhân viên nộp đơn, xem quỹ phép và quản lý duyệt ca tức thì.

---

## 2. Architecture

Kiến trúc thành phần theo mô hình TypeScript Node.js Service:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Web Presentation / Single-File Dashboard (public/index.html)                            │
│   ├── Bảng theo dõi số dư quỹ phép năm (Leave Balance Dashboard)                        │
│   ├── Form nộp đơn nghỉ phép kèm tải ảnh minh chứng                                     │
│   └── Giao diện duyệt ca và can thiệp quyết định của Quản lý (/override)                │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │ HTTP REST API (src/api/)
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Core Domain & Orchestrator (src/core/)                                                  │
│   ├── orchestrator.py / ts     (Điều phối toàn bộ chu trình thẩm định)                 │
│   ├── rules/leave_balance.ts   (Động cơ tính toán số dư ngày phép và khấu trừ ngày nghỉ)│
│   ├── rules/authority.ts       (Ma trận thẩm quyền phân cấp duyệt)                      │
│   ├── rules/eligibility.ts     (Kiểm tra điều kiện thâm niên và loại hợp đồng lao động) │
│   └── ledger/audit.ts          (Sổ cái kiểm toán ghi vết bất biến)                      │
└──────────────────────────┬──────────────────────────────────────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐
│ AI & VLM Extraction Layer              │ │ Benchmark Test Runner                       │
│   ├── ai/openrouter_client.ts (API)    │ │   ├── tests/benchmark/01_auto_approve.test  │
│   ├── ai/vlm_parser.ts (Thị giác)      │ │   ├── tests/benchmark/03_escalate_u2.test    │
│   └── ai/escalation_synthesizer.ts     │ │   └── tests/benchmark/04_escalate_u3.test    │
└────────────────────────────────────────┘ └─────────────────────────────────────────────┘
```

---

## 3. What Works Well (Concrete Strengths)

1. **Gắn Chặt Với Bài Toán Quỹ Phép Thực Tế (Leave Balance Tracking) (Verified)**:
   * Điểm sáng nhất của nhóm là không xem xét đơn xin nghỉ một cách cô lập. Module [`src/core/rules/leave_balance.ts`](team_repos/the%20hackathon%20larper/src/core/rules/leave_balance.ts) trừ trực tiếp số ngày nghỉ vào quỹ phép hiện có của nhân viên, giúp bộ phận nhân sự không phải tính toán thủ công.
2. **Bộ Test Benchmark Được Chuẩn Hóa Theo Từng Kịch Bản (Verified)**:
   * Thư mục `tests/benchmark/` phân chia rõ ràng từng kịch bản thử nghiệm: `01_auto_approve.test.ts`, `02_reject.test.ts`, `03_escalate_u2_policy.test.ts`, `04_escalate_u3_authority.test.ts`, `05_edge_cases.test.ts`, thể hiện tư duy kiểm thử theo ma trận rất mạch lạc.
3. **Cơ Chế Sổ Cái Kiểm Toán (Audit Ledger) Độc Lập (Verified)**:
   * Module `src/ledger/audit.ts` ghi nhận mọi biến động về số dư ngày phép và các quyết định phê duyệt kèm dấu vết thời gian rõ ràng.
4. **Cơ Chế Ghi Đè Quyết Định (Override Route) Thiết Thực (Verified)**:
   * Endpoint `src/api/routes/override.ts` cho phép cấp quản lý có thẩm quyền cao hơn can thiệp điều chỉnh quyết định tự động của hệ thống khi có lý do chính đáng ngoài quy chế.

---

## 4. Critical Problems

### Problem 1: Cam Kết Nhầm Toàn Bộ Thư Mục node_modules Vào Git Repository
* **Evidence (VERIFIED)**:
  * Trong cây thư mục gốc, nhóm đã commit hơn 5.000 file của thư mục `node_modules/.pnpm/` trực tiếp vào Git repo.
* **Why it matters**: Làm tăng dung lượng repository lên hàng chục Megabyte, khiến thời gian clone repo về máy cực kỳ chậm, vi phạm nguyên tắc cơ bản nhất của quản trị mã nguồn.
* **Impact**: Lỗi quản trị mã nguồn nghiêm trọng (Repository Hygiene Blocker).
* **Recommended fix**: Thêm `node_modules/` vào `.gitignore`, chạy lệnh `git rm -r --cached node_modules/` và commit lại để làm sạch repository.
* **Priority**: **P0**

---

### Problem 2: Giao Diện Người Dùng Dạng File Đơn Cồng Kềnh
* **Evidence (VERIFIED)**:
  * File [`public/index.html`](team_repos/the%20hackathon%20larper/public/index.html) có kích thước lên tới 80.000 bytes (chứa toàn bộ HTML, CSS và JavaScript nhúng gộp chung).
* **Why it matters**: Việc gom toàn bộ mã nguồn giao diện vào một file HTML tĩnh khổng lồ gây khó khăn lớn cho việc bảo trì, không tận dụng được tính năng chia nhỏ component và tối ưu hóa tài nguyên của các công cụ hiện đại.
* **Impact**: Khó mở rộng thêm các tính năng giao diện mới trong tương lai.
* **Recommended fix**: Tách nhỏ giao diện thành các component độc lập hoặc chuyển sang dùng React/Vite.
* **Priority**: **P2**

---

## 5. Crash / Failure Risks

| Failure Mode | Trigger | Impact | Severity | Fix |
| ------------ | ------- | ------ | -------- | --- |
| **Xung đột gói cài đặt khi clone trên máy khác** | Clone repo có sẵn `node_modules` của máy Windows/Mac sang môi trường Linux. | Lỗi không tương thích các gói nhị phân (Native Bindings), server không khởi động được. | **High** | Xóa sạch thư mục `node_modules` khỏi Git và chạy cài mới bằng `pnpm install`. |
| **Trừ âm số dư ngày phép** | Người dùng gửi liên tiếp nhiều đơn xin nghỉ cùng một lúc. | Xung đột cập nhật khiến quỹ phép bị trừ âm bất hợp lý. | **Medium** | Thêm khóa kiểm tra số dư nguyên tử (Atomic Check-and-Set) trước khi duyệt đơn. |
| **Lỗi timeout OpenRouter VLM** | Mạng chập chờn khi gọi OpenRouter API trong buổi thuyết trình. | VLM parser bị treo, không trích xuất được giấy khám bệnh. | **Medium** | Thêm cơ chế timeout 10s và trả về trạng thái thẩm định thủ công khi lỗi. |

---

## 6. Pipeline Analysis

```text
CURRENT PIPELINE:
[Nhân viên gửi đơn xin nghỉ + Tải ảnh giấy tờ minh chứng]
       │
       ▼
[OpenRouter VLM Client: Đọc ảnh và trích xuất dữ kiện y tế/hộ tịch]
       │
       ▼
[rules/eligibility.ts: Kiểm tra thâm niên và loại hợp đồng nhân viên]
       │
       ▼
[rules/leave_balance.ts: Đối chiếu với số dư ngày phép hiện có trong sổ cái]
       │
       ▼
[rules/authority.ts: Áp dụng ma trận thẩm quyền (Tự động duyệt hoặc Chuyển cấp)]
       │
       ▼
[ledger/audit.ts: Khấu trừ số dư phép & Ghi nhật ký kiểm toán]
       │
       ▼
[Cập nhật trạng thái trên giao diện web public/index.html]
```

---

## 7. Code / Repository Issues

* Logic phân loại và tính toán ngày phép viết bằng TypeScript rất tốt.
* Cần xóa khẩn cấp `node_modules` khỏi Git tracking để đưa dung lượng repo về mức bình thường.

---

## 8. Database / API / Integration Issues

* Cần kết nối lớp sổ cái `ledger/audit.ts` với cơ sở dữ liệu quan hệ bền vững (như SQLite hoặc PostgreSQL) thay vì chỉ lưu trữ trên file tạm hoặc RAM.

---

## 9. Security Issues

* Cần kiểm tra kỹ API key OpenRouter, đảm bảo nạp qua file `.env` chứ không để lộ trong mã nguồn.

---

## 10. Deployment / DevOps Issues

* Cần cung cấp file `Dockerfile` chuẩn để việc cài đặt và khởi chạy dự án diễn ra tự động và độc lập với môi trường máy chủ.

---

## 11. Testing Gaps

* Bộ test benchmark với Vitest (`vitest.config.ts`) trong thư mục `tests/benchmark/` chạy rất tốt. Cần bổ sung test case kiểm tra chống race condition khi nộp đơn đồng thời.

---

## 12. Recommended Improvements

| Priority | Thành phần | Hành động cụ thể | Lợi ích mang lại |
| -------- | ---------- | ---------------- | ---------------- |
| **P0** | **Git Hygiene** | Xóa hoàn toàn `node_modules` khỏi repository và cập nhật `.gitignore`. | Giảm dung lượng tải về, giải phóng hàng ngàn file rác và chống lỗi xung đột hệ điều hành. |
| **P1** | **Database** | Chuyển đổi tầng lưu trữ sổ cái phép sang cơ sở dữ liệu có ACID transaction. | Bảo đảm tính chính xác tuyệt đối khi trừ số dư ngày phép của nhân viên. |
| **P2** | **Frontend** | Tách file `public/index.html` khổng lồ thành các module component rõ ràng. | Dễ dàng nâng cấp giao diện và bổ sung tính năng mới. |

---

## 13. Sprint 2 Action Plan

### P0 — Must Fix
1. Dọn dẹp dứt điểm thư mục `node_modules` khỏi Git tracking.
2. Thêm file cấu hình môi trường `.env.example` và hoàn thiện hướng dẫn chạy trong `README.md`.

### P1 — Should Fix
1. Bổ sung cơ sở dữ liệu SQLite có hỗ trợ transaction cho sổ cái quản lý ngày phép.

---

## 14. Reviewer Conclusion

* **Current System State**: Một giải pháp thẩm định nghỉ phép có tính toán thực tế vượt trội nhờ tích hợp trực tiếp việc khấu trừ số dư ngày phép của nhân viên.
* **Most Important Strength**: Logic quản lý quỹ phép và ma trận thẩm quyền rất chặt chẽ, bộ test benchmark Vitest được phân chia theo kịch bản rất bài bản.
* **Most Important Technical Risk**: Cam kết nhầm hơn 5.000 file `node_modules` vào repo làm nặng mã nguồn và tiềm ẩn nguy cơ xung đột môi trường cài đặt.
* **Most Important Next Action**: Dọn sạch `node_modules` khỏi Git và kết nối cơ sở dữ liệu có hỗ trợ transaction để bảo vệ số dư ngày phép của nhân viên.
