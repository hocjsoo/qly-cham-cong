# Hướng Dẫn Đóng Góp — ET Office Portal

Cảm ơn bạn đã quan tâm đến dự án! Dưới đây là quy trình và quy chuẩn đóng góp code.

---

## 🔧 Thiết lập môi trường phát triển

1. Fork repository về tài khoản cá nhân
2. Clone fork:
   ```bash
   git clone https://github.com/<your-username>/qly-cham-cong.git
   cd qly-cham-cong
   ```
3. Cài đặt dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
4. Copy `.env.example` → `.env` và cấu hình MongoDB URI
5. Chạy dự án:
   ```bash
   # Terminal 1 (Backend)
   cd server && npm run dev

   # Terminal 2 (Frontend)
   cd client && npm run dev
   ```

---

## 📝 Quy trình đóng góp

### 1. Tạo branch mới

```bash
git checkout -b feature/ten-tinh-nang
# hoặc
git checkout -b fix/mo-ta-loi
```

### 2. Code theo quy tắc
- **JavaScript thuần** — không TypeScript.
- **Vanilla CSS** với CSS Variables — không TailwindCSS.
- **Tiếng Việt** cho user-facing strings (labels, toast messages, thông báo).
- **Tiếng Anh** cho code (variable names, functions, comments).
- **Mobile-first** responsive design (min-width 320px).
- **Phân quyền chuẩn**:
  - `admin`: Toàn quyền quản trị, sửa/xóa giờ công, sửa thông tin xe, tạo/xóa dự án.
  - `leader`: Quản lý team, duyệt đơn, duyệt ca cảnh báo. Không sửa giờ công hay gửi xe.
  - `PM`: Có quyền chỉnh sửa thông tin dự án mình phụ trách.
- Xem chi tiết tại: [.agents/AGENTS.md](.agents/AGENTS.md) và [CLAUDE.md](CLAUDE.md).

### 3. Kiểm tra trước khi commit

```bash
# 1. Chạy bộ kiểm thử tự động (309/309 Test Cases)
cd server && npm test

# 2. Build test Frontend
cd ../client && npm run build
```

### 4. Commit & Tạo Pull Request
- Commit messages viết bằng tiếng Anh theo chuẩn Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`).
- Đẩy branch lên fork và tạo Pull Request vào branch `main`.
