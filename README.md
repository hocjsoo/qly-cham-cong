<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Tests-223%20Passed-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

# 🏢 ET Office Portal

> **Hệ thống quản lý chấm công thông minh & vận hành doanh nghiệp**, được thiết kế & phát triển độc quyền bởi duy nhất **[hocjsoo](https://github.com/hocjsoo)**.
> Mobile-first PWA · GPS Geofencing · Anti-Fraud Chữ Ký Phần Cứng · Báo cáo PDF/Excel · Quản lý Dự Án & Phương Tiện Gửi Xe

---

## ✨ Tính năng nổi bật

### 📱 1. Chấm Công Thông Minh & Anti-Fraud Đa Tầng
- **Check-in / Check-out GPS** với Geofencing tuỳ chỉnh từng văn phòng / công trình.
- Hỗ trợ đầy đủ các hình thức: Văn phòng (Office), Công trình (Site), Khách hàng (Client), Làm từ xa (WFH).
- **Chữ ký phần cứng vật lý (`pure_hardware_uuid`)**:
  - Nhận diện card đồ hoạ WebGL, CPU cores, độ phân giải màn hình, audio context.
  - Chống 100% việc gian lận qua Tab ẩn danh (Incognito) hoặc chuyển trình duyệt trên cùng 1 máy.
  - Tự động bắt chụp **Ảnh Selfie xác thực** khi phát hiện dùng chung thiết bị hoặc tài khoản lạ.
- **Tự động tính toán & phân loại**: Đi muộn theo 4 mức, tính tăng ca OT sau 18:30, chuẩn múi giờ Việt Nam `Asia/Ho_Chi_Minh`.

### 🛡️ 2. Trung Tâm Duyệt Cảnh Báo Ca & Thiết Bị Lạ
- **Bộ lọc đa dạng**: *Chờ duyệt, Thiết bị lạ, Kèm ảnh Selfie, Đã duyệt, Từ chối*.
- **Cơ chế 1-chạm**: Bấm *`✅ Duyệt ca & Tin cậy thiết bị`* tự động mở khóa và lưu thiết bị đó thành **`⭐ Máy chính chủ`**.
- **Gợi ý từ chối thông minh**: Gợi ý sẵn các lý do phổ biến + tùy chọn *Xóa dữ liệu để nhân viên chấm công lại*.
- **Hoàn tác & Xóa ca**: Cho phép hoàn tác ca về trạng thái chờ duyệt hoặc xóa ca vi phạm an toàn.

### 📋 3. Quản Lý Đơn Từ & Quy Trình Phê Duyệt Nâng Cao
- Tạo đơn: Nghỉ phép năm (P), Nghỉ ốm (O), Nghỉ không lương (KL), Tăng ca (OT), WFH, Công tác, Giải trình chấm công, Đổi xe...
- **Phân quyền duyệt an toàn**: Leader duyệt đơn cho nhân sự phòng ban mình, chặn không cho Leader duyệt đơn Admin.
- **Hoàn tác đơn (`revert`) & Xóa đơn (`delete`)**: Tự động hoàn lại ngày phép, trừ giờ OT tương ứng khi đơn bị hủy hoặc hoàn tác.
- **Tích hợp `ConfirmDialog`**: Ngăn chặn 100% thao tác bấm nhầm.

### 🏗️ 4. Quản Lý Dự Án & Phân Quyền PM (Project Manager)
- Khớp 100% biểu mẫu chuẩn Quản lý Thông tin Nhân sự & Dự án.
- **Phân quyền linh hoạt**:
  - **Admin**: Tạo dự án mới, xóa dự án, sửa toàn bộ dự án.
  - **PM phụ trách dự án**: Có quyền cập nhật tiến độ, thời hạn, thông tin dự án mình đang quản lý.
- Hỗ trợ 2 chế độ hiển thị: **Bảng Excel Mẫu** và **Thẻ Card Hiện Đại**.

### 🛵 5. Bảng Phương Tiện & Gửi Xe Tinh Gọn
- Quản lý biển số xe, dòng xe, nơi gửi xe (Tòa 17T10 / Gửi ngoài / Không dùng xe).
- Giao diện bảng được tối ưu tinh gọn (đã lược bỏ cột phòng ban).
- **Chỉ Admin** có quyền sửa thông tin phương tiện gửi xe của nhân viên.

### 🏆 6. Bảng Xếp Hạng & Báo Cáo Chuyên Cần
- Lọc Bảng xếp hạng linh hoạt theo: **Hôm nay**, **Tuần này**, **Tháng này**.
- **Báo cáo matrix 31 ngày**: Render chuẩn không bị xén ngày.
- Xuất báo cáo dạng **PDF A4 độ nét cao 3x** hoặc file **Excel (.xlsx)**.

---

## 🔐 Bảng Phân Quyền Hệ Thống (RBAC)

| Chức năng | Admin | Leader (Trưởng phòng) | PM (Quản lý dự án) | Nhân viên |
|-----------|:-----:|:---------------------:|:------------------:|:---------:|
| Chấm công GPS & Selfie | ✅ | ✅ | ✅ | ✅ |
| Xem lịch sử cá nhân | ✅ | ✅ | ✅ | ✅ |
| Nộp đơn từ cá nhân | ✅ | ✅ | ✅ | ✅ |
| Duyệt đơn từ nhân viên | ✅ | ✅ (Team mình) | ❌ | ❌ |
| Duyệt ca cảnh báo & Selfie | ✅ | ✅ (Team mình) | ❌ | ❌ |
| Điều chỉnh / Xóa giờ công | ✅ (Duy nhất) | ❌ | ❌ | ❌ |
| Sửa thông tin gửi xe NV | ✅ (Duy nhất) | ❌ | ❌ | ❌ |
| Tạo / Xóa dự án | ✅ (Duy nhất) | ❌ | ❌ | ❌ |
| Sửa thông tin dự án | ✅ | ❌ | ✅ (DA phụ trách) | ❌ |
| Chốt công tháng (Lock) | ✅ | ❌ | ❌ | ❌ |
| Cấu hình hệ thống | ✅ | ❌ | ❌ | ❌ |

---

## 🧪 Hệ Thống Kiểm Thử (32 Suites / 223 Test Cases)

Hệ thống tích hợp bộ kiểm thử tự động toàn diện bao gồm Real Express Controller Integration, chạy hoàn toàn trên bộ nhớ (In-Memory), cam kết **Zero-Impact 100%** đến database MongoDB Atlas Prod.

Chạy kiểm thử:
```bash
cd server
npm test
```

```
=========================================================================
📊 BÁO CÁO TỔNG KẾT KẾT QUẢ KIỂM THỬ (TEST SUMMARY REPORT)
-------------------------------------------------------------------------
  • Tổng số kịch bản test (Test Cases) : 223
  • Kịch bản ĐẠT (Passed)              : 223
  • Kịch bản LỖI (Failed)              : 0
  • Tỷ lệ thành công (Pass Rate)       : 100%
  • Thời gian thực thi (Execution)     : Thường hoàn thành dưới 1 giây (< 1s)
  • Cơ sở dữ liệu Prod (MongoDB Atlas) : HOÀN TOÀN NGUYÊN VẸN (0 TÁC ĐỘNG)
=========================================================================
```

---

## 🚀 Hướng Dẫn Cài Đặt

### Yêu cầu
- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB Atlas** (hoặc MongoDB local)

### Cài đặt dependencies & Chạy:
```bash
# 1. Cài đặt dependencies
cd server && npm install
cd ../client && npm install

# 2. Cấu hình biến môi trường server/.env
cp server/.env.example server/.env

# 3. Chạy môi trường phát triển
# Terminal 1 (Backend):
cd server && npm run dev

# Terminal 2 (Frontend):
cd client && npm run dev
```

---

## 📄 Bản Quyền & Tác Giả

- Dự án được phát triển độc quyền bởi **[hocjsoo](https://github.com/hocjsoo)**.
- Giấy phép: **MIT License**.
