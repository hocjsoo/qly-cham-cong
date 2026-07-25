# Hướng Dẫn Đóng Góp — ET Office Portal

Cảm ơn bạn đã quan tâm đến dự án! Dưới đây là quy trình đóng góp code.

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
   # Terminal 1
   cd server && npm run dev

   # Terminal 2
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

- **JavaScript thuần** — không TypeScript
- **Vanilla CSS** — không TailwindCSS
- **Tiếng Việt** cho user-facing strings, **tiếng Anh** cho code
- **Mobile-first** responsive design
- Xem thêm: [AGENTS.md](.agents/AGENTS.md)

### 3. Kiểm tra trước khi commit

```bash
# Lint
cd client && npm run lint

# Build test
cd client && npm run build
```

### 4. Commit

```bash
git add .
git commit -m "feat: mô tả tính năng mới"
# hoặc
git commit -m "fix: mô tả lỗi đã sửa"
```

**Commit message format:**
- `feat:` — Tính năng mới
- `fix:` — Sửa lỗi
- `docs:` — Cập nhật documentation
- `style:` — Thay đổi CSS / formatting
- `refactor:` — Tái cấu trúc code
- `perf:` — Cải thiện hiệu suất

### 5. Push & tạo Pull Request

```bash
git push origin feature/ten-tinh-nang
```

Tạo Pull Request trên GitHub với:
- Mô tả rõ thay đổi
- Screenshots (nếu liên quan UI)
- Liên kết đến issue (nếu có)

---

## 🐛 Báo cáo lỗi

Tạo [Issue](https://github.com/hocjsoo/qly-cham-cong/issues) với:
- Mô tả lỗi chi tiết
- Các bước để tái tạo lỗi
- Screenshots / logs
- Thông tin trình duyệt & thiết bị

---

## 📋 Quy tắc ứng xử

- Tôn trọng lẫn nhau
- Review code mang tính xây dựng
- Không spam, không quảng cáo
