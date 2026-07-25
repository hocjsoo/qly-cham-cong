# ET OFFICE PORTAL
## Tài liệu Kiến trúc Tổng thể (v2.0)

> **Đổi tên quan trọng**: hệ thống tên là **ET Office Portal**. *Attendance* không phải tên dự án — nó là **module đầu tiên**, ngang hàng với Projects, Tasks, Leave, HR, KPI, Finance... sẽ ra đời sau. Toàn bộ kiến trúc từ v1 được giữ nguyên tinh thần, bổ sung 20 điểm theo yêu cầu để hệ thống thực sự multi-company, multi-office, có workflow rõ ràng và tư duy "portal" chứ không phải "app chấm công".

Tài liệu này là **bản cập nhật v2**, thay thế v1. Các mục không nhắc lại thay đổi thì giữ nguyên như v1 (đã duyệt).

---

## 1. CÁC THAY ĐỔI SO VỚI V1

| # | Bổ sung | Vì sao |
|---|---|---|
| 1 | `companies` collection | Không hard-code "ET Architects" — sẵn sàng multi-brand nếu mở công ty con |
| 2 | `offices` tách khỏi `settings` | Nhiều chi nhánh (Hà Nội, Đà Nẵng, HCM), mỗi office có GPS/bán kính riêng |
| 3 | `holidays` | Tránh hệ thống hiểu sai ngày lễ = vắng mặt |
| 4 | `workSchedules` | Giờ làm khác nhau theo nhóm nhân sự (Intern, Leader...) |
| 5 | `approvalWorkflow` (workflow state machine) | Rõ ràng hơn quan hệ Employee → PGĐ hiện tại |
| 6 | `notifications` phân loại | announcement / system / attendance / leave / project |
| 7 | Activity Feed trên Dashboard | Realtime feed kiểu GitHub |
| 8 | Global Search (⌘K / Ctrl+K) | Điều hướng nhanh kiểu Linear |
| 9 | Dashboard riêng cho PGĐ (drill-down) | Số liệu click được ra danh sách chi tiết |
| 10 | Calendar View cho Attendance | Bổ sung cho Timesheet dạng bảng |
| 11 | Tô màu Public Holiday trên Calendar | Trực quan hóa `holidays` |
| 12 | Birthday widget | Cần field `dob` trong employees |
| 13 | Work Anniversary widget | Tính từ `joinDate` có sẵn |
| 14 | Backup tự động Firestore → Drive, giữ 7 ngày | An toàn dữ liệu production |
| 15 | Import Excel (ngoài Google Sheet) | Linh hoạt nguồn dữ liệu |
| 16 | Design Token hóa toàn bộ theme | Không hard-code màu |
| 17 | Framer Motion (nhẹ) | UI bớt tĩnh |
| 18 | **Project Dashboard** (giờ công/OT/nhân sự theo dự án) | Quan trọng nhất — đúng bản chất công ty kiến trúc |
| 19 | Đổi tên dự án → ET Office Portal | Tư duy nền tảng, không phải app đơn lẻ |
| 20 | Bộ tài liệu kỹ thuật đầy đủ đi kèm | Xem danh sách file ở mục 9 |

---

## 2. CẤU TRÚC THƯ MỤC (cập nhật)

Thêm 2 module mới, giữ nguyên phần còn lại của v1:

```
apps/web/src/modules/
├── company/              # MỚI — quản lý companies + offices (Admin)
│   ├── pages/             # CompanyListPage, OfficeListPage
│   ├── components/
│   ├── services/          # companyService.ts, officeService.ts
│   └── types/
│
├── calendar/              # MỚI — Calendar View cho Attendance + holidays
│   ├── pages/              # AttendanceCalendarPage
│   ├── components/         # MonthGrid, DayCell, HolidayBadge
│   └── hooks/               # useHolidays, useMonthAttendance
│
├── attendance/
│   ├── ...                 # giữ nguyên v1
│   └── components/
│       └── WorkflowStatusBadge.tsx   # MỚI — hiển thị state machine
│
├── projects/
│   ├── pages/
│   │   └── ProjectDashboardPage.tsx  # MỚI — giờ công/OT/nhân sự theo dự án
│   ├── components/
│   │   └── ProjectHoursChart.tsx
│   └── services/
│       └── projectStatsService.ts    # đọc từ projectStats (aggregated)
│
├── notifications/
│   ├── components/
│   │   └── NotificationCenter.tsx    # phân loại 4 nhóm
│   └── ...
│
└── search/                # MỚI — Global Search (⌘K)
    ├── components/
    │   └── CommandPalette.tsx
    └── hooks/
        └── useGlobalSearch.ts
```

`shared/components/layout/` thêm `CommandPaletteProvider` (mount ở App shell, lắng nghe phím tắt toàn cục) và `ActivityFeedWidget` (dùng chung Dashboard nhân viên/PGĐ).

`functions/src/` thêm:
```
functions/src/
├── company/
│   └── manageOffices.ts
├── holidays/
│   └── seedHolidays.ts               # nhập lịch nghỉ lễ VN hàng năm
├── projects/
│   └── aggregateProjectStats.ts      # trigger chạy khi dailyReports ghi mới → cập nhật projectStats
├── notifications/
│   └── dispatchNotification.ts
├── backup/
│   └── scheduledFirestoreBackup.ts   # Cloud Scheduler, export → GCS → Google Drive, retention 7 ngày
└── import/
    └── importEmployeesFromExcel.ts   # song song với syncEmployeesFromSheet
```

---

## 3. DATABASE SCHEMA — BỔ SUNG (v2)

### 3.1. `companies/{companyId}`
```ts
{
  id: string;
  name: string;                 // "ET Architects"
  logoUrl: string;
  website: string;
  primaryColor: string;         // hex, dùng cho theme token
  timezone: string;             // "Asia/Ho_Chi_Minh"
  createdAt: Timestamp;
}
```

### 3.2. `offices/{officeId}`
```ts
{
  id: string;
  companyId: string;
  name: string;                 // "Hà Nội", "Đà Nẵng", "HCM"
  address: string;
  gps: { lat: number; lng: number };
  radiusMeters: number;
  workingHours: { start: string; end: string };  // default cho office, có thể override bởi workSchedule
  status: "active" | "inactive";
}
```
> `settings/office` (v1) được **xóa**, thay bằng collection `offices`. `employees.officeId` bắt buộc từ v2.

### 3.3. `employees` — bổ sung field
```ts
{
  // ... giữ nguyên field v1
  companyId: string;
  officeId: string;
  workScheduleId: string;
  dob: Timestamp;               // MỚI — phục vụ Birthday widget
}
```

### 3.4. `workSchedules/{scheduleId}`
```ts
{
  id: string;
  companyId: string;
  name: string;                 // "Schedule A", "Schedule Intern"
  checkInTime: string;          // "09:00"
  checkOutTime: string;         // "18:00"
  lateRuleOverride?: { slightLateUntil: string; lateUntil: string };  // nếu khác mặc định
}
```

### 3.5. `holidays/{holidayId}`
```ts
{
  id: string;
  companyId: string;
  date: string;                 // "2026-09-02"
  name: string;                 // "Quốc khánh"
  isWorkingDay: boolean;        // false = nghỉ; true = ngày lễ nhưng vẫn làm (hiếm)
}
```
Cloud Function `onCheckIn`/tính công **phải đọc `holidays`** trước khi áp `lateStatus` — nếu hôm đó `isWorkingDay=false` thì không tính "vắng mặt", tự set `workStatus = "holiday"`.

### 3.6. `attendance` — bổ sung workflow state machine
```ts
{
  // ... giữ nguyên field v1
  workflowStatus: "draft" | "submitted" | "need_explanation" | "approved" | "rejected" | "locked";
  // Thay thế cách dùng isLocked đơn thuần: isLocked = (workflowStatus === "locked")
}
```
**State machine:**
```
draft → submitted (tự động khi checkOut xong)
submitted → need_explanation (nếu lateStatus != on_time và chưa có explanation)
submitted / need_explanation → approved (PGĐ duyệt, hoặc tự approved nếu on_time + không có flag)
approved/rejected → locked (khi chốt công tháng)
```

### 3.7. `projectStats/{projectId}_{yyyy-mm}`  (MỚI — Project Dashboard, mục 18)
```ts
{
  id: string;
  projectId: string;
  month: string;
  totalHours: number;
  otHours: number;
  employeeBreakdown: {
    employeeId: string;
    hours: number;
    otHours: number;
    workTypes: Record<string, number>;  // { render: 6, meeting: 2 }
  }[];
  updatedAt: Timestamp;
}
```
Được Cloud Function `aggregateProjectStats` tính lại (trigger `onWrite dailyReports`), **không tính realtime ở client** để tránh sai lệch khi nhiều người ghi cùng lúc.

### 3.8. `notifications/{notificationId}` (bổ sung phân loại — mục 6)
```ts
{
  id: string;
  type: "announcement" | "system" | "attendance" | "leave" | "project";
  title: string;
  body: string;
  recipientId?: string;         // null = broadcast toàn công ty
  isRead: boolean;
  createdAt: Timestamp;
}
```

### 3.9. `activityFeedEvents/{eventId}` (MỚI — mục 7)
```ts
{
  id: string;
  type: "check_in" | "check_out" | "late" | "leave_request" | "explanation_submitted";
  employeeId: string;
  employeeName: string;
  timestamp: Timestamp;
  meta: Record<string, any>;
}
```
Ghi bởi Cloud Function ngay khi `onCheckIn`/`onCheckOut` xảy ra — Dashboard chỉ subscribe realtime collection này (giới hạn `limit(20)`), không phải quét toàn bộ `attendance`.

### 3.10. `settings/theme` (MỚI — mục 16, không hard-code màu)
```ts
{
  primary: string; secondary: string; neutral: string;
  success: string; warning: string; danger: string;
  fontHeading: string; fontBody: string;
}
```
Load 1 lần khi app khởi động, set vào CSS variables (`--color-primary` v.v.) — đổi theme không cần deploy lại.

### Index bổ sung
- `offices`: `companyId`
- `employees`: `officeId + status`, `dob` (cho Birthday widget — query theo tháng/ngày cần xử lý ở client vì Firestore không query theo phần ngày của Timestamp; giải pháp: lưu thêm field string `dobMonthDay: "07-24"` để index được).
- `activityFeedEvents`: `timestamp desc`
- `projectStats`: `projectId + month`

---

## 4. APPROVAL WORKFLOW — CHI TIẾT (mục 5)

```
┌───────┐   checkOut xong    ┌────────────┐
│ draft │ ─────────────────▶ │ submitted  │
└───────┘                    └─────┬──────┘
                                    │ có lateStatus != on_time
                                    ▼
                          ┌──────────────────┐
                          │ need_explanation  │
                          └─────────┬─────────┘
                                    │ nhân viên nộp giải trình
                                    ▼
                    PGĐ review ──▶ approved / rejected
                                    │
                          Chốt công tháng (tất cả employeeId trong kỳ)
                                    ▼
                                 locked
```
Thiết kế dạng state machine (không chỉ boolean `isLocked`) giúp sau này thêm state mới (vd: `pending_leader_review`) mà không phá vỡ luồng cũ — đúng tinh thần "portal mở rộng dễ".

---

## 5. DASHBOARD THEO ROLE (mục 9)

### 5.1. Dashboard Employee (giữ như v1)
StatCard cá nhân + lịch sử 7 ngày + Activity Feed chỉ hiển thị nhóm/phòng ban của mình.

### 5.2. Dashboard PGĐ/Admin — **drill-down**
Mỗi StatCard là **clickable**, không chỉ là số tĩnh:

```
[ Đi muộn: 2 ]  → click → mở Drawer/trang lọc sẵn:
                    Attendance list WHERE date=today AND lateStatus != on_time
                    → hiển thị tên, giờ, GPS, workflowStatus, nút "Yêu cầu giải trình"

[ Đang OT: 14 người ] → click → list nhân sự đang OT hôm nay, project đang làm, số giờ OT dự kiến
```
Kỹ thuật: mỗi StatCard nhận `filterQuery` (Firestore query params) làm prop → route sang `AttendanceListPage?filter=...` dùng chung component list đã có ở Timesheet, tránh viết trùng UI.

Thêm 2 widget riêng cho PGĐ:
- **Birthday hôm nay** (mục 12): query `employees WHERE dobMonthDay == today`.
- **Work Anniversary** (mục 13): tính `now.year - joinDate.year`, hiển thị ai tròn năm hôm nay/tuần này.

### 5.3. Project Dashboard (mục 18 — quan trọng nhất)
Trang riêng trong module `projects`:
- Chọn dự án → hiển thị: tổng giờ công, tổng OT, số nhân sự tham gia, biểu đồ phân bổ theo loại công việc (Revit/CAD/Render/Meeting...) theo tháng.
- Drill-down: click 1 nhân sự trong dự án → xem chi tiết ngày nào làm gì (từ `dailyReports.projectLinks`).
- Đây là lý do bắt buộc phải có `projectStats` aggregated collection — không thể tính realtime từ hàng nghìn `dailyReports` mỗi lần mở trang.

---

## 6. CALENDAR VIEW (mục 10–11)

Bổ sung cạnh Timesheet (không thay thế):
- Lưới tháng kiểu Google Calendar, mỗi ô ngày hiển thị ký hiệu công (chấm màu + text nhỏ: `x`, `WFH`, `P`...).
- Ngày lễ (`holidays`) tô nền màu riêng (vd tím nhạt) + tooltip tên ngày lễ, không cho Check In/Out (hoặc cho phép nhưng gắn `workStatus = holiday`, không tính đi muộn).
- Employee xem lịch của mình; Leader/PGĐ chọn nhân sự để xem lịch người khác.

---

## 7. SEARCH TOÀN HỆ THỐNG (mục 8)

- Phím tắt `Ctrl/⌘ + K` mở Command Palette (kiểu Linear/Notion) — dùng `cmdk` (thư viện React nhẹ, tương thích shadcn).
- Phase 1: search điều hướng (trang, nhân sự, dự án) bằng Firestore query prefix trên field đã lowercase (`nameLower`, `codeLower`).
- Phase 2+: nếu dữ liệu lớn, cân nhắc Firebase Extension **"Search with Algolia"** để search full-text mượt hơn (không bắt buộc ngay).

---

## 8. CÁC BỔ SUNG KỸ THUẬT KHÁC

### 8.1. Backup (mục 14)
Cloud Scheduler (chạy 1h sáng hàng ngày) → gọi Cloud Function `scheduledFirestoreBackup` → export toàn bộ Firestore ra Google Cloud Storage bucket → đồng bộ file mới nhất sang Google Drive công ty qua Drive API → **giữ tối đa 7 bản gần nhất**, tự xóa bản cũ hơn.

### 8.2. Import Excel (mục 15)
Song song với đồng bộ Google Sheet: trang HR có thêm nút "Import Excel" — client parse bằng `exceljs`/`SheetJS`, validate cấu trúc (đúng cột), gửi payload lên Cloud Function `importEmployeesFromExcel` (dùng lại chung logic diff/merge với `syncEmployeesFromSheet`), ghi audit log `IMPORT_EMPLOYEES_EXCEL`.

### 8.3. Design Token & Theme (mục 16)
Toàn bộ màu/spacing/typography khai báo dạng CSS variable trong `tailwind.config.ts` (`theme.extend.colors` trỏ về `var(--color-primary)` ...), giá trị thật load từ `settings/theme` lúc khởi động app — đổi bộ nhận diện không cần sửa code, chỉ sửa Firestore.

### 8.4. Motion (mục 17)
Dùng `framer-motion`, giới hạn phạm vi: fade/slide nhẹ khi chuyển trang, stagger nhẹ khi StatCard load, không dùng hiệu ứng nặng làm chậm cảm giác "công cụ làm việc nghiêm túc" (tránh phong cách app tiêu dùng).

---

## 9. BỘ TÀI LIỆU KỸ THUẬT ĐI KÈM (mục 20)

Toàn bộ tài liệu dưới đây được viết **song song với v2 này**, nằm trong thư mục `docs/`:

| File | Nội dung |
|---|---|
| `00-architecture.md` | Tài liệu này |
| `01-adr.md` | Architecture Decision Records — vì sao chọn từng công nghệ |
| `02-database-schema.md` | Schema Firestore đầy đủ, quan hệ, index |
| `03-firestore-security-rules.md` | Rules thật + giải thích từng rule |
| `04-api-cloud-functions.md` | Danh sách Cloud Functions, input/output, lỗi |
| `05-design-system.md` | Màu, typography, spacing, icon, component guideline |
| `06-coding-convention.md` | Naming, cấu trúc thư mục, commit convention |
| `07-deployment-guide.md` | Deploy Firebase + Vercel, biến môi trường |
| `08-backup-restore-guide.md` | Quy trình backup/restore |
| `09-user-manual.md` | Hướng dẫn dùng cho Employee/Leader/PGĐ/Admin |
| `10-admin-manual.md` | Đồng bộ nhân sự, chốt công, xuất bảng lương |
| `11-roadmap.md` | Roadmap Phase 1 → 3 → module tương lai |

---

## 10. ROADMAP — CẬP NHẬT NGẮN GỌN (chi tiết đầy đủ ở `11-roadmap.md`)

- **Phase 1**: thêm `companies`/`offices`/`workSchedules`/`holidays` vào nền tảng ngay từ đầu (vì đổi sau sẽ phải migrate `employees`); Dashboard PGĐ drill-down cơ bản; Calendar View; Search cơ bản; Theme token.
- **Phase 2**: Project Dashboard đầy đủ (mục 18), Notification Center phân loại, Activity Feed, Import Excel.
- **Phase 3**: Backup tự động, Birthday/Anniversary widget, Motion polish toàn hệ thống, Leave/KPI như v1.

---

**Kiến trúc v2 này thay thế v1.** Sau khi bạn xác nhận, các file tài liệu còn lại (`01`–`11`) sẽ được hoàn thiện và Phase 1 sẽ triển khai đúng theo schema mở rộng ở trên (đặc biệt: `companies`/`offices`/`workSchedules`/`holidays` phải có từ ngày đầu để tránh migrate dữ liệu về sau).
