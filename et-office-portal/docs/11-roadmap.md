# Roadmap
## ET Office Portal

---

## Phase 1 — Nền tảng + Chấm công + Dashboard

**Nền tảng (bắt buộc làm đúng từ đầu, tránh migrate sau)**
- [ ] Setup monorepo (`apps/web`, `functions/`), CI cơ bản (lint + build + rules test).
- [ ] Design tokens (`settings/theme`) + Tailwind config trỏ CSS variables.
- [ ] Seed `companies`, `offices` (Hà Nội mặc định), `workSchedules` (ca chuẩn), `holidays` (năm hiện tại).

**Auth**
- [ ] Google Login, đối chiếu `employees`, custom claims theo role, AccessDeniedPage.

**HR (một phần)**
- [ ] Import ban đầu từ Google Sheet (script khởi tạo `employees`).
- [ ] `syncEmployeesFromSheet` Cloud Function + nút "Đồng bộ nhân sự".

**Attendance**
- [ ] Check In/Out (GPS, device, flags chống gian lận) qua `onCheckIn`/`onCheckOut`.
- [ ] Áp dụng `holidays` + `workSchedules` khi tính `lateStatus`.
- [ ] Workflow state machine (`draft → submitted → need_explanation → approved/rejected`).
- [ ] Giải trình (72h), khóa sau thời hạn.
- [ ] Timesheet grid cơ bản (chưa export).
- [ ] Calendar View cơ bản (chưa tô đầy đủ holiday styling nếu thiếu thời gian, ưu tiên chức năng trước).

**Dashboard**
- [ ] StatCard cơ bản (chưa cần clickable drill-down đầy đủ — có thể để Phase 1 cuối).
- [ ] Activity Feed (đọc `activityFeedEvents`).
- [ ] Global Search cơ bản (điều hướng trang/nhân sự).

**Nền an toàn**
- [ ] Firestore Security Rules đầy đủ theo `03-firestore-security-rules.md` + test emulator.
- [ ] Audit Log ghi cho mọi hành động trên.

---

## Phase 2 — Daily Report + Project + Report + Project Dashboard

- [ ] Module `daily-report`: popup cuối ngày, liên kết dự án (`projectLinks`).
- [ ] Module `projects`: CRUD dự án.
- [ ] `aggregateProjectStats` trigger + collection `projectStats`.
- [ ] **Project Dashboard** (mục quan trọng nhất): giờ công/OT/nhân sự theo dự án, drill-down theo nhân sự.
- [ ] Module `reports`: báo cáo theo ngày/tuần/tháng/nhân sự/dự án + biểu đồ + Export Excel/PDF.
- [ ] Hoàn thiện quy trình chốt công: duyệt hàng loạt, "Chốt công tháng", khóa dữ liệu, xuất bảng lương.
- [ ] Dashboard PGĐ đầy đủ: StatCard clickable drill-down, widget Sinh nhật/Kỷ niệm ngày vào làm.
- [ ] Notification Center phân loại (announcement/system/attendance/leave/project).
- [ ] Import Excel (song song Google Sheet).
- [ ] Motion (Framer Motion) áp dụng cho chuyển trang, StatCard, toast, feed.

---

## Phase 3 — HR mở rộng + KPI + Leave + Notification + Vận hành

- [ ] Module `leave`: đăng ký/duyệt nghỉ phép, đồng bộ vào `attendance.workStatus`.
- [ ] Module `hr` hoàn chỉnh: hồ sơ chi tiết, thống kê cá nhân đầy đủ theo `companies`/`offices`.
- [ ] Module `kpi`: khung đánh giá (schema mở, nghiệp vụ chi tiết thống nhất sau).
- [ ] Backup tự động (`scheduledFirestoreBackup`) + kiểm thử restore lần đầu.
- [ ] Tùy chọn Selfie verification khi Check In (bật/tắt qua `settings`).
- [ ] Global Search nâng cấp (cân nhắc Algolia nếu dữ liệu lớn).
- [ ] Rà soát toàn bộ Motion/Design system, polish UI.

---

## Sau Phase 3 (định hướng — chưa triển khai, chỉ giữ chỗ trong kiến trúc)

| Module tương lai | Ghi chú |
|---|---|
| Tasks | Có thể liên kết `projects` đã có sẵn từ Phase 2 |
| Documents | Dùng Firebase Storage đã có sẵn cấu trúc |
| Finance | Cần thiết kế riêng, liên quan bảng lương đã có export từ Phase 2 |
| Đa công ty thật sự (multi-tenant UI) | Nền tảng `companies`/`offices` đã sẵn sàng từ Phase 1, chỉ cần thêm UI chuyển đổi công ty nếu ET mở công ty con |

---

## Nguyên tắc xuyên suốt mọi Phase

1. Không thêm field/collection "cho nhanh" nếu phá vỡ naming convention hoặc thiếu Security Rules tương ứng.
2. Mọi tính năng ảnh hưởng tới lương/công (chấm công, chốt công, OT) luôn qua Cloud Function, không xử lý client.
3. Mỗi Phase kết thúc bằng: cập nhật lại `docs/` tương ứng (schema mới, rules mới, API mới) trước khi bắt đầu Phase kế tiếp — tài liệu không được phép lạc hậu so với code.
