# 🖥️ ET Office Portal — Frontend Client

Ứng dụng Single Page Application (SPA) xây dựng bằng **React 19** và **Vite 8**, thiết kế theo phong cách hiện đại với **Vanilla CSS Design System**.

---

## 🛠️ Công Nghệ Sử Dụng

- **Framework**: React 19 (JSX thuần, JavaScript ES Modules)
- **Bundler / Build tool**: Vite 8
- **State Management**: Zustand stores (`authStore`, `themeStore`)
- **Routing**: `react-router-dom` v7
- **HTTP Client**: Axios (với interceptor tự động đính kèm JWT Token và xử lý offline fallback)
- **Icons**: `lucide-react` (line-art style)
- **Toast Notifications**: `react-hot-toast`
- **UI Design System**: Vanilla CSS tokens trong `src/index.css` với hỗ trợ Dark / Light theme

---

## 📁 Cấu Trúc Mã Nguồn Frontend

```
client/src/
├── components/         # Shared components (Layout, HeaderActions, ConfirmDialog, MagicCursor...)
├── hooks/              # Custom React hooks (useGeolocation...)
├── pages/              # 14 Page components (CheckIn, Dashboard, History, Staff, Requests, Projects...)
├── services/           # Axios API instance (api.js)
├── stores/             # Zustand stores (authStore.js, themeStore.js)
├── utils/              # Helper functions (exportCsv.js, deviceFingerprint.js)
├── App.jsx             # Root routing component
├── main.jsx            # Entry point
└── index.css           # Global CSS variables & token system
```

---

## 🚀 Lệnh Phát Triển & Build

```bash
# Cài đặt dependencies
npm install

# Khởi chạy dev server (HMR tức thì)
npm run dev

# Build đóng gói bản production
npm run build

# Xem trước bản build
npm run preview
```
