# API & Cloud Functions Documentation
## ET Office Portal

Tất cả function dưới đây là **Firebase Cloud Functions (2nd gen, Node.js/TypeScript)**, gọi từ client qua `httpsCallable` (trừ các function `onWrite`/`onSchedule` chạy tự động).

---

## 1. Auth

### `onUserSignIn` (Auth trigger — `beforeSignIn` blocking function)
- **Input**: thông tin user từ Google (email).
- **Xử lý**: tra `employees` theo email → nếu không tồn tại hoặc `status != active` → chặn đăng nhập (throw `HttpsError('permission-denied')`) → ghi `auditLogs` `LOGIN_DENIED`.
- **Output**: set custom claims `{ role, employeeId, companyId, officeId }` nếu hợp lệ.

---

## 2. Attendance

### `onCheckIn` (callable)
- **Input**: `{ lat, lng, deviceId, userAgent }`
- **Xử lý**:
  1. Lấy `employeeId` từ `context.auth.uid`.
  2. Kiểm tra `attendance/{employeeId}_{today}` đã tồn tại chưa (chặn check-in 2 lần).
  3. Đọc `offices/{officeId}` để tính khoảng cách GPS (Haversine).
  4. Đọc `holidays` — nếu hôm nay là ngày nghỉ (`isWorkingDay=false`) → `workStatus="holiday"`, không tính `lateStatus`.
  5. Đọc `workSchedules/{employee.workScheduleId}` (hoặc `settings/lateRules` mặc định) để tính `lateStatus`.
  6. Kiểm tra `deviceId` có khác lần check-in gần nhất không → set `flags.newDevice`.
  7. Ghi `attendance` (`workflowStatus="draft"`), `activityFeedEvents`, `auditLogs`.
- **Output**: `{ success: true, lateStatus, distanceFromOffice, withinRadius }`
- **Lỗi**: `already-exists` (đã check-in hôm nay), `failed-precondition` (nhân sự inactive).

### `onCheckOut` (callable)
- **Input**: `{ lat, lng, deviceId, userAgent }`
- **Xử lý**: tương tự `onCheckIn`, cộng thêm tính `otMinutes` nếu giờ ra sau `otRule.otStartsAfter`. Set `workflowStatus="submitted"`, nếu `lateStatus != on_time` → `need_explanation`.
- **Output**: `{ success: true, otMinutes, workflowStatus }`

### `submitExplanation` (callable)
- **Input**: `{ attendanceId, type, reason }`
- **Xử lý**: kiểm tra còn trong 72h không (dựa `checkIn/checkOut.time`), ghi `explanations`, cập nhật `attendance.workflowStatus` nếu cần.
- **Output**: `{ success: true, editableUntil }`

### `reviewExplanation` (callable, chỉ PGĐ/Admin)
- **Input**: `{ explanationId, decision: "approved"|"rejected", note? }`
- **Xử lý**: cập nhật `explanations.status`, cập nhật `attendance.workflowStatus`, ghi `auditLogs`.

### `closeMonthlyAttendance` (callable, chỉ PGĐ)
- **Input**: `{ month: "2026-07" }`
- **Xử lý**: kiểm tra không còn `explanations` ở trạng thái `pending`; set `workflowStatus="locked"` cho toàn bộ `attendance` trong tháng; tạo `monthlyClosures` doc; ghi `auditLogs` `CLOSE_MONTH`.
- **Output**: `{ success: true, employeeCount, closedAt }`
- **Lỗi**: `failed-precondition` nếu còn giải trình chưa duyệt (liệt kê danh sách trong error detail).

### `unlockAttendanceRecord` (callable, chỉ PGĐ/Admin — sửa dữ liệu đã khóa)
- **Input**: `{ attendanceId, reason }` (bắt buộc lý do)
- **Xử lý**: mở khóa tạm 1 bản ghi, ghi `auditLogs` `UNLOCK_ATTENDANCE` với `reason` — **log này không thể xóa**, phục vụ truy vết sau này.

---

## 3. HR / Company

### `syncEmployeesFromSheet` (callable, chỉ Admin)
- **Input**: `{ sheetId? }` (mặc định lấy từ `settings/hrSync.sheetId`)
- **Xử lý**: đọc Google Sheet qua Service Account → diff với `employees` hiện có → thêm mới/cập nhật/khóa (`status=inactive`) → ghi `auditLogs` `SYNC_EMPLOYEES`.
- **Output**: `{ added: number, updated: number, deactivated: number, errors: string[] }`

### `importEmployeesFromExcel` (callable, chỉ Admin)
- **Input**: `{ fileUrl }` (file đã upload lên Storage trước) hoặc payload JSON đã parse sẵn ở client.
- **Xử lý**: validate cấu trúc cột bắt buộc (`email, fullName, employeeCode, position, department, officeId...`), dùng lại logic diff giống `syncEmployeesFromSheet`.
- **Output**: giống trên, thêm `invalidRows: { row: number; error: string }[]`.

### `manageOffices` / `manageCompanies` (callable, chỉ Admin)
- CRUD chuẩn cho `companies`/`offices`, kèm validate GPS hợp lệ, bán kính > 0.

---

## 4. Projects

### `aggregateProjectStats` (Firestore trigger — `onWrite` trên `dailyReports/{reportId}`)
- **Xử lý**: đọc lại toàn bộ `dailyReports` của tháng đó liên quan `projectId` bị ảnh hưởh, tính `totalHours`, `otHours`, `employeeBreakdown`, upsert vào `projectStats/{projectId}_{month}`.
- Chạy async, không block UI khi employee lưu Daily Report.

---

## 5. Notifications

### `dispatchNotification` (callable/internal, dùng bởi các function khác)
- **Input**: `{ type, title, body, recipientId? }`
- **Xử lý**: ghi `notifications`; nếu `recipientId=null` → broadcast (đánh dấu để client query `recipientId==null`).

### `markNotificationRead` (callable)
- **Input**: `{ notificationId }` — thực chất chỉ update field `isRead`, có thể làm client-side qua rules (`onlyIsReadChanged`), không nhất thiết cần function riêng — liệt kê ở đây để đầy đủ tài liệu API.

---

## 6. Backup

### `scheduledFirestoreBackup` (`onSchedule`, chạy 1:00 sáng hàng ngày, giờ VN)
- **Xử lý**: gọi Firestore Admin API export toàn bộ database → GCS bucket `gs://et-office-portal-backups/{date}` → copy sang thư mục Google Drive quy định qua Drive API → xóa các bản backup cũ hơn 7 ngày (cả GCS lẫn Drive).
- **Output**: log kết quả vào Cloud Logging (không cần lưu Firestore vì đây là hạ tầng, không phải nghiệp vụ).

---

## 7. Quy ước chung cho mọi Cloud Function

- Mọi function callable đều kiểm tra `context.auth` trước tiên, throw `unauthenticated` nếu thiếu.
- Mọi function callable đều kiểm tra `role` phù hợp trước khi xử lý, throw `permission-denied` nếu sai.
- Mọi function ghi/sửa dữ liệu nghiệp vụ đều gọi `writeAuditLog()` helper dùng chung (`functions/src/audit/writeAuditLog.ts`) ở bước cuối, trong cùng transaction nếu có thể.
- Response error luôn dùng `HttpsError` chuẩn của Firebase (`code`, `message`, `details`) để client hiển thị toast lỗi nhất quán.
- Timeout mặc định 60s cho function callable thường, function `syncEmployeesFromSheet`/`importEmployeesFromExcel` cấu hình timeout dài hơn (300s) vì xử lý nhiều bản ghi.
