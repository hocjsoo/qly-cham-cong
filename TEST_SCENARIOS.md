# 🧪 TÀI LIỆU KỊCH BẢN KIỂM THỬ HỆ THỐNG TOÀN DIỆN (TEST SCENARIOS)
**Dự án:** ET Office Portal — Hệ thống Quản lý Chấm công & Nhân sự Thông minh
**Phiên bản kiểm thử:** 8.0.0 (Zero-Impact Resilience, Real Supertest HTTP Pipeline & Security Hardening — 32 Test Suites / 235 Test Cases)
**Tác giả:** [hocjsoo](https://github.com/hocjsoo)

---

## 1. Mục đích & Cam kết An toàn (Zero-Impact Guarantee)

Hệ thống kiểm thử này được thiết kế theo các tiêu chuẩn kỹ thuật nghiêm ngặt:
1. **Không kết nối hoặc làm thay đổi MongoDB Atlas Prod**: Tất cả dữ liệu thử nghiệm đều chạy trên bộ nhớ (In-Memory Mock), cô lập 100%.
2. **Không làm gián đoạn người dùng thật**: Các yêu cầu kiểm thử diễn ra hoàn toàn độc lập, không tạo bản ghi rác, không kích hoạt thông báo thật, không gửi email/push.
3. **Kiểm thử Trực tiếp Express App & Supertest (HTTP Pipeline Integration)**: Gửi request HTTP thật qua Supertest với JWT Bearer Tokens, kiểm tra qua toàn bộ Route, Middleware Auth, Phân quyền RBAC và Response Serialization.
4. **Kiểm thử Phá hoại & Bất thường (Chaos & Adversarial Testing)**: Kiểm thử tải đồng thời (Race Condition), dữ liệu rác/Fuzzing, lỗi giao dịch giữa chừng (Transaction Rollback) và cấy lỗi đột biến (Mutation Testing Engine).
5. **Thực thi siêu tốc (thường dưới 1 giây)**: Quản trị viên hoặc lập trình viên có thể chạy kiểm thử bất kỳ lúc nào ngay trên môi trường phát triển / CI/CD.

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

## 3. Danh mục Chi tiết Toàn bộ Các Phân hệ Kiểm thử (32 Suites / 235 Test Cases)

### PHẦN A: KIỂM THỬ BACKEND & THUẬT TOÁN NGHIỆP VỤ (16 Suites)
Bao gồm GPS Haversine, 4 mức đi muộn, tăng ca OT, phân quyền RBAC, chốt công ma trận, đơn từ, phép năm, chống gian lận phần cứng, đa phòng ban, đính chính giờ, ngày lễ, công trình, thông báo, thống kê dashboard, xuất Excel, xác thực mật khẩu, đa chi nhánh, ca làm việc.

### PHẦN B: KIỂM THỬ FRONTEND GIAO DIỆN & TRẠNG THÁI CLIENT (6 Suites)
Bao gồm Zustand AuthStore, ThemeStore Dark/Light mode, menu điều hướng & Route Guards, băm phần cứng client, xuất CSV UTF-8 tiếng Việt, badge trạng thái UI.

### PHẦN C: KIỂM THỬ TÍCH HỢP TOÀN TRÌNH & REAL CONTROLLERS (3 Suites / 27 Test Cases)
Bao gồm E2E single user lifecycle, kịch bản đa tầng phức hợp nhân sự đa phòng ban, và bộ kiểm thử trực tiếp controller production (`controllerIntegration.test.js`).

| Test ID | Phân hệ (Module) | Kịch bản kiểm thử | Mô phỏng Tình huống (Scenario) | Kết quả mong đợi (Expected Output) |
|---|---|---|---|---|
| **TC-CTRL-01.1** | Real Controller | Admin gọi `getAllUsers` | Admin gửi request lấy danh bạ | Trả về 200 OK |
| **TC-CTRL-01.2** | Real Controller | Admin nhận đủ sĩ số nhân sự | 3 nhân sự trong hệ thống | Trả về đủ 3 bản ghi |
| **TC-CTRL-01.3** | Real Controller | Admin truy xuất toàn bộ trường HR | Xem ngày sinh, CCCD, Ngân hàng | Nhận đầy đủ dữ liệu quản trị |
| **TC-CTRL-02.1** | Real Controller | Leader gọi `getAllUsers` | Leader IT gửi request | Trả về 200 OK |
| **TC-CTRL-02.2** | Real Controller | Leader xem dữ liệu team mình | Nhân viên thuộc phòng IT | Hiển thị trường quản lý phòng ban |
| **TC-CTRL-02.3** | Real Controller | Sanitize nhân viên phòng khác | Nhân viên phòng Kinh Doanh | Tự động ẩn toàn bộ trường HR nhạy cảm |
| **TC-CTRL-03.1** | Real Controller | Employee gọi `getAllUsers` | Nhân viên thông thường gọi API | Trả về 200 OK |
| **TC-CTRL-03.2** | Real Controller | Employee nhận danh bạ whitelist | Tên, Email, SĐT, Chức vụ, Phòng | Nhận đúng thông tin danh bạ công khai |
| **TC-CTRL-03.3** | Real Controller | Không rò rỉ dữ liệu riêng tư | Kiểm tra trường DOB, CCCD, Xe | Ẩn hoàn toàn 100% |
| **TC-CTRL-04.1** | Real Controller | Leader sửa hồ sơ cá nhân | Gửi họ tên và SĐT mới | Trả về 200 OK thành công |
| **TC-CTRL-04.2** | Real Controller | Lưu đúng dữ liệu vào database | Kiểm tra payload update | Họ tên và SĐT mới được lưu chính xác |
| **TC-CTRL-05.1** | Real Controller | Non-admin gửi kèm trường xe | Employee gửi `parking_location` | Request không bị crash, 200 OK |
| **TC-CTRL-05.2** | Real Controller | Chặn ghi đè trường xe | Kiểm tra payload update | Backend từ chối ghi đè trường xe |
| **TC-CTRL-05.3** | Real Controller | Thông báo hướng dẫn nộp đơn | Xem message phản hồi | Nhắc nhở user nộp Đơn đổi xe |
| **TC-CTRL-06** | Real Controller | Leader sửa giờ chấm công | Leader gọi `overrideAttendance` | Bị chặn `403 Forbidden` |
| **TC-HTTP-08** | Real Controller | Check-in thiếu GPS | Không truyền lat/lng | Bị chặn 400 và yêu cầu GPS |
| **TC-HTTP-09** | Real Controller | Check-in trong văn phòng | Gửi tọa độ văn phòng hợp lệ | Trả về 200/201 OK |
| **TC-HTTP-10** | Real Controller | Check-in WFH ngoài văn phòng | Gửi tọa độ WFH ngoài văn phòng | Trả về 200 OK, `check_in_type="wfh"` |
| **TC-HTTP-11** | Real Controller | Check-in tọa độ 0,0 | Gửi `lat: 0, lng: 0` | Xử lý số hợp lệ, 200 OK |
| **TC-HTTP-12** | Real Controller | Check-in lat/lng null | Gửi `lat: null, lng: null` | Bị chặn 400 và yêu cầu GPS |
| **TC-HTTP-13** | Real Controller | Check-in lat/lng chuỗi rỗng | Gửi `lat: '', lng: ''` | Bị chặn 400 và yêu cầu GPS |
| **TC-HTTP-14** | Real Controller | Check-in lat/lng khoảng trắng | Gửi `lat: '   ', lng: '   '` | Bị chặn 400 và yêu cầu GPS |
| **TC-HTTP-15** | Real Controller | Check-in lat/lng chuỗi chữ NaN | Gửi `lat: 'abc', lng: 'xyz'` | Bị chặn 400 và yêu cầu GPS |

### PHẦN D: KIỂM THỬ HIỆU NĂNG & BENCHMARK TẢI CAO (1 Suite / 6 Benchmarks)
Bao gồm tính 10,000 tọa độ GPS (< 50ms), ma trận 3,100 ngày công (< 30ms), ký & xác thực 1,000 JWT (< 250ms), băm 5,000 hardware strings (< 30ms), kiểm tra rò rỉ bộ nhớ Heap (< 15MB Delta), xuất CSV 500 nhân sự (< 25ms).

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

### PHẦN F: KIỂM THỬ CHUYÊN GIA NGHIỆP VỤ & BỘ CHỌN THỜI GIAN THÔNG MINH (2 Suites / 24 Test Cases)

| Test ID | Phân hệ (Module) | Kịch bản kiểm thử | Mô phỏng Tình huống (Scenario) | Kết quả mong đợi (Expected Output) |
|---|---|---|---|---|
| **TC-EXP-REQ-01.1** | Expert Request | Duyệt đơn nghỉ phép nhiều ngày | Trưởng phòng duyệt đơn nghỉ 3 ngày (25-27/08) | Duyệt thành công 200 OK |
| **TC-EXP-REQ-01.2** | Expert Request | Tính chính xác số ngày nghỉ dải ngày | Dải ngày 2026-08-25 đến 2026-08-27 | Tính ra chính xác 3 ngày nghỉ phép |
| **TC-EXP-REQ-01.3** | Expert Request | Tự động đồng bộ điểm danh nhiều ngày | Kiểm tra 3 bản ghi điểm danh tương ứng | Tạo đủ 3 bản ghi status="leave", công 1.0 |
| **TC-EXP-REQ-02.1** | Expert Request | Duyệt đơn tăng ca ngoài giờ | Duyệt đơn làm ca tối 18:30 -> 21:30 | Đơn chuyển trạng thái approved |
| **TC-EXP-REQ-02.2** | Expert Request | Tự động cộng dồn giờ OT | Ca 18:30 -> 21:30 (3 giờ) | Tự động cập nhật `ot_hours = 3.0` trong bảng công |
| **TC-EXP-REQ-03.1** | Expert Request | Chặn Leader duyệt đơn của Admin | Leader cố tình gửi request duyệt đơn Admin | Bị chặn với lỗi `403 Forbidden` |
| **TC-EXP-REQ-03.2** | Expert Request | Quyền Admin duyệt đơn toàn hệ thống | Admin duyệt đơn cho nhân viên bất kỳ | Duyệt thành công 200 OK |
| **TC-EXP-REQ-04.1** | Expert Request | Xóa phạt đi muộn khi duyệt giải trình | Nhân viên gửi đơn giải trình đi muộn hợp lệ | Xóa cờ is_late=false, late_minutes=0 |
| **TC-EXP-REQ-04.2** | Expert Request | Phục hồi đủ công lao động | Ngày bị trừ công do đi muộn | Phục hồi trọn vẹn `work_units = 1.0` |
| **TC-EXP-REQ-05.1** | Expert Request | Duyệt đơn WFH làm từ xa | Đơn WFH được quản lý phê duyệt | Ghi nhận `check_in_type = "wfh"`, status="present" |
| **TC-EXP-REQ-05.2** | Expert Request | Tính công chuẩn cho ngày WFH | Ngày làm từ xa được chấp thuận | Ghi nhận đủ 1.0 công chuẩn |
| **TC-EXP-TIME-01.1** | Time Stepper | Stepper tăng 15 phút thường | 08:30 + 15p | 08:45 |
| **TC-EXP-TIME-01.2** | Time Stepper | Stepper tăng 15 phút chuyển giờ tròn | 08:45 + 15p | 09:00 |
| **TC-EXP-TIME-01.3** | Time Stepper | Stepper tăng 30 phút | 17:30 + 30p | 18:00 |
| **TC-EXP-TIME-02.1** | Time Stepper | Stepper giảm 15 phút chuyển giờ | 09:00 - 15p | 08:45 |
| **TC-EXP-TIME-02.2** | Time Stepper | Stepper giảm 30 phút | 08:15 - 30p | 07:45 |
| **TC-EXP-TIME-03.1** | Time Stepper | Chặn an toàn ở biên dưới 00:00 | 00:05 - 15p | Chặn an toàn tại `00:00` (không bị âm) |
| **TC-EXP-TIME-03.2** | Time Stepper | Chặn an toàn ở biên trên 23:59 | 23:50 + 20p | Chặn an toàn tại `23:59` |
| **TC-EXP-TIME-04.1** | Date Shifter | Chuyển ngày tới (+1 ngày) | 2026-08-24 + 1 ngày | 2026-08-25 |
| **TC-EXP-TIME-04.2** | Date Shifter | Chuyển ngày lùi (-1 ngày) | 2026-08-24 - 1 ngày | 2026-08-23 |
| **TC-EXP-TIME-04.3** | Date Shifter | Chuyển ngày qua tháng mới | 2026-08-31 + 1 ngày | 2026-09-01 (Chuyển tháng chính xác) |
| **TC-EXP-TIME-05.1** | Live Calc | Tính giờ làm ca chuẩn | 08:30 -> 17:30 | 9.0h làm việc, 0h OT |
| **TC-EXP-TIME-05.2** | Live Calc | Tính giờ làm & OT ca tối | 08:30 -> 20:00 | 11.5h làm việc, 1.5h OT (sau 18:30) |
| **TC-EXP-TIME-05.3** | Live Calc | Xử lý an toàn giờ ra < giờ vào | Giờ ra 08:00, giờ vào 08:30 | Xử lý an toàn trả về 0h |

---

## 4. Cấu trúc Mã nguồn Thư mục Tests

```
server/
├── tests/
│   ├── runner.js                      # Bộ điều phối chạy test toàn diện (32 Suites / 235 Test Cases)
│   ├── unit/                          # 18 Backend Unit & Expert Suites
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
│   │   ├── expertRequestApproval.test.js  # [EXP-REQ] Vòng đời duyệt đơn nhiều ngày, OT & RBAC
│   │   ├── expertTimeDateAdjuster.test.js # [EXP-TIME] Bộ chọn giờ +-15p & tính giờ làm việc
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
│       ├── controllerIntegration.test.js # [CTRL] Kiểm thử trực tiếp Controller & Express Middleware thật
│       ├── e2eScenario.test.js
│       └── transactionRollback.test.js# [TX] Kiểm thử xử lý sự cố giao dịch & Rollback
└── package.json                       # Script "test": "node tests/runner.js"
```
