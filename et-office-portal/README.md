# ET Office Portal — Phase 1

Module đầu tiên của ET Office Portal: **Authentication + Attendance + Dashboard**, đúng theo `docs/00-architecture.md` (v2) và `docs/11-roadmap.md`.

## Đã triển khai trong Phase 1 này

- **Auth**: đăng nhập Google, đối chiếu `employees` qua Cloud Function blocking (`onUserSignIn`), custom claims theo role, `AccessDeniedPage`.
- **Attendance**: Check In/Out qua Cloud Function (`onCheckIn`/`onCheckOut`) — tính GPS distance, `lateStatus` theo `workSchedules`/`holidays`, `otMinutes`, flags chống gian lận, ghi `activityFeedEvents` + `auditLogs`.
- **Explanation**: giải trình đi muộn/về sớm/OT (72h), duyệt bởi PGĐ (`reviewExplanation`).
- **Timesheet**: bảng chấm công dạng grid theo tháng.
- **Dashboard**: StatCard cơ bản (count query) + Activity Feed realtime.
- **Chốt công**: `closeMonthlyAttendance`, `unlockAttendanceRecord` (mở khóa có audit log).
- **HR**: `syncEmployeesFromSheet` — đồng bộ 1 chiều từ Google Sheet.
- **Nền tảng**: Firestore Rules đầy đủ + indexes, design tokens (`settings/theme`), cấu trúc `modules/` sẵn sàng mở rộng Phase 2 (Projects, Reports...).

## Giới hạn của bản scaffold này

Môi trường tạo file này **không có kết nối mạng**, nên:
- Chưa chạy được `npm install` / `npm run dev` / `firebase deploy` tại đây — bạn cần tải code về máy (hoặc repo Git) rồi chạy các lệnh này ở môi trường có mạng.
- Chưa kết nối Firebase project thật — cần tạo project theo `docs/07-deployment-guide.md` và điền `.env` theo `.env.example`.
- Một số phần đơn giản hoá có ghi chú `// Phase 2` ngay trong code (vd OT/WFH/leave count ở Dashboard, `employeeId` truyền vào form giải trình) — sẽ hoàn thiện khi làm Projects/Leave ở Phase 2-3.
- Chưa có test tự động (unit test cho `lateRules`/`otCalculator`, Firestore Rules emulator test) — nên bổ sung trước khi đưa vào production thật, theo `docs/06-coding-convention.md` mục 8.

## Cách chạy thử (khi đã có máy có mạng + Firebase project)

```bash
# 1. Cài dependency frontend
npm install

# 2. Tạo file .env từ mẫu, điền config Firebase project
cp .env.example .env

# 3. Chạy dev server
npm run dev

# 4. Cài dependency & deploy Cloud Functions
cd functions
npm install
npm run build
firebase deploy --only functions

# 5. Deploy Firestore Rules + Indexes
firebase deploy --only firestore:rules,firestore:indexes
```

Xem đầy đủ quy trình tại `docs/07-deployment-guide.md`.

## Việc cần làm trước khi cho nhân viên dùng thật

1. Seed `companies`, `offices` (ET Architects, 07 Nguyễn Thị Định, tọa độ 21.012688/105.803683, bán kính 200m), `workSchedules` mặc định, `holidays` năm hiện tại.
2. Tạo `settings/otRule`, `settings/theme`, `settings/hrSync` (chứa `sheetId` Google Sheet nhân sự).
3. Set custom claim `role: "admin"` cho tài khoản Admin đầu tiên bằng tay (qua Firebase Admin SDK script), vì `onUserSignIn` cần đã có `employees` doc với role đúng để gán claims — tài khoản Admin đầu tiên cần được tạo thủ công trước khi có UI quản trị.
4. Chạy `syncEmployeesFromSheet` lần đầu.
5. Test Check In/Out thật trên điện thoại (GPS thật).

## Cấu trúc thư mục

Xem chi tiết tại `docs/00-architecture.md` mục 2. Tóm tắt:
```
src/app/          — App shell, providers, routes
src/shared/       — dùng chung: types, constants, lib, ui, layout, hooks
src/modules/      — auth, attendance, explanation, dashboard (Phase 1)
functions/src/    — Cloud Functions: attendance, hr, audit
docs/             — toàn bộ tài liệu kỹ thuật (00 → 11)
```
