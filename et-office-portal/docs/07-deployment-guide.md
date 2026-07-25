# Deployment Guide
## ET Office Portal — Firebase + Vercel

---

## 1. Chuẩn bị Firebase Project

1. Tạo Firebase Project (tên gợi ý: `et-office-portal`, hoặc `et-office-portal-prod` nếu tách môi trường).
2. Bật **Blaze plan** (bắt buộc cho Cloud Functions + gọi Google Sheets API ra ngoài — xem ADR-003).
3. Bật các dịch vụ: Authentication (Google provider), Firestore (chọn region gần VN, vd `asia-southeast1`), Storage, Cloud Functions.
4. Tạo Service Account riêng cho:
   - Đồng bộ Google Sheets (quyền `Sheets API` read-only, được share vào Sheet công ty).
   - Backup (quyền Firestore Export + Google Drive API write vào thư mục backup).

## 2. Môi trường (dev / staging / production)

Khuyến nghị 2 Firebase project tối thiểu:
- `et-office-portal-staging`: dùng để test trước khi chốt công thật.
- `et-office-portal-prod`: dữ liệu chấm công thật, giới hạn quyền truy cập chặt.

Biến môi trường (`.env.staging`, `.env.production`) cho frontend:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```
**Không commit file `.env*` thật vào git** — chỉ commit `.env.example`.

## 3. Deploy Firestore Rules & Indexes

```bash
firebase use production   # hoặc staging
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```
Luôn deploy **rules trước**, đảm bảo test emulator pass (xem `03-firestore-security-rules.md` mục 3).

## 4. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```
- Function `scheduledFirestoreBackup` cần cấu hình Cloud Scheduler tự động khi deploy lần đầu (Firebase tự tạo job Scheduler tương ứng `onSchedule`).
- Kiểm tra biến môi trường function (Google Sheet ID, Drive folder ID) qua `firebase functions:config:set` hoặc `.env` (2nd gen functions hỗ trợ `.env` trong thư mục `functions/`).

## 5. Deploy Frontend lên Vercel

1. Import repo vào Vercel, chọn thư mục root `apps/web`.
2. Build command: `npm run build` (Vite mặc định `vite build`).
3. Output directory: `dist`.
4. Khai báo Environment Variables trong Vercel Dashboard tương ứng `.env.production` (mục 2), riêng theo từng Vercel Environment (Production/Preview).
5. Preview deploy tự động theo mỗi PR — dùng để review UI trước khi merge `main`.
6. Domain: gắn subdomain nội bộ, vd `portal.kientrucet.com` (cấu hình DNS CNAME trỏ về Vercel).

## 6. Thứ tự deploy khuyến nghị khi release có thay đổi schema/rules

```
1. Deploy Firestore Rules + Indexes (staging) → test emulator + smoke test thủ công
2. Deploy Cloud Functions (staging) → test callable qua Firebase Console
3. Deploy Frontend lên Vercel Preview → test UI end-to-end
4. Nếu OK toàn bộ staging → lặp lại đúng thứ tự trên cho production
5. Rules & Functions LUÔN deploy trước Frontend (tránh frontend mới gọi field/API chưa tồn tại ở backend)
```

## 7. Rollback

- Frontend: Vercel giữ lịch sử deploy, rollback 1-click về bản trước.
- Cloud Functions: `firebase functions:log` để xem lỗi; rollback bằng cách deploy lại commit trước (Cloud Functions không có rollback 1-click, phải re-deploy).
- Firestore Rules: giữ file rules cũ trong git history, deploy lại bằng `firebase deploy --only firestore:rules` từ commit trước nếu rules mới gây lỗi truy cập.
- **Dữ liệu**: nếu lỗi do Cloud Function ghi sai dữ liệu, dùng bản backup gần nhất (`08-backup-restore-guide.md`) để restore, không tự sửa tay từng document.

## 8. Checklist trước khi release Production lần đầu

- [ ] Đã seed `companies`/`offices`/`workSchedules`/`holidays` (năm hiện tại) trước khi mở cho nhân sự dùng.
- [ ] Đã chạy `syncEmployeesFromSheet` lần đầu, kiểm tra thủ công danh sách nhân sự đúng.
- [ ] Đã test Check In/Out thật trên điện thoại (GPS thật, không phải giả lập).
- [ ] Đã bật Cloud Scheduler backup, kiểm tra chạy thử 1 lần thành công.
- [ ] Đã set custom claims đúng cho PGĐ (Nguyễn Danh Trường) và Admin.
- [ ] Đã thông báo toàn công ty thời điểm chuyển sang hệ thống mới (tránh chấm công 2 nơi song song gây nhầm lẫn).
