# ET OFFICE PORTAL — AI Development Guide

## Tổng quan dự án
Hệ thống chấm công thông minh cho công ty kiến trúc ET Architects (~30 nhân viên).
- **Stack**: React (Vite) + Node.js (Express) + MongoDB Atlas
- **Deploy**: Vercel (frontend) + Render.com (backend) + MongoDB Atlas (DB)
- **Auth**: JWT + bcrypt, role-based (admin/manager/staff)

## Cấu trúc thư mục
```
QLY_CHAM_CONG/
├── client/                  # React Frontend (Vite)
│   ├── src/
│   │   ├── pages/           # Các trang chính (CheckIn, Dashboard, History...)
│   │   ├── components/      # Layout, ThemeToggle, MagicCursor
│   │   ├── stores/          # Zustand stores (authStore, themeStore)
│   │   ├── services/        # api.js (Axios), mockApi.js (offline fallback)
│   │   ├── hooks/           # useGeolocation
│   │   ├── utils/           # exportCsv, deviceFingerprint
│   │   └── index.css        # Design system (CSS variables)
│   ├── vercel.json          # Vercel SPA routing
│   └── vite.config.js
├── server/                  # Node.js Backend (Express)
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express routes
│   │   ├── middlewares/     # authMiddleware, roleMiddleware
│   │   ├── database/        # db.js (MongoDB connection), seed.js
│   │   ├── utils/           # auditLogger, haversine
│   │   └── app.js           # Entry point
│   ├── .env                 # Environment variables (KHÔNG commit)
│   └── .env.example
└── database/                # SQL schema reference
```

## Database Models (MongoDB/Mongoose)
| Model | Mục đích |
|---|---|
| `User` | Nhân viên (email, password_hash, role, department_id) |
| `Attendance` | Bản ghi chấm công/ngày (GPS, late_tier, OT) |
| `Department` | Phòng ban |
| `OfficeLocation` | Vị trí văn phòng GPS + bán kính geofence |
| `Project` | Dự án / Công trình |
| `Request` | Đơn từ (late, overtime, leave, wfh, business_trip, other) |
| `LeaveBalance` | Số ngày phép còn lại |
| `SystemSetting` | Cấu hình ca làm (work_start_time, ot_start_time) |
| `AuditLog` | Nhật ký thao tác (append-only) |
| `Correction` | Yêu cầu sửa chấm công |
| `DeviceSession` | Thiết bị đã xác thực (chống chấm công hộ) |

## API Routes
| Prefix | Controller | Ghi chú |
|---|---|---|
| `/api/auth` | authController | login, register, forgot-password, reset-password, change-password, profile, me |
| `/api/attendance` | attendanceController | checkin, checkout, today, history, override/:id |
| `/api/requests` | requestController | CRUD + approve/reject |
| `/api/dashboard` | dashboardController | Stats tổng quan |
| `/api/users` | userController | CRUD nhân viên |
| `/api/departments` | departmentController | CRUD phòng ban |
| `/api/locations` | locationController | CRUD vị trí GPS |
| `/api/projects` | projectController | CRUD dự án |
| `/api/reports` | reportController | Báo cáo tổng hợp |
| `/api/leave-balance` | leaveBalanceController | Quản lý ngày phép |
| `/api/corrections` | correctionController | Yêu cầu sửa công |
| `/api/settings` | systemSettingController | Cấu hình hệ thống |
| `/api/export` | exportController | Xuất CSV |

## Quy tắc code
1. **Backend**: CommonJS (`require`/`module.exports`), snake_case cho DB fields, camelCase cho JS variables.
2. **Frontend**: ES Modules (`import`/`export`), JSX (không TypeScript), Zustand cho state management.
3. **CSS**: Vanilla CSS với CSS variables (không Tailwind). Design tokens trong `index.css`.
4. **Styling**: Mobile-first, dark/light theme via `[data-theme="dark"]`.
5. **Icons**: `lucide-react` (line-art style).
6. **Toast**: `react-hot-toast`.
7. **Routing**: `react-router-dom` v6.
8. **Date/Time**: Timezone `Asia/Ho_Chi_Minh`, format `YYYY-MM-DD` cho date strings.

## Quy tắc bảo mật
- JWT token gắn vào header `Authorization: Bearer <token>`.
- Mật khẩu hash bằng bcrypt (10 rounds).
- GPS bắt buộc khi chấm công (tất cả loại).
- Device fingerprint ghi nhận mỗi lần check-in.
- Rate limiting: 500 req/15min (general), 30 req/min (check-in).
- CORS: `origin: true` (allow all origins vì frontend/backend tách domain).

## Seed Data mặc định
- Admin: `admin@etoffice.vn` / `Admin@123`
- Phòng ban: Kiến trúc, Kết cấu, Nội thất, Hành chính
- Văn phòng: GPS HCM (10.7769, 106.7009), bán kính 100m

## Environment Variables (server/.env)
```
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
OFFICE_LAT=10.7769
OFFICE_LNG=106.7009
OFFICE_RADIUS_METERS=100
```

## Lệnh phát triển
```bash
# Frontend dev
cd client && npm run dev

# Backend dev
cd server && node src/app.js

# Build production
cd client && npm run build
```
