# 🖥️ ET Office Portal — Frontend Client (React 19 + Vite 8)

> Giao diện người dùng Web App / Mobile PWA hiệu năng cao, xây dựng trên nền tảng **React 19** và **Vite 8**, hỗ trợ Responsive đa thiết bị và hệ thống giao diện Dark / Light Mode tự động.

---

## 🛠️ Công Nghệ & Thư Viện Cốt Lõi

- **Core Framework**: React 19 (ES Modules, Hooks thuần, Fast Refresh)
- **Bundler & Build Tool**: Vite 8
- **Global State Management**: Zustand (`authStore`, `themeStore`)
- **Routing & Navigation**: `react-router-dom` v7
- **HTTP Client**: Axios với Interceptor đính kèm JWT Bearer Token tự động & Offline Fallback
- **Icons & UI Components**: `lucide-react` + `react-hot-toast` + `leaflet` (GPS Map Picker)
- **Security & Hardware Fingerprint**: `deviceFingerprint.js` (Mã hóa phần cứng WebGL, Audio Context, Screen, CPU)
- **Design System**: Vanilla CSS Variables & Design Tokens tại `src/index.css`

---

## 📁 Cấu Trúc Thư Mục `client/src/`

```
client/src/
├── components/                 # UI Components dùng chung
│   ├── ConfirmDialog.jsx       # Hộp thoại xác nhận hành động nguy hiểm
│   ├── HeaderActions.jsx       # Nút chuyển theme & chuông thông báo
│   ├── Layout.jsx              # App Shell (Sidebar desktop + Bottom bar mobile)
│   ├── MagicCursor.jsx         # Hiệu ứng con trỏ chuột desktop
│   ├── MapGpsPicker.jsx        # Bộ chọn vị trí GPS bản đồ tương tác
│   ├── NotificationCenter.jsx  # Trung tâm thông báo đẩy realtime
│   └── ThemeToggle.jsx         # Nút chuyển đổi Dark / Light Theme
├── hooks/                      # Custom React Hooks
│   └── useGeolocation.js       # Hook định vị GPS độ chính xác cao
├── pages/                      # 14 Màn hình chính của hệ thống
│   ├── CheckInPage.jsx         # Chấm công GPS, Selfie & Geofencing
│   ├── DashboardPage.jsx       # Bảng điều khiển quản trị sĩ số realtime
│   ├── ExpensesPage.jsx        # Bảng chi tiêu, tạm ứng & hoàn ứng
│   ├── ForgotPasswordPage.jsx  # Quên mật khẩu & xác thực mã OTP
│   ├── HistoryPage.jsx         # Lịch sử chấm công + Stepper +-15p
│   ├── LeaderboardPage.jsx     # Bảng xếp hạng chuyên cần Ngày / Tuần / Tháng
│   ├── LoginPage.jsx           # Đăng nhập hệ thống
│   ├── ProfilePage.jsx         # Hồ sơ cá nhân & đổi xe/mật khẩu
│   ├── ProjectsPage.jsx        # Quản lý dự án & phân quyền PM
│   ├── ReportPage.jsx          # Báo cáo matrix 31 ngày & xuất PDF/Excel
│   ├── RequestsPage.jsx        # Quản lý đơn từ & duyệt ca cảnh báo
│   ├── SettingsPage.jsx        # Cấu hình ca làm việc hệ thống (Admin)
│   ├── StaffPage.jsx           # Quản lý nhân sự & gán máy chính chủ
│   └── VehiclesPage.jsx        # Bảng phương tiện gửi xe Tòa 17T10
├── services/                   # Tầng giao tiếp API Backend (api.js)
├── stores/                     # Zustand Stores quản lý trạng thái toàn cục
├── utils/                      # Tiện ích băm phần cứng & xuất CSV UTF-8
├── App.jsx                     # Component gốc & Cấu hình Routes
├── main.jsx                    # Entry point khởi tạo React DOM
└── index.css                   # Hệ thống Design Tokens & CSS Variables
```

---

## 🚀 Hướng Dẫn Phát Triển & Build

```bash
# 1. Cài đặt thư viện
npm install

# 2. Chạy môi trường phát triển (Dev Server với HMR)
npm run dev

# 3. Kiểm tra lỗi cú pháp (Lint)
npm run lint

# 4. Đóng gói bản Production
npm run build

# 5. Chạy thử bản Build
npm run preview
```

---

*Phát triển độc quyền bởi **[hocjsoo](https://github.com/hocjsoo)**.*
