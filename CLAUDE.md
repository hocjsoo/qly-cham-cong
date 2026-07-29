# ET OFFICE PORTAL — AI Development Guide

## Tổng quan dự án

Hệ thống quản lý chấm công thông minh cho công ty kiến trúc ET Architects (~30 nhân viên).

- **Stack**: React 19 (Vite 8) + Node.js (Express 4) + MongoDB Atlas (Mongoose 9)
- **Deploy**: Vercel (frontend) + Render.com (backend) + MongoDB Atlas (DB)
- **Auth**: JWT + bcrypt, role-based (admin / leader / employee)
- **UI**: Mobile-first PWA, dark/light theme, vanilla CSS design system

---

## Cấu trúc thư mục

```
QLY_CHAM_CONG/
├── client/                          # React Frontend (Vite 8)
│   ├── src/
│   │   ├── pages/                   # 12 page components
│   │   │   ├── CheckInPage.jsx      # Chấm công GPS (check-in / check-out)
│   │   │   ├── DashboardPage.jsx    # Dashboard tổng quan (admin/leader)
│   │   │   ├── HistoryPage.jsx      # Lịch sử chấm công + Calendar view
│   │   │   ├── LoginPage.jsx        # Đăng nhập
│   │   │   ├── ForgotPasswordPage.jsx # Quên mật khẩu
│   │   │   ├── ProfilePage.jsx      # Thông tin cá nhân + đổi mật khẩu
│   │   │   ├── ProjectsPage.jsx     # Quản lý dự án / công trình
│   │   │   ├── ReportPage.jsx       # Báo cáo tổng hợp + PDF export
│   │   │   ├── RequestsPage.jsx     # Đơn từ (nghỉ phép, OT, giải trình...)
│   │   │   ├── SettingsPage.jsx     # Cài đặt hệ thống (admin only)
│   │   │   ├── StaffPage.jsx        # Quản lý nhân sự (admin/leader)
│   │   │   └── UsersPage.jsx        # Quản lý tài khoản nội bộ
│   │   ├── components/              # 6 shared components
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
│   │   │   ├── exportCsv.js         # CSV export helper
│   │   │   └── deviceFingerprint.js # Device fingerprint for anti-fraud
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
│   │   │   ├── attendanceController.js # checkin, checkout, today, history, override
│   │   │   ├── correctionController.js # Yêu cầu sửa chấm công
│   │   │   ├── dashboardController.js  # Dashboard stats + pending count
│   │   │   ├── exportController.js     # Excel export (xlsx)
│   │   │   ├── holidayController.js    # Quản lý ngày lễ
│   │   │   ├── leaveBalanceController.js # Quản lý ngày phép
│   │   │   ├── locationController.js   # CRUD vị trí GPS văn phòng
│   │   │   ├── notificationController.js # CRUD thông báo + broadcast
│   │   │   ├── projectController.js    # CRUD dự án / công trình
│   │   │   ├── reportController.js     # Báo cáo matrix + chi tiết cá nhân
│   │   │   ├── requestController.js    # CRUD đơn từ + approve/reject
│   │   │   ├── systemSettingController.js # Cấu hình ca làm việc
│   │   │   ├── timesheetLockController.js # Chốt công + lock/unlock
│   │   │   └── userController.js       # CRUD nhân viên
│   │   ├── models/                  # 15 Mongoose schemas
│   │   │   ├── User.js              # Nhân viên (multi-department, roles)
│   │   │   ├── Attendance.js        # Bản ghi chấm công/ngày
│   │   │   ├── AttendanceAuditLog.js # Log thay đổi chấm công
│   │   │   ├── AuditLog.js          # Nhật ký thao tác hệ thống
│   │   │   ├── Correction.js        # Yêu cầu sửa công
│   │   │   ├── Department.js        # Phòng ban
│   │   │   ├── DeviceSession.js     # Thiết bị đã xác thực
│   │   │   ├── Holiday.js           # Ngày lễ / ngày nghỉ
│   │   │   ├── LeaveBalance.js      # Số ngày phép còn lại
│   │   │   ├── Notification.js      # Thông báo hệ thống
│   │   │   ├── OfficeLocation.js    # Vị trí GPS văn phòng + geofence
│   │   │   ├── Project.js           # Dự án / công trình
│   │   │   ├── Request.js           # Đơn từ (nghỉ phép, OT, WFH...)
│   │   │   ├── SystemSetting.js     # Cấu hình giờ làm, OT
│   │   │   └── TimesheetLock.js     # Chốt công theo tháng
│   │   ├── routes/                  # 16 Express route files
│   │   ├── middlewares/             # Auth + Role + Rate limiting
│   │   │   ├── authMiddleware.js    # JWT verification
│   │   │   └── roleMiddleware.js    # Role-based access control
│   │   ├── database/               # DB connection + seed
│   │   │   ├── db.js               # MongoDB Atlas connection
│   │   │   └── seed.js             # Initial data seeding
│   │   ├── utils/                  # Helpers
│   │   │   ├── auditLogger.js      # Audit log writer
│   │   │   └── haversine.js        # GPS distance calculation
│   │   └── app.js                  # Entry point + middleware + route mounting
│   ├── .env                        # Environment variables (KHÔNG commit)
│   └── .env.example                # Template biến môi trường
│
├── .agents/AGENTS.md               # Agent rules & conventions
├── CLAUDE.md                       # AI development guide (file này)
├── CONTRIBUTING.md                 # Hướng dẫn đóng góp
├── README.md                       # Project documentation
└── LICENSE                         # MIT License
```

---

## Phân quyền (Role-Based Access Control)

Hệ thống sử dụng 3 vai trò chính. `roleMiddleware.js` tự động map tương thích giữa legacy (`manager`/`staff`) và roles mới (`leader`/`employee`).

| Role | DB Value | Quyền hạn |
|------|----------|-----------|
| **Admin** | `admin` | Toàn quyền: quản lý nhân sự, cài đặt, chốt công, duyệt đơn, xuất báo cáo |
| **Leader** | `leader` (compat: `manager`) | Dashboard, duyệt đơn, xem báo cáo team, quản lý dự án |
| **Nhân viên** | `employee` (compat: `staff`) | Chấm công, nộp đơn, xem lịch sử cá nhân |

### Multi-Department

User model có 2 trường:
- `department_id` (ObjectId) — phòng ban chính (backward compatible)
- `department_ids` (ObjectId[]) — danh sách nhiều phòng ban cùng lúc

---

## Database Models (MongoDB / Mongoose)

| Model | Collection | Mục đích | Unique Index |
|-------|-----------|----------|--------------|
| `User` | users | Nhân viên (email, role, department_ids) | `email` |
| `Attendance` | attendances | Bản ghi chấm công/ngày (GPS, late_tier, OT) | `user_id + date` |
| `AttendanceAuditLog` | attendanceauditlogs | Log thay đổi chấm công | — |
| `AuditLog` | auditlogs | Nhật ký thao tác (append-only) | — |
| `Correction` | corrections | Yêu cầu sửa chấm công | — |
| `Department` | departments | Phòng ban | `name` |
| `DeviceSession` | devicesessions | Thiết bị đã xác thực | — |
| `Holiday` | holidays | Ngày lễ / ngày nghỉ | `date` |
| `LeaveBalance` | leavebalances | Số ngày phép theo năm | `user_id + year` |
| `Notification` | notifications | Thông báo hệ thống | — |
| `OfficeLocation` | officelocations | Vị trí GPS + bán kính geofence | — |
| `Project` | projects | Dự án / công trình | — |
| `Request` | requests | Đơn từ (leave, OT, WFH, business_trip) | — |
| `SystemSetting` | systemsettings | Cấu hình ca làm việc (singleton) | — |
| `TimesheetLock` | timesheetlocks | Chốt công theo tháng | `month + year` |

---

## API Routes

| Prefix | Controller | Auth | Role | Ghi chú |
|--------|-----------|------|------|---------|
| `/api/auth` | authController | Mixed | — | login (public), register/forgot-password (admin/leader) |
| `/api/attendance` | attendanceController | ✅ | — | checkin, checkout, today, history; override (admin/leader) |
| `/api/requests` | requestController | ✅ | — | CRUD đơn từ; approve/reject (admin/leader) |
| `/api/dashboard` | dashboardController | ✅ | admin/leader | Stats tổng quan |
| `/api/users` | userController | ✅ | admin/leader | CRUD nhân viên |
| `/api/departments` | departmentController | ✅ | — | CRUD phòng ban |
| `/api/reports` | reportController | ✅ | admin/leader | Báo cáo matrix + chi tiết cá nhân |
| `/api/locations` | locationController | ✅ | admin | CRUD vị trí GPS |
| `/api/projects` | projectController | ✅ | — | CRUD dự án; create/edit/delete (admin/leader) |
| `/api/leave-balance` | leaveBalanceController | ✅ | admin/leader | Quản lý ngày phép |
| `/api/export` | exportController | ✅ | admin/leader | Xuất Excel |
| `/api/corrections` | correctionController | ✅ | — | CRUD yêu cầu sửa; approve/reject (admin/leader) |
| `/api/settings` | systemSettingController | ✅ | admin | Cấu hình hệ thống |
| `/api/notifications` | notificationController | ✅ | — | CRUD; broadcast (admin/leader) |
| `/api/holidays` | holidayController | ✅ | admin/leader | CRUD ngày lễ |
| `/api/timesheet-lock` | timesheetLockController | ✅ | admin/leader | Chốt công tháng |
| `/api/health` | inline | ❌ | — | Health check endpoint |

---

## Quy tắc code

### Backend (Node.js / Express)
- CommonJS: `require()` / `module.exports`
- snake_case cho DB fields, camelCase cho JS variables
- Mỗi domain có 1 controller + 1 route file
- Error response format: `{ error: "message" }`
- Timezone: `Asia/Ho_Chi_Minh` cho mọi tính toán ngày/giờ
- Date format: `YYYY-MM-DD` (string, không phải Date object)

### Frontend (React / Vite)
- ES Modules: `import` / `export`
- JSX (không TypeScript)
- Zustand cho state management
- API calls qua `services/api.js` (Axios instance có JWT interceptor)
- Routing: `react-router-dom` v7

### CSS / Styling
- Vanilla CSS với CSS variables (không TailwindCSS)
- Design tokens trong `index.css`
- Mobile-first responsive design (min-width 320px)
- Dark/light theme via `[data-theme="dark"]` selector
- Icons: `lucide-react` (line-art, không filled)
- Toast: `react-hot-toast`

### Ngôn ngữ
- Tiếng Việt cho user-facing strings (labels, toast messages, error messages)
- Tiếng Anh cho code (variable names, function names, technical comments)

---

## Bảo mật

- JWT token trong header `Authorization: Bearer <token>`
- Mật khẩu hash: bcrypt (10 rounds)
- GPS bắt buộc khi chấm công (tất cả loại check-in)
- Device fingerprint ghi nhận mỗi lần check-in (chống chấm công hộ)
- Rate limiting: 5000 req/15min (general, auto-skip localhost/dev mode), 100 req/min (check-in)
- CORS: `origin: true` (frontend/backend tách domain)
- `password_hash` KHÔNG BAO GIỜ trả về trong API response
- GPS coordinates phải validate là số hợp lệ trước khi lưu

---

## Database Rules

- Mỗi user chỉ có 1 attendance record/ngày (unique index `user_id + date`)
- `date` field luôn format `YYYY-MM-DD` (string)
- Timezone luôn là `Asia/Ho_Chi_Minh`
- `department_ids` là array ObjectId, `department_id` là ObjectId đơn (backward compat)

---

## Environment Variables

```env
# Server
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
JWT_SECRET=<random-secret-key>
JWT_EXPIRES_IN=7d
NODE_ENV=production

# GPS Office mặc định
OFFICE_LAT=10.7769
OFFICE_LNG=106.7009
OFFICE_RADIUS_METERS=100
```

---

## Seed Data mặc định

- **Admin**: Cấu hình qua `INITIAL_ADMIN_EMAIL` & `INITIAL_ADMIN_PASSWORD` (mặc định: `admin@company.com`)
- **Phòng ban**: Kiến trúc, Kết cấu, Nội thất, Hành chính
- **Văn phòng**: GPS HCM (10.7769, 106.7009), bán kính 100m

---

## Lệnh phát triển

```bash
# Frontend development server
cd client && npm run dev          # http://localhost:5173

# Backend development server
cd server && npm run dev          # http://localhost:5000 (nodemon)

# Production build
cd client && npm run build        # Output → client/dist/

# Start production server (serves both API + built frontend)
cd server && npm start            # http://localhost:5000

# Lint
cd client && npm run lint         # oxlint
```

---

## Deployment

### Frontend (Vercel)
- Build command: `cd client && npm run build`
- Output directory: `client/dist`
- Framework preset: Vite
- SPA routing: `vercel.json` → rewrites all paths to `index.html`

### Backend (Render.com)
- Build command: `cd server && npm install`
- Start command: `cd server && npm start`
- Environment: Node.js
- Auto-deploy from `main` branch
