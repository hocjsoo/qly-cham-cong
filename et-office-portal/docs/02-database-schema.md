# Database Schema Documentation
## ET Office Portal — Firestore

Tài liệu này tổng hợp **toàn bộ collection** (v1 + bổ sung v2) ở một chỗ, kèm sơ đồ quan hệ, quy tắc đặt tên field, và chiến lược index.

---

## 1. Sơ đồ quan hệ (logic, không phải FK thật vì NoSQL)

```
companies (1) ──< offices (N)
offices (1) ──< employees (N)
companies (1) ──< workSchedules (N) ──< employees (N, qua workScheduleId)
companies (1) ──< holidays (N)

employees (1) ──< attendance (N, theo ngày)
attendance (1) ──< explanations (N)
attendance (1) ──< dailyReports (1, cùng ngày)
dailyReports (N) ──> projects (N, qua projectLinks[].projectId)

projects (1) ──< projectStats (N, theo tháng, aggregated)
employees (1) ──< leaveRequests (N)

*  (mọi write quan trọng) ──> auditLogs (append-only)
attendance/checkIn|checkOut events ──> activityFeedEvents (projection cho Dashboard)

employees (1) ──< notifications (N, hoặc broadcast recipientId=null)
```

---

## 2. Danh sách collection đầy đủ

| Collection | Mục đích | Ghi bởi |
|---|---|---|
| `companies` | Đa công ty/chi nhánh | Admin (qua Cloud Function) |
| `offices` | Văn phòng theo công ty, GPS/bán kính riêng | Admin |
| `workSchedules` | Ca làm việc khác nhau theo nhóm | Admin |
| `holidays` | Lịch nghỉ lễ | Admin (seed hàng năm) |
| `employees` | Hồ sơ nhân sự | Cloud Function (sync/import) |
| `attendance` | Chấm công theo ngày | Cloud Function (`onCheckIn`/`onCheckOut`) |
| `explanations` | Giải trình muộn/sớm/OT | Employee (trong 72h), Admin/PGĐ (luôn) |
| `dailyReports` | Báo cáo cuối ngày + liên kết dự án | Employee |
| `projects` | Danh mục dự án | Admin |
| `projectStats` | Tổng hợp giờ/OT theo dự án/tháng | Cloud Function (trigger) |
| `leaveRequests` | Đơn nghỉ phép | Employee, duyệt bởi PGĐ |
| `auditLogs` | Nhật ký hành động, append-only | Cloud Function only |
| `activityFeedEvents` | Feed realtime cho Dashboard | Cloud Function |
| `notifications` | Thông báo phân loại | Cloud Function |
| `monthlyClosures` | Trạng thái chốt công theo tháng | Cloud Function (PGĐ trigger) |
| `settings/*` | Cấu hình hệ thống (theme, lateRules, otRule, timesheetSymbols) | Admin |

---

## 3. Chi tiết field từng collection

> Xem chi tiết type đầy đủ tại `00-architecture.md` mục 3 (v1) và mục 3 (v2). Bảng dưới đây bổ sung **ràng buộc & ghi chú vận hành** không có trong file kiến trúc.

### `employees`
| Field | Ràng buộc |
|---|---|
| `email` | unique, lowercase, dùng làm khóa đối chiếu khi login Google |
| `companyId`, `officeId`, `workScheduleId` | bắt buộc, không null từ v2 |
| `dob` | Timestamp; **thêm field phụ `dobMonthDay: string ("MM-DD")`** để query Birthday widget được (Firestore không query theo phần ngày của Timestamp) |
| `role` | enum cố định, thay đổi role phải qua Cloud Function set custom claims, không sửa trực tiếp field này rồi mong client tự nhận quyền mới ngay (cần refresh token) |

### `attendance`
| Field | Ràng buộc |
|---|---|
| `id` | luôn là `${employeeId}_${yyyy-mm-dd}` — đảm bảo mỗi nhân sự chỉ có 1 doc/ngày, tránh race condition khi bấm Check In 2 lần |
| `workflowStatus` | chỉ chuyển đúng theo state machine ở ADR-007, validate ở Cloud Function + Security Rules |
| `checkIn`/`checkOut` | object con, không tách collection riêng vì luôn đọc cùng nhau (1 doc/ngày là đơn vị truy vấn chính) |

### `explanations`
| Field | Ràng buộc |
|---|---|
| `editableUntil` | = `checkIn.time` hoặc `checkOut.time` (tùy `type`) + 72h, tính ở Cloud Function lúc tạo, không tính ở client |

### `dailyReports`
| Field | Ràng buộc |
|---|---|
| `projectLinks[].hours` | optional ở Phase 1 (chưa bắt buộc nhập giờ theo dự án), **bắt buộc** khi Project Dashboard (Phase 2) cần số liệu chính xác |

### `projectStats`
| Field | Ràng buộc |
|---|---|
| `id` | `${projectId}_${yyyy-mm}`, ghi đè (upsert) mỗi lần trigger chạy lại, không append |

### `auditLogs`
| Field | Ràng buộc |
|---|---|
| toàn bộ collection | **append-only** — Security Rules chặn `update`/`delete` tuyệt đối kể cả với `admin` |

### `settings/theme`, `settings/lateRules`, `settings/otRule`, `settings/timesheetSymbols`
| Field | Ràng buộc |
|---|---|
| toàn bộ | chỉ `admin` được ghi; đọc công khai cho mọi user đã đăng nhập (cần để render UI đúng màu/ký hiệu) |

---

## 4. Quy tắc đặt tên field (naming convention cho schema)

- `camelCase` cho toàn bộ field.
- Timestamp field kết thúc bằng `At` (`createdAt`, `updatedAt`, `closedAt`) hoặc `Date`/`Time` khi mang ý nghĩa nghiệp vụ cụ thể (`joinDate`, `checkIn.time`).
- Boolean bắt đầu bằng `is`/`has` (`isLocked`, `isRead`, `isWorkingDay`).
- ID tham chiếu collection khác: `<tênCollectionSốÍt>Id` (`employeeId`, `projectId`, `officeId`).
- Enum lưu dạng string (không lưu số) để đọc trực tiếp trên Firestore Console dễ debug.

---

## 5. Chiến lược Index

Firestore composite index cần khai báo tường minh trong `firestore.indexes.json`:

| Collection | Composite index | Dùng cho |
|---|---|---|
| `attendance` | `employeeId ASC, date DESC` | Lịch sử chấm công 1 nhân sự |
| `attendance` | `date ASC, workflowStatus ASC` | Dashboard PGĐ drill-down |
| `attendance` | `date ASC, lateStatus ASC` | StatCard "Đi muộn" |
| `explanations` | `employeeId ASC, createdAt DESC` | List giải trình cá nhân |
| `auditLogs` | `actorId ASC, timestamp DESC` | Xem log theo người |
| `auditLogs` | `targetCollection ASC, timestamp DESC` | Xem log theo đối tượng |
| `activityFeedEvents` | `timestamp DESC` | Feed Dashboard (limit 20) |
| `projectStats` | `projectId ASC, month DESC` | Project Dashboard theo thời gian |
| `employees` | `officeId ASC, status ASC` | List nhân sự theo văn phòng |
| `employees` | `dobMonthDay ASC` | Birthday widget |
| `notifications` | `recipientId ASC, isRead ASC, createdAt DESC` | Notification Center |

---

## 6. Ước tính chi phí đọc/ghi (định hướng, không phải cam kết)

- Check In/Out: 1 read (kiểm tra doc hôm nay đã tồn tại) + 1–2 write (Cloud Function) + 1 write `activityFeedEvents` + 1 write `auditLogs` ≈ 4–5 thao tác/lượt chấm công.
- Dashboard PGĐ: nhờ `activityFeedEvents` + `projectStats` aggregated, tránh quét toàn bộ `attendance` mỗi lần mở trang — đây là lý do bắt buộc phải có 2 collection này thay vì tính runtime.
- Với quy mô nhân sự vừa và nhỏ (vài chục–vài trăm người), chi phí Firestore ở mức thấp trong Blaze plan; nên theo dõi qua Firebase Console Budget Alert.
