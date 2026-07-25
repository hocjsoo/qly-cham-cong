# ADR — Architecture Decision Records
## ET Office Portal

Mỗi ADR ghi: bối cảnh, quyết định, lý do, đánh đổi (trade-off), phương án đã cân nhắc nhưng không chọn.

---

### ADR-001: React + Vite + TypeScript làm nền frontend
**Quyết định**: dùng Vite thay vì Next.js/CRA.
**Lý do**: đây là internal tool sau tường lửa công ty, không cần SSR/SEO. Vite build nhanh, dev server nhanh, phù hợp app nội bộ nhiều màn hình tương tác (dashboard, bảng).
**Đánh đổi**: mất khả năng SSR nếu sau này cần trang public (vd landing page mời ứng viên) — nếu cần, tách riêng 1 site Next.js độc lập, không ép Portal phải SSR.
**Phương án khác đã xét**: Next.js (App Router) — không chọn vì overhead không cần thiết cho internal tool.

---

### ADR-002: Firestore (NoSQL) thay vì PostgreSQL/MySQL
**Quyết định**: Firestore.
**Lý do**: cần realtime (Dashboard, Activity Feed, Check In list) — Firestore có realtime listener native. Tích hợp sẵn với Firebase Auth (custom claims) và Security Rules cho RBAC ngay ở tầng DB, giảm rủi ro lộ dữ liệu qua client.
**Đánh đổi**: không có JOIN, không có transaction phức tạp dễ như SQL → phải denormalize (vd lưu `employeeName` lặp lại trong `activityFeedEvents`) và tính toán tổng hợp (`projectStats`) qua Cloud Function thay vì SQL aggregate query.
**Phương án khác đã xét**: Supabase (Postgres + realtime) — cân nhắc tốt nhưng team đã quen hệ Firebase, và Firestore Security Rules kiểm soát quyền tới từng field tốt hơn cho yêu cầu "khóa dữ liệu sau chốt công".

---

### ADR-003: Toàn bộ tính toán nghiệp vụ nhạy cảm chạy ở Cloud Functions, không ở client
**Quyết định**: `onCheckIn`, `onCheckOut`, `closeMonthlyAttendance`, `syncEmployeesFromSheet`, ghi `auditLogs` đều là Cloud Function; client **không có quyền ghi trực tiếp** các field tính toán (`lateStatus`, `otMinutes`, `flags`) vào Firestore.
**Lý do**: đây là hệ thống chấm công — nếu client tự tính giờ/trạng thái, nhân viên có thể sửa DevTools để gian lận. Cloud Function chạy server-side, dùng server timestamp, không tin dữ liệu client gửi lên cho các field quyết định lương/công.
**Đánh đổi**: chi phí Firebase chuyển từ Spark (free) sang **Blaze (trả theo dùng)** vì Cloud Functions + outbound network (gọi Google Sheets API) yêu cầu Blaze. Đây là chi phí bắt buộc, đã nêu ở rủi ro trong v1.
**Phương án khác đã xét**: Firestore Security Rules validation thuần (không cần Cloud Function) — không đủ vì rules không tính được khoảng cách GPS hay gọi API ngoài (Google Sheets).

---

### ADR-004: Modular Monolith (modules/ trong 1 app) thay vì Micro-frontend
**Quyết định**: 1 app Vite duy nhất, chia theo `modules/`.
**Lý do**: quy mô đội ngũ hiện tại nhỏ, chưa cần độ phức tạp của micro-frontend (multi-deploy, module federation). Modular Monolith vẫn đảm bảo mỗi module độc lập về code, dễ tách ra sau nếu cần.
**Đánh đổi**: nếu 1 module lỗi build có thể ảnh hưởng toàn app (khác với micro-frontend deploy độc lập) — chấp nhận được ở quy mô hiện tại, review kỹ CI trước khi bùng nổ về sau.
**Ngưỡng để đổi hướng**: khi >5 module hoạt động độc lập cần deploy riêng lịch khác nhau, hoặc >3 team code song song — lúc đó cân nhắc tách micro-frontend.

---

### ADR-005: Đổi tên dự án thành "ET Office Portal", Attendance là module
**Quyết định**: root README, package name, Firebase project alias đều dùng `et-office-portal`; `attendance` chỉ là 1 thư mục trong `modules/`.
**Lý do**: tránh nợ kỹ thuật đặt tên — nếu đặt tên repo/project là "attendance-app" từ đầu, khi thêm Projects/HR/KPI sẽ phải rename toàn bộ (Firebase project ID không đổi được sau khi tạo).
**Đánh đổi**: không có, đây là chi phí gần như bằng 0 nếu làm đúng từ đầu.

---

### ADR-006: `companies` + `offices` tách riêng ngay từ Phase 1
**Quyết định**: có `companies`/`offices` từ đầu dù hiện tại chỉ có 1 công ty, 1 văn phòng.
**Lý do**: `employees.officeId` là **foreign key**, nếu thêm sau phải migrate toàn bộ document `employees` + cập nhật lại mọi Cloud Function đọc `settings/office`. Chi phí thêm ngay từ đầu rất nhỏ (thêm 2 collection, 1 lần seed), chi phí thêm sau rất lớn (migration + rủi ro downtime chấm công).
**Đánh đổi**: thêm 1 lớp abstraction cho hệ thống hiện chỉ có 1 văn phòng — chấp nhận vì đúng nguyên tắc "portal mở rộng được".

---

### ADR-007: Workflow dạng State Machine (`workflowStatus` enum) thay vì boolean `isLocked`
**Quyết định**: dùng enum `draft|submitted|need_explanation|approved|rejected|locked`.
**Lý do**: boolean chỉ trả lời được "khóa hay chưa", không mô tả được nhân sự đang ở bước nào trong quy trình duyệt — cần cho UI hiển thị đúng hành động khả dụng (nút Duyệt/Từ chối chỉ hiện khi `submitted`/`need_explanation`).
**Đánh đổi**: phức tạp hơn 1 chút khi viết Security Rules (phải validate transition hợp lệ, vd không cho nhảy thẳng `draft → locked`).

---

### ADR-008: Aggregation qua collection riêng (`projectStats`) thay vì tính realtime
**Quyết định**: Cloud Function trigger tính lại `projectStats` mỗi khi `dailyReports` thay đổi, Project Dashboard chỉ đọc `projectStats`, không quét `dailyReports` trực tiếp.
**Lý do**: Firestore không có aggregate query mạnh như SQL `SUM/GROUP BY`; quét hàng nghìn document mỗi lần mở Dashboard vừa chậm vừa tốn quota đọc (tính phí theo số lượt đọc).
**Đánh đổi**: dữ liệu Project Dashboard có độ trễ nhỏ (vài giây, do trigger async) thay vì tuyệt đối realtime — chấp nhận được vì đây là dashboard thống kê, không phải giao dịch tài chính tức thời.

---

### ADR-009: Vercel cho frontend, Firebase cho toàn bộ backend
**Quyết định**: Vercel chỉ host static build của Vite app; Auth/DB/Functions/Storage đều trên Firebase.
**Lý do**: Vercel deploy preview theo PR rất tiện cho review UI; Firebase là hệ sinh thái nhất quán cho phần backend (Auth + Firestore + Functions cùng 1 project, cùng IAM).
**Đánh đổi**: 2 nhà cung cấp = 2 nơi cấu hình biến môi trường, 2 bill riêng — chấp nhận vì tách bạch rõ trách nhiệm (frontend hosting vs backend logic).

---

### ADR-010: Backup tự động 7 ngày, không dùng backup thủ công
**Quyết định**: Cloud Scheduler + Cloud Function export Firestore hàng ngày, retention 7 bản.
**Lý do**: đây là dữ liệu lương/công — mất dữ liệu là rủi ro nghiêm trọng nhất của hệ thống. Không thể phụ thuộc vào việc con người nhớ backup thủ công.
**Đánh đổi**: chi phí lưu trữ GCS/Drive nhỏ, chấp nhận được so với rủi ro mất dữ liệu.
