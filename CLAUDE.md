# ET OFFICE PORTAL — AI Development Guide

## Tổng quan dự án

Hệ thống quản lý chấm công thông minh dành cho doanh nghiệp (~30–50 nhân viên), được xây dựng & phát triển độc quyền bởi duy nhất **[hocjsoo](https://github.com/hocjsoo)**.

- **Stack**: React 19 (Vite 8) + Node.js (Express 4) + MongoDB Atlas (Mongoose 9)
- **Deploy**: Vercel (frontend) + Render.com (backend) + MongoDB Atlas (DB)
- **Auth**: JWT + bcrypt, role-based (admin / leader / employee)
- **UI**: Mobile-first PWA, dark/light theme, vanilla CSS design system
- **Testing**: Zero-Impact Test Suite (31 Suites / 203 Test Cases in-memory)

---

## Cấu trúc thư mục

```
QLY_CHAM_CONG/
├── client/                          # React Frontend (Vite 8)
│   ├── src/
│   │   ├── pages/                   # 14 page components
│   │   │   ├── CheckInPage.jsx      # Chấm công GPS + Selfie xác thực
│   │   │   ├── DashboardPage.jsx    # Dashboard tổng quan (admin/leader)
│   │   │   ├── ExpensesPage.jsx     # Bảng tổng hợp chi tiêu & hoàn ứng
│   │   │   ├── ForgotPasswordPage.jsx # Quên mật khẩu / Reset mã code
│   │   │   ├── HistoryPage.jsx      # Lịch sử chấm công + Calendar view + Stepper +-15p
│   │   │   ├── LeaderboardPage.jsx  # Bảng xếp hạng chuyên cần (Hôm nay / Tuần / Tháng)
│   │   │   ├── LoginPage.jsx        # Đăng nhập
│   │   │   ├── ProfilePage.jsx      # Thông tin cá nhân + đổi mật khẩu & xe
│   │   │   ├── ProjectsPage.jsx     # Quản lý dự án / công trình (PM có quyền sửa)
│   │   │   ├── ReportPage.jsx       # Báo cáo tổng hợp + PDF export
│   │   │   ├── RequestsPage.jsx     # Quản lý đơn từ + Cảnh báo ca & thiết bị lạ + Hoàn tác
│   │   │   ├── SettingsPage.jsx     # Cài đặt hệ thống (admin only)
│   │   │   ├── StaffPage.jsx        # Quản lý nhân sự + thiết bị chính (admin/leader)
│   │   │   └── VehiclesPage.jsx     # Bảng phương tiện gửi xe tinh gọn (admin only edit)
│   │   ├── components/              # Shared components
│   │   │   ├── Layout.jsx           # App shell (desktop sidebar + mobile bottom nav)
│   │   │   ├── HeaderActions.jsx    # Theme toggle + notification bell
│   │   │   ├── MagicCursor.jsx      # Animated cursor effect (desktop)
│   │   │   ├── MapGpsPicker.jsx     # GPS map picker (Leaflet)
│   │   │   ├── NotificationCenter.jsx # Real-time notification panel
│   │   │   └── ThemeToggle.jsx      # Dark/light theme switcher
│   │   ├── stores/                  # Zustand state management
│   │   │   ├── authStore.js         # Authentication + JWT + user state
│   │   │   └── themeStore.js        # Theme preference persistence
│   │   ├── services/                # API layer
│   │   │   ├── api.js               # Axios instance (JWT interceptor + offline fallback)
│   │   │   └── mockApi.js           # Offline mock API for development
│   │   ├── hooks/                   # Custom React hooks
│   │   │   └── useGeolocation.js    # GPS position hook
│   │   ├── utils/                   # Utilities
│   │   │   ├── exportCsv.js         # CSV export helper (UTF-8 BOM)
│   │   │   └── deviceFingerprint.js # Pure hardware UUID for anti-fraud
│   │   ├── App.jsx                  # Root component + routing
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Design system (CSS variables + tokens)
│   ├── vercel.json                  # Vercel SPA routing config
│   └── vite.config.js               # Vite build config
│
├── server/                          # Node.js Backend (Express 4)
│   ├── src/
│   │   ├── controllers/             # 15 business logic controllers
│   │   │   ├── authController.js    # login, register, forgot/reset password, change password
│   │   │   ├── attendanceController.js # checkin, checkout, today, history, override, flagged
│   │   │   ├── correctionController.js # Yêu cầu sửa chấm công
│   │   │   ├── dashboardController.js  # Dashboard stats + pending count
│   │   │   ├── exportController.js     # Excel export (xlsx)
│   │   │   ├── holidayController.js    # Quản lý ngày lễ
│   │   │   ├── leaveBalanceController.js # Quản lý ngày phép + hoàn phép khi undo
│   │   │   ├── locationController.js   # CRUD vị trí GPS văn phòng
│   │   │   ├── notificationController.js # CRUD thông báo + broadcast
│   │   │   ├── projectController.js    # CRUD dự án / công trình (Admin + PM)
│   │   │   ├── reportController.js     # Báo cáo matrix + chi tiết cá nhân
│   │   │   ├── requestController.js    # CRUD đơn từ + approve/reject/revert/delete
│   │   │   ├── systemSettingController.js # Cấu hình ca làm việc
│   │   │   ├── timesheetLockController.js # Chốt công + lock/unlock
│   │   │   └── userController.js       # CRUD nhân viên + quản lý thiết bị
│   │   ├── models/                  # 15 Mongoose schemas
│   │   ├── routes/                  # 16 Express route files
│   │   ├── middlewares/             # Auth + Role + Rate limiting
│   │   ├── database/               # DB connection + seed
│   │   └── app.js                  # Entry point + middleware + route mounting
│   ├── tests/                       # 31 Test Suites / 203 Test Cases (Zero-Impact)
│   │   ├── runner.js                # Master test runner
│   │   ├── unit/                    # 18 Unit test suites (Nghiệp vụ, Stepper, Lifecycle)
│   │   ├── concurrency/             # Kiểm thử tranh chấp đồng thời
│   │   ├── security/                # Fuzzing & NoSQL Injection resistance
│   │   ├── performance/             # High-load benchmarks (< 350ms total)
│   │   ├── mutation/                # Mutation testing engine
│   │   └── integration/             # E2E & Transaction Rollback
│   └── package.json
│
├── .agents/AGENTS.md               # Agent rules & conventions
├── CLAUDE.md                       # AI development guide (file này)
├── CONTRIBUTING.md                 # Hướng dẫn đóng góp
├── README.md                       # Project documentation
├── TEST_SCENARIOS.md               # Tài liệu 203 kịch bản kiểm thử
└── LICENSE                         # MIT License
```

---

## Phân quyền (Role-Based Access Control)

Hệ thống có 3 vai trò chính. `roleMiddleware.js` tự động map tương thích giữa legacy (`manager`/`staff`) và roles mới (`leader`/`employee`).

| Role | DB Value | Quyền hạn chi tiết |
|------|----------|-------------------|
| **Admin** | `admin` | **Toàn quyền tối cao**: Quản lý nhân sự, cài đặt hệ thống, chốt công, sửa/xóa giờ chấm công (`overrideAttendance`), sửa thông tin xe, tạo/xóa dự án, xuất báo cáo. |
| **Leader** | `leader` (compat: `manager`) | **Quản lý phòng ban**: Dashboard sĩ số team, duyệt đơn cho nhân viên thuộc phòng ban mình quản lý, duyệt ca cảnh báo/selfie. **Không được sửa giờ chấm công, không sửa gửi xe, không sửa dự án chung**. |
| **PM (Phụ trách DA)** | `admin` / `leader` / `employee` | **Quản lý dự án phụ trách**: Được phân quyền chỉnh sửa thông tin, tiến độ, deadline của dự án mình được giao làm PM (`pm_id` hoặc `pm_name`). |
| **Nhân viên** | `employee` (compat: `staff`) | **Cá nhân**: Chấm công GPS + Selfie, nộp đơn từ, xem lịch sử cá nhân, xem dự án tham gia. |

---

## API Routes Chi Tiết

| Prefix | Controller | Auth | Role | Ghi chú |
|--------|-----------|------|------|---------|
| `/api/auth` | authController | Mixed | — | login (public), forgot-password, change-password |
| `/api/attendance` | attendanceController | ✅ | — | checkin, checkout, today, history |
| `/api/attendance/flagged` | attendanceController | ✅ | admin/leader | Lấy danh sách ca nghi vấn & selfie |
| `/api/attendance/flagged/verify/:id` | attendanceController | ✅ | admin/leader | Duyệt/Từ chối/Hoàn tác/Xóa ca cảnh báo (tự động trust device) |
| `/api/attendance/override/:id` | attendanceController | ✅ | **admin only** | Điều chỉnh giờ chấm công |
| `/api/attendance/:id` (DELETE) | attendanceController | ✅ | **admin only** | Xóa ca chấm công để nhân viên chấm lại |
| `/api/requests` | requestController | ✅ | — | CRUD đơn từ; approve/reject (admin/leader) |
| `/api/requests/:id/revert` | requestController | ✅ | admin/leader | Hoàn tác đơn về pending (hoàn phép, trừ OT) |
| `/api/requests/:id` (DELETE) | requestController | ✅ | admin/leader | Xóa đơn an toàn |
| `/api/projects` | projectController | ✅ | — | Lấy danh sách dự án |
| `/api/projects` (POST) | projectController | ✅ | **admin only** | Tạo mới dự án |
| `/api/projects/:id` (PUT) | projectController | ✅ | **admin / PM** | Sửa dự án (Admin hoặc PM phụ trách dự án) |
| `/api/projects/:id` (DELETE) | projectController | ✅ | **admin only** | Xóa dự án |
| `/api/users` | userController | ✅ | admin/leader | CRUD nhân viên (sửa xe: admin only) |
| `/api/users/:id/devices` | userController | ✅ | **admin only** | Xem, đặt máy chính (`trust`), xóa thiết bị |
| `/api/dashboard` | dashboardController | ✅ | admin/leader | Stats tổng quan |
| `/api/departments` | departmentController | ✅ | — | CRUD phòng ban |
| `/api/reports` | reportController | ✅ | admin/leader | Báo cáo matrix + chi tiết cá nhân |
| `/api/locations` | locationController | ✅ | admin | CRUD vị trí GPS |
| `/api/leave-balance` | leaveBalanceController | ✅ | admin/leader | Quản lý ngày phép |
| `/api/export` | exportController | ✅ | admin/leader | Xuất Excel |
| `/api/settings` | systemSettingController | ✅ | admin | Cấu hình hệ thống |
| `/api/notifications` | notificationController | ✅ | — | CRUD; broadcast (admin/leader) |
| `/api/holidays` | holidayController | ✅ | admin/leader | CRUD ngày lễ |
| `/api/timesheet-lock` | timesheetLockController | ✅ | admin/leader | Chốt công tháng |
| `/api/health` | inline | ❌ | — | Health check endpoint |

---

## Bảo mật & Anti-Fraud Cao Cấp

- JWT token trong header `Authorization: Bearer <token>`
- Mật khẩu hash: bcrypt (10 rounds)
- GPS bắt buộc khi chấm công (tất cả loại check-in office, site, client, wfh)
- **Anti-Fraud Chữ Ký Phần Cứng Vật Lý (`pure_hardware_uuid`)**:
  - Mã hóa từ GPU WebGL unmasked renderer, CPU cores, Screen resolution, Audio sample rate, Timezone.
  - Chống 100% việc gian lận qua Tab ẩn danh (Incognito) hoặc chuyển trình duyệt (Chrome vs Edge) trên cùng 1 máy.
  - Tự động bắt chụp ảnh Selfie khi phát hiện dùng chung máy hoặc nhiều tài khoản.
- **Trung Tâm Duyệt Cảnh Báo (Admin & Leader)**:
  - Khung duyệt selfie & thiết bị nghi vấn, hỗ trợ filter `Chờ duyệt`, `Thiết bị lạ`, `Kèm ảnh Selfie`, `Đã duyệt`, `Từ chối`.
  - Hỗ trợ Duyệt (`verification_status = 'approved'`, tự động lưu máy chính `is_trusted = true`), Từ Chối kèm gợi ý lý do nhanh + tùy chọn **"Xóa dữ liệu để nhân viên chấm công lại"**, Hoàn tác (`revert`) và Xóa ca (`delete`).
- **Quản Lý Thiết Bị Chính Chủ (Device Management)**:
  - API `GET/PUT/DELETE /api/users/:id/devices` xem danh sách thiết bị, đặt **`⭐ MÁY CHÍNH`** (`trustUserDevice`) hoặc xóa thiết bị cũ (`deleteUserDevice`).

---

## Quy trình Kiểm thử

Chạy bộ test suite 203 kịch bản:
```bash
cd server
npm test
```
Tất cả 203/203 test cases chạy hoàn toàn trên bộ nhớ In-Memory, cam kết không tác động đến cơ sở dữ liệu thật trên MongoDB Atlas.
