# 🤝 Hướng Dẫn Đóng Góp (Contributing Guide)

Chào mừng bạn đến với tài liệu hướng dẫn đóng góp mã nguồn cho dự án **ET Office Portal**. Dự án được xây dựng và phát triển độc quyền bởi **Nguyễn Danh Học** ([@hocjsoo](https://github.com/hocjsoo)).

Tài liệu này quy định chi tiết về quy chuẩn phát triển, quy trình kiểm thử và văn hóa viết mã nhằm duy trì chất lượng hệ thống ở mức **10/10 VIP PRO**.

---

## 📑 Mục Lục

1. [Quy Chuẩn Code & Kiến Trúc](#1-quy-chuẩn-code--kiến-trúc)
2. [Quy Trình Phát Triển & Branching](#2-quy-trình-phát-triển--branching)
3. [Quy Chuẩn Kiểm Thử (321 Test Cases)](#3-quy-chuẩn-kiểm-thử-321-test-cases)
4. [Bảo Mật & Phân Quyền (RBAC)](#4-bảo-mật--phân-quyền-rbac)
5. [Quy Trình Tạo Pull Request (PR Checklist)](#5-quy-trình-tạo-pull-request-pr-checklist)

---

## 1. Quy Chuẩn Code & Kiến Trúc

### 1.1. Frontend (React 19 + Vite 8)
- Sử dụng **Functional Components** và React Hooks chuẩn mực.
- Quản lý trạng thái toàn cục bằng **Zustand** (`authStore.js`, `themeStore.js`).
- UI tuân thủ hệ thống Design Tokens trong `client/src/index.css` (hỗ trợ đầy đủ Dark/Light Theme).
- Mọi icon sử dụng thư viện **lucide-react**.
- Đảm bảo responsive mobile-first và hỗ trợ PWA đầy đủ.

### 1.2. Backend (Node.js + Express 4 + Mongoose 9)
- Phân tách rõ ràng kiến trúc 3 lớp: `Routes` -> `Middlewares` -> `Controllers` -> `Models`.
- Mọi logic nghiệp vụ xử lý trong Controllers, không viết code logic trực tiếp trong Route files.
- Xử lý thời gian và ngày tháng nghiêm ngặt theo múi giờ Việt Nam `Asia/Ho_Chi_Minh` (UTC+7).
- Dữ liệu trả về qua API phải tuân thủ chuẩn **3-Tier DTO** (lọc bỏ trường nhạy cảm theo vai trò người dùng).

---

## 2. Quy Trình Phát Triển & Branching

1. **Clone & Cài đặt môi trường:**
   ```bash
   git clone https://github.com/hocjsoo/QLY_CHAM_CONG.git
   cd QLY_CHAM_CONG
   cd server && npm install
   cd ../client && npm install
   ```
2. **Tạo nhánh tính năng mới:**
   ```bash
   git checkout -b feature/ten-tinh-nang-moi
   # hoặc: git checkout -b fix/ten-loi-can-sua
   ```
3. **Chạy môi trường phát triển cục bộ:**
   - Backend: `cd server && npm run dev` (Port 5000)
   - Frontend: `cd client && npm run dev` (Port 5173)

---

## 3. Quy Chuẩn Kiểm Thử (321 Test Cases)

Mọi tính năng mới hoặc chỉnh sửa bắt buộc phải vượt qua toàn bộ **40 Test Suites / 321 Test Cases** tự động trước khi merge.

```bash
cd server && npm test
```

### Yêu cầu kiểm thử:
- **Zero-Impact**: Toàn bộ unit/integration test chạy in-memory / mock, không được ghi đè hay làm bẩn dữ liệu thật trên MongoDB Atlas.
- **Rollback Fault-Tolerance**: Các thao tác đơn từ (hủy/từ chối/revert) phải có test kiểm tra hoàn lại ngày phép và trừ giờ OT tương ứng.
- **Mutation & Security**: Viết bổ sung test case cho các case biên (Edge cases, Fuzzing, NoSQL Injection).

---

## 4. Bảo Mật & Phân Quyền (RBAC)

- **Mật khẩu**: Bắt buộc băm bằng `bcrypt` với 10 salt rounds.
- **JWT Token**: Bắt buộc kiểm tra qua `authMiddleware` trên các private routes.
- **Phân quyền vai trò**:
  - `Admin`: Toàn quyền quản trị, sửa/xóa giờ công, sửa thông tin xe, chốt công.
  - `Leader`: Chỉ được quản lý nhân viên và duyệt đơn trong phòng ban mình phụ trách.
  - `PM`: Quản lý tiến độ dự án được phân công.
  - `Employee`: Quyền cá nhân.
- **Anti-Fraud**: Không được can thiệp làm suy yếu thuật toán tạo chữ ký phần cứng `pure_hardware_uuid`.

---

## 5. Quy Trình Tạo Pull Request (PR Checklist)

Trước khi submit Pull Request, hãy đảm bảo đã hoàn thành checklist sau:

- [ ] Toàn bộ 321/321 test cases chạy PASS 100% (`npm test` trong `server/`).
- [ ] Không có lỗi cú pháp hoặc cảnh báo lint (`npm run lint` trong `client/`).
- [ ] Build frontend thành công không lỗi (`npm run build` trong `client/`).
- [ ] Đã cập nhật tài liệu liên quan trong `README.md` hoặc `HUONG_DAN_SU_DUNG.md` nếu có thay đổi tính năng.
- [ ] Commit message rõ ràng theo quy chuẩn Conventional Commits (ví dụ: `feat: ...`, `fix: ...`, `docs: ...`).

---

*Cảm ơn bạn đã đồng hành xây dựng **ET Office Portal** trở nên hoàn thiện hơn!*

