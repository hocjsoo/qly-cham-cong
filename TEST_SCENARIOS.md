# 🧪 TÀI LIỆU KỊCH BẢN KIỂM THỬ HỆ THỐNG TOÀN DIỆN (TEST SCENARIOS)
**Dự án:** ET Office Portal — Hệ thống Quản lý Chấm công & Nhân sự Thông minh  
**Phiên bản kiểm thử:** 6.0.0 (Zero-Impact Resilience, Concurrency & Mutation Testing — 29 Test Suites / 158 Test Cases)  
**Tác giả:** [hocjsoo](https://github.com/hocjsoo)

---

## 1. Mục đích & Cam kết An toàn (Zero-Impact Guarantee)

Hệ thống kiểm thử này được thiết kế theo các tiêu chuẩn kỹ thuật nghiêm ngặt:
1. **Không kết nối hoặc làm thay đổi MongoDB Atlas Prod**: Tất cả dữ liệu thử nghiệm đều chạy trên bộ nhớ (In-Memory Mock), cô lập 100%.
2. **Không làm gián đoạn người dùng thật**: Các yêu cầu kiểm thử diễn ra hoàn toàn độc lập, không tạo bản ghi rác, không kích hoạt thông báo thật, không gửi email/push.
3. **Kiểm thử Phá hoại & Bất thường (Chaos & Adversarial Testing)**: Kiểm thử tải đồng thời (Race Condition), dữ liệu rác/Fuzzing, lỗi giao dịch giữa chừng (Transaction Rollback) và cấy lỗi đột biến (Mutation Testing Engine).
4. **Thực thi siêu tốc (< 350ms)**: Quản trị viên hoặc lập trình viên có thể chạy kiểm thử bất kỳ lúc nào ngay trên môi trường phát triển / CI/CD.

---

## 2. Cách chạy Kiểm thử (How to Run Tests)

Chạy từ thư mục `server`:
```powershell
cd d:\QLY_CHAM_CONG\server
npm test
```
Hoặc chạy từ thư mục `client`:
```powershell
cd d:\QLY_CHAM_CONG\client
npm test
```

---

## 3. Danh mục Chi tiết Toàn bộ Các Phân hệ Kiểm thử

### PHẦN A: KIỂM THỬ BACKEND & THUẬT TOÁN NGHIỆP VỤ (16 Suites)
Bao gồm GPS Haversine, 4 mức đi muộn, tăng ca OT, phân quyền RBAC, chốt công ma trận, đơn từ, phép năm, chống gian lận phần cứng, đa phòng ban, đính chính giờ, ngày lễ, công trình, thông báo, thống kê dashboard, xuất Excel, xác thực mật khẩu, đa chi nhánh, ca làm việc.

### PHẦN B: KIỂM THỬ FRONTEND GIAO DIỆN & TRẠNG THÁI CLIENT (6 Suites)
Bao gồm Zustand AuthStore, ThemeStore Dark/Light mode, menu điều hướng & Route Guards, băm phần cứng client, xuất CSV UTF-8 tiếng Việt, badge trạng thái UI.

### PHẦN C: KIỂM THỬ TÍCH HỢP TOÀN TRÌNH (2 Suites)
Bao gồm E2E single user lifecycle và kịch bản đa tầng phức hợp nhân sự đa phòng ban.

### PHẦN D: KIỂM THỬ HIỆU NĂNG & BENCHMARK TẢI CAO (1 Suite / 6 Benchmarks)
Bao gồm tính 10,000 tọa độ GPS (< 50ms), ma trận 3,100 ngày công (< 30ms), ký & xác thực 1,000 JWT (< 100ms), băm 5,000 hardware strings (< 30ms), kiểm tra rò rỉ bộ nhớ Heap (< 15MB Delta), xuất CSV 500 nhân sự (< 25ms).

### PHẦN E: KIỂM THỬ ĐỒNG THỜI, BẢO MẬT & ĐỘ BỀN HỆ THỐNG (RESILIENCE) (4 Suites / 19 Test Cases)

| Test ID | Phân hệ (Module) | Kịch bản kiểm thử | Mô phỏng Tình huống (Scenario) | Kết quả mong đợi (Expected Output) |
|---|---|---|---|---|
| **TC-CONC-01** | Tranh chấp Đồng thời | 5 Admin cùng bấm Khóa tháng trong 1ms | 5 Admin gửi request khóa bảng công đồng thời | Đúng 1 request thành công, 4 request bị chặn xung đột, tạo duy nhất 1 bản ghi Lock |
| **TC-CONC-02** | Tranh chấp Đồng thời | Nhân viên spam click 5 lần Check-in liên tiếp | Click nút Check-in 5 lần trong 10ms | Hệ thống xử lý Idempotent, chỉ tạo 1 bản ghi điểm danh duy nhất |
| **TC-CONC-03** | Tranh chấp Đồng thời | 2 Leader cùng duyệt 1 đơn nghỉ phép | 2 Leader bấm Approve cùng 1 thời điểm | Chỉ duyệt 1 lần, ngày phép chỉ bị trừ 1 lần duy nhất (không bị trừ gấp đôi) |
| **TC-FUZZ-01** | Adversarial Fuzzing | GPS dạng chuỗi chữ "mười độ" | `lat = "mười độ"`, `lng = "một trăm độ"` | Bị chặn, trả về lỗi không phải số thực |
| **TC-FUZZ-02** | Adversarial Fuzzing | GPS null hoặc undefined | `lat = null`, `lng = undefined` | Bị chặn, trả về lỗi bắt buộc GPS |
| **TC-FUZZ-03** | Adversarial Fuzzing | Vĩ độ phi lý 9999.9999 độ | `lat = 9999.9999` (vượt ngoài -90..90) | Bị chặn, bắt lỗi khoảng tọa độ |
| **TC-FUZZ-04** | Adversarial Fuzzing | Kinh độ phi lý -999.999 độ | `lng = -999.999` (vượt ngoài -180..180) | Bị chặn, bắt lỗi khoảng tọa độ |
| **TC-FUZZ-05** | Adversarial Fuzzing | NoSQL Injection Object vào trường Email | `email = { "$ne": null }` | Bị chặn, bắt buộc email là chuỗi ký tự hợp lệ |
| **TC-FUZZ-06** | Adversarial Fuzzing | Ngày kết thúc nghỉ phép < ngày bắt đầu | `start: 2026-08-20`, `end: 2026-08-10` | Bị chặn, bắt lỗi ngày kết thúc nhỏ hơn ngày bắt đầu |
| **TC-FUZZ-07** | Adversarial Fuzzing | Payload lý do tràn bộ nhớ (DDoS 10,000 ký tự) | `reason = 'A'.repeat(10000)` | Bị chặn, giới hạn độ dài an toàn tối đa 2000 ký tự |
| **TC-TX-01** | Rollback Giao dịch | Giao dịch 3 bước thông thường (Happy Path) | Duyệt đơn $\rightarrow$ Trừ phép $\rightarrow$ Tạo công | Hoàn tất thành công toàn vẹn 3 bước |
| **TC-TX-02.1** | Rollback Giao dịch | Giả lập sự cố mất mạng DB ở bước 2 | Lỗi mạng khi đang cập nhật LeaveBalance | Phát hiện lỗi và kích hoạt cơ chế Rollback an toàn |
| **TC-TX-02.2** | Rollback Giao dịch | Khôi phục trạng thái đơn sau sự cố | Rollback trạng thái đơn về ban đầu | Trạng thái đơn được đưa về `pending` (không bị kẹt ở approved) |
| **TC-TX-02.3** | Rollback Giao dịch | Bảo toàn ngày phép sau sự cố | Rollback ngày phép của nhân viên | Ngày phép được giữ nguyên vẹn (không bị mất ngày phép) |
| **TC-TX-02.4** | Rollback Giao dịch | Xóa sạch bản ghi điểm danh rác | Kiểm tra collection Attendance | Không tạo bản ghi điểm danh rác khi giao dịch thất bại |
| **TC-MUT-01** | Mutation Testing | Tiêu diệt Mutant 1: Cấy bug nhân đôi khoảng cách GPS | Sửa công thức Haversine thành `distance * 2` | **ĐÃ TIÊU DIỆT (KILLED)** — Bộ test phát hiện ra ngay lập tức |
| **TC-MUT-02** | Mutation Testing | Tiêu diệt Mutant 2: Cấy bug đảo ngược dấu so sánh OT | Sửa điều kiện so sánh giờ OT thành `<` | **ĐÃ TIÊU DIỆT (KILLED)** — Bộ test phát hiện ra ngay lập tức |
| **TC-MUT-03** | Mutation Testing | Tiêu diệt Mutant 3: Cấy bug bảo mật bypass RBAC | Bỏ qua middleware kiểm tra quyền `requireRole` | **ĐÃ TIÊU DIỆT (KILLED)** — Bộ test phát hiện lỗ hổng ngay lập tức |
| **TC-MUT-04** | Mutation Testing | Tiêu diệt Mutant 4: Cấy bug bỏ qua cờ cảnh báo vượt phép | Luôn trả về `is_overdrawn = false` | **ĐÃ TIÊU DIỆT (KILLED)** — Bộ test phát hiện thiếu cờ cảnh báo ngay lập tức |

---

## 4. Cấu trúc Mã nguồn Thư mục Tests

```
server/
├── tests/
│   ├── runner.js                      # Bộ điều phối chạy test toàn diện (29 Suites)
│   ├── unit/                          # 16 Backend Unit Suites
│   │   ├── attendance.test.js
│   │   ├── clientAuthStore.test.js
│   │   ├── clientDeviceFingerprint.test.js
│   │   ├── clientExportCsv.test.js
│   │   ├── clientNavAccess.test.js
│   │   ├── clientTheme.test.js
│   │   ├── clientUiBadges.test.js
│   │   ├── correctionWorkflow.test.js
│   │   ├── dashboardStats.test.js
│   │   ├── deviceFingerprint.test.js
│   │   ├── exportCalculations.test.js
│   │   ├── haversine.test.js
│   │   ├── holidayMatrix.test.js
│   │   ├── multiOfficeLocation.test.js
│   │   ├── notificationBroadcast.test.js
│   │   ├── passwordAuthLifecycle.test.js
│   │   ├── projectSite.test.js
│   │   ├── requestWorkflow.test.js
│   │   ├── roleMiddleware.test.js
│   │   ├── systemSettings.test.js
│   │   ├── timesheetLock.test.js
│   │   └── userManagement.test.js
│   ├── concurrency/
│   │   └── raceCondition.test.js      # [CONC] Kiểm thử tranh chấp đồng thời & race conditions
│   ├── security/
│   │   └── fuzzingPayloads.test.js    # [FUZZ] Kiểm thử dữ liệu rác, NoSQL injection, toạ độ phi lý
│   ├── performance/
│   │   └── performanceBenchmarks.test.js # [PERF] Đo lường thông lượng & Benchmark tải cao
│   ├── mutation/
│   │   └── mutationEngine.test.js     # [MUT] Động cơ cấy lỗi đột biến và tiêu diệt Mutants
│   └── integration/
│       ├── advancedScenarios.test.js
│       ├── e2eScenario.test.js
│       └── transactionRollback.test.js# [TX] Kiểm thử xử lý sự cố giao dịch & Rollback
└── package.json                       # Script "test": "node tests/runner.js"
```
