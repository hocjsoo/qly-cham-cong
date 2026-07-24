# ET Office Portal

> Hệ thống chấm công thông minh cho công ty kiến trúc ~20 nhân viên
> Mobile-first PWA | GPS Geofencing | Dashboard thời gian thực | MongoDB Atlas

## 📁 Cấu trúc thư mục

```
et-office-portal/
├── client/         # React + Vite Frontend (PWA)
├── server/         # Node.js + Express Backend API (MongoDB Atlas)
└── database/       # Schema & Seeds
```

## 🔐 Phân quyền 3 Roles (Admin / Manager / Staff)

| Role | Menu truy cập | Chức năng chính |
|------|---------------|-----------------|
| 👑 **Admin** (Phó Giám Đốc) | Chấm công, Dashboard, Đơn từ, Lịch sử, **Nhân sự** | Quản lý toàn bộ NV, duyệt đơn toàn công ty, xem GPS Maps, xuất Excel |
| ⭐ **Manager** (Trưởng phòng) | Chấm công, Dashboard (Team), Đơn từ, Lịch sử | Xem sĩ số team mình, duyệt/từ chối đơn cho team mình, xem GPS team |
| 👤 **Staff** (Nhân viên) | Chấm công, Đơn từ, Lịch sử | Check-in/out GPS Mobile, tạo đơn giải trình, xem lịch sử cá nhân |

## 🚀 CÁCH CHẠY LẠI DỰ ÁN KHI MỞ MÁY TÍNH

### Bước 1: Khởi động Server (Backend API & Client)
Mở cửa sổ PowerShell:
```bash
cd d:\QLY_CHAM_CONG\server
npm run dev
```
👉 Server sẽ chạy tại: **`http://localhost:5000`**

### Bước 2 (Tùy chọn): Chạy Frontend ở chế độ Code Live
Mở cửa sổ PowerShell thứ hai:
```bash
cd d:\QLY_CHAM_CONG\client
npm run dev
```
👉 Trình duyệt web client tại: **`http://localhost:5173`**

### Bước 3 (Tùy chọn): Tạo lại Link Live công khai cho điện thoại từ xa
Mở cửa sổ PowerShell thứ ba:
```bash
npx localtunnel --port 5000
```
👉 Tự động tạo link online dạng `https://xxxx.loca.lt` gửi cho người khác mở trên điện thoại (4G/WiFi bất kỳ)!

---

## 🔑 Tài khoản Admin mặc định

| Email | Mật khẩu | Role |
|-------|----------|------|
| admin@etoffice.vn | Admin@123 | Admin |

## 📡 API Endpoints

| Method | URL | Mô tả | Auth |
|--------|-----|-------|------|
| POST | /api/auth/login | Đăng nhập | ❌ |
| GET | /api/auth/me | Thông tin user | ✅ |
| POST | /api/attendance/checkin | Check-in GPS | ✅ |
| POST | /api/attendance/checkout | Check-out | ✅ |
| GET | /api/attendance/today | Trạng thái hôm nay | ✅ |
| GET | /api/attendance/history | Lịch sử tháng | ✅ |
| GET | /api/requests | Danh sách đơn | ✅ |
| POST | /api/requests | Tạo đơn | ✅ |
| GET | /api/requests/pending | Đơn chờ duyệt | Manager/Admin |
| PATCH | /api/requests/:id/approve | Duyệt đơn | Manager/Admin |
| PATCH | /api/requests/:id/reject | Từ chối đơn | Manager/Admin |
| GET | /api/dashboard/today | Dashboard hôm nay | Manager/Admin |
| GET | /api/users | Danh sách nhân viên | Admin |
| POST | /api/users | Thêm nhân viên | Admin |
| PATCH | /api/users/:id | Cập nhật nhân viên | Admin |
