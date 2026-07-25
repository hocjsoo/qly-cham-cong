# Backup & Restore Guide
## ET Office Portal

---

## 1. Chiến lược Backup

| Thành phần | Tần suất | Nơi lưu | Retention |
|---|---|---|---|
| Firestore (toàn bộ database) | Hàng ngày, 1:00 sáng (giờ VN) | GCS bucket → đồng bộ Google Drive thư mục công ty | 7 bản gần nhất |
| Firestore Rules + Indexes (source) | Mỗi lần thay đổi | Git repository | Vĩnh viễn (git history) |
| Cloud Functions source | Mỗi commit | Git repository | Vĩnh viễn |
| Storage (ảnh selfie, file export) | Theo cơ chế versioning của GCS bucket (bật `Object Versioning`) | Cùng bucket Storage | 30 ngày (khuyến nghị, cấu hình lifecycle rule riêng) |

Thực hiện bởi Cloud Function `scheduledFirestoreBackup` (xem `04-api-cloud-functions.md` mục 6), kích hoạt bởi Cloud Scheduler.

## 2. Cấu hình ban đầu (làm 1 lần)

1. Tạo GCS bucket riêng cho backup: `gs://et-office-portal-backups`.
2. Cấp quyền `datastore.viewer` + `storage.objectAdmin` cho Service Account backup.
3. Tạo thư mục Google Drive `ET Office Portal - Backups`, share quyền Editor cho Service Account (dùng email dạng `xxx@et-office-portal.iam.gserviceaccount.com`).
4. Deploy function + xác nhận Cloud Scheduler job đã tạo (`gcloud scheduler jobs list`).
5. Chạy thử thủ công 1 lần (`gcloud scheduler jobs run <job-name>`) để xác nhận luồng chạy đúng trước khi để tự động.

## 3. Quy trình Restore (khi cần khôi phục dữ liệu)

> **Lưu ý quan trọng**: restore Firestore từ bản export sẽ **ghi đè** dữ liệu hiện tại trong collection được restore. Chỉ thực hiện khi chắc chắn cần thiết, và nên restore vào project **staging** trước để kiểm tra, không restore thẳng vào production.

### Bước 1 — Xác định bản backup cần dùng
- Vào GCS bucket `et-office-portal-backups`, chọn thư mục theo ngày (`YYYY-MM-DD`).
- Hoặc lấy từ Google Drive nếu GCS đã bị dọn theo retention 7 ngày.

### Bước 2 — Restore vào project staging để kiểm tra
```bash
gcloud firestore import gs://et-office-portal-backups/2026-07-23 --project=et-office-portal-staging
```

### Bước 3 — Kiểm tra dữ liệu ở staging
- Mở Firebase Console (staging), kiểm tra vài document mẫu (attendance của vài ngày, employees).
- Đối chiếu với báo cáo/log gần thời điểm sự cố để xác nhận đây đúng là bản dữ liệu cần khôi phục.

### Bước 4 — Restore vào production (chỉ khi đã xác nhận bước 3)
```bash
gcloud firestore import gs://et-office-portal-backups/2026-07-23 --project=et-office-portal-prod
```
- Khuyến nghị: nếu chỉ cần khôi phục 1-2 collection cụ thể (vd chỉ `attendance` bị lỗi), dùng cờ `--collection-ids=attendance` để tránh ghi đè toàn bộ database không cần thiết.

### Bước 5 — Ghi nhận sự cố
- Tạo bản ghi thủ công trong `auditLogs` (qua Cloud Function riêng `manualAuditEntry`, chỉ admin) mô tả: lý do restore, ai thực hiện, thời điểm, phạm vi dữ liệu bị ảnh hưởng — vì bản thân hành động restore nằm ngoài luồng ứng dụng bình thường nên không tự động được ghi log.

## 4. Kiểm thử định kỳ

- Khuyến nghị **mỗi quý** thực hiện 1 lần restore thử vào project staging (dùng bản backup bất kỳ) để đảm bảo quy trình vẫn hoạt động đúng, không đợi đến khi có sự cố thật mới phát hiện lỗi quy trình backup.

## 5. Trường hợp mất cả Firebase Project

- Vì Rules/Functions source nằm trong Git, và data nằm trong GCS/Drive độc lập với Firebase project — có thể tạo project Firebase mới, deploy lại toàn bộ (`07-deployment-guide.md`), rồi import dữ liệu từ bản backup gần nhất vào project mới. Đây là lý do backup **không được lưu trong cùng Firebase project** duy nhất.
