# Admin Manual
## ET Office Portal

---

## 1. Đồng bộ nhân sự từ Google Sheet

1. Vào trang **HR → Nhân sự**.
2. Bấm nút **"Đồng bộ nhân sự"** (góc trên phải).
3. Hệ thống đọc Google Sheet nguồn (đã cấu hình sẵn), so sánh với dữ liệu hiện có, và tự động:
   - **Thêm mới**: nhân sự có trong Sheet nhưng chưa có trong hệ thống.
   - **Cập nhật**: email, chức vụ, phòng ban, loại nhân sự thay đổi.
   - **Khóa** (`status = inactive`): nhân sự có trong hệ thống nhưng đã bị xóa khỏi Sheet (coi như nghỉ việc) — **không xóa dữ liệu chấm công cũ**, chỉ khóa tài khoản đăng nhập.
4. Sau khi chạy xong, hệ thống hiển thị tóm tắt: "X thêm mới, Y cập nhật, Z khóa" + danh sách lỗi nếu có dòng dữ liệu không hợp lệ (thiếu email, sai định dạng...).
5. **Nên đồng bộ định kỳ** (khuyến nghị đầu mỗi tháng, hoặc ngay khi có nhân sự mới/nghỉ việc) — hệ thống không tự động đọc Sheet liên tục để tránh phụ thuộc Google Sheet làm database chính.

## 2. Import nhân sự từ file Excel (khi không dùng Google Sheet)

1. Vào **HR → Nhân sự → Import Excel**.
2. Tải file mẫu (template) nếu chưa có, đảm bảo đúng cột: `email, fullName, employeeCode, position, department, employeeType, officeId, workScheduleId, joinDate, dob`.
3. Upload file → hệ thống validate trước khi ghi, báo lỗi dòng nào sai định dạng (nếu có) để sửa trước khi import thật.
4. Logic thêm mới/cập nhật/khóa giống hệt đồng bộ Google Sheet.

## 3. Quản lý Công ty & Văn phòng

- Vào **Cài đặt → Công ty**: sửa tên, logo, màu thương hiệu (`primaryColor` — ảnh hưởng toàn bộ theme UI ngay lập tức, không cần deploy lại).
- Vào **Cài đặt → Văn phòng**: thêm chi nhánh mới (vd mở thêm văn phòng Đà Nẵng) — nhập địa chỉ, tọa độ GPS (lat/lng), bán kính cho phép chấm công (mặc định 200m), giờ làm việc mặc định.
- Khi thêm nhân sự mới (qua Sync/Import), phải gán đúng `officeId` để GPS chấm công được tính đúng theo văn phòng của người đó.

## 4. Quản lý Ca làm việc (Work Schedules)

- Vào **Cài đặt → Ca làm việc**: tạo các ca khác nhau (vd "Ca chuẩn 9h-18h", "Ca Intern 8h30-17h30").
- Gán ca cho từng nhân sự khi thêm/sửa hồ sơ — hệ thống sẽ tính "đi muộn" theo đúng giờ vào của ca được gán, không áp cứng 09:00 cho tất cả.

## 5. Quản lý Lịch nghỉ lễ (Holidays)

- Vào **Cài đặt → Lịch nghỉ lễ**: thêm ngày nghỉ lễ trong năm (vd 02/09 - Quốc khánh).
- Những ngày này, hệ thống **không tính đi muộn/vắng mặt** cho nhân sự, tự động hiển thị `workStatus = "holiday"`.
- **Cần cập nhật đầu mỗi năm** (lịch nghỉ lễ Việt Nam thay đổi theo Âm lịch mỗi năm) — nên đặt nhắc việc thủ công vào cuối tháng 12 hàng năm.

## 6. Quản lý Dự án

- Vào **Dự án → Danh sách**: thêm/sửa/lưu trữ (archive) dự án. Dự án archive vẫn giữ dữ liệu lịch sử, chỉ ẩn khỏi danh sách chọn khi nhân viên Check In/Daily Report mới.

## 7. Cấu hình quy tắc chấm công (không hard-code)

Vào **Cài đặt → Quy tắc chấm công**, chỉnh được (áp dụng ngay, không cần deploy code):
- Ngưỡng đi muộn (hiện tại: ≤09:00 đúng giờ, 09:01–09:10 muộn nhẹ, 09:11–09:30 muộn, >09:30 muộn nhiều).
- Giờ bắt đầu tính OT (hiện tại: từ 18:00).
- Ký hiệu bảng công (`x`, `0.75x`, `0.5x`, `WFH`, `P`, `O`, `KL`, `CT1`, `CT2`, `K`).
- Theme màu sắc/font.

## 8. Quy trình cuối tháng (phối hợp với PGĐ)

1. Admin đảm bảo dữ liệu nhân sự đã đồng bộ mới nhất trước ngày chốt công.
2. PGĐ duyệt hết giải trình còn tồn đọng.
3. PGĐ bấm "Chốt công tháng".
4. Admin hỗ trợ xuất file nếu PGĐ cần định dạng đặc biệt cho kế toán.
5. Sau khi chốt, nếu phát sinh sai sót cần sửa: chỉ Admin/PGĐ thực hiện "Mở khóa để sửa" kèm lý do — **tuyệt đối không sửa trực tiếp trên Firestore Console** vì sẽ không đi qua luồng tính toán lại (lateStatus, otMinutes) và không được ghi Audit Log.

## 9. Giám sát Audit Log

- Vào **Audit Log** (chỉ xem, không sửa/xóa được — kể cả Admin) để tra cứu: ai đăng nhập, ai chấm công, ai duyệt giải trình, ai chốt công, ai mở khóa dữ liệu.
- Dùng khi có tranh chấp/khiếu nại về công, hoặc kiểm tra bất thường (đăng nhập thiết bị lạ, GPS bất thường được flag).

## 10. Backup & Sự cố

- Backup chạy tự động hàng ngày (xem `08-backup-restore-guide.md`) — Admin không cần thao tác thủ công, nhưng nên kiểm tra định kỳ (hàng tháng) rằng job backup vẫn chạy thành công qua Cloud Logging.
- Nếu nghi ngờ mất/sai dữ liệu: **không tự sửa** — liên hệ đội kỹ thuật để thực hiện quy trình restore đúng chuẩn.

## 11. Quản lý quyền (Role)

- Đổi role 1 nhân sự (vd từ Employee lên Leader) thực hiện tại **HR → chọn nhân sự → Vai trò**.
- Lưu ý: người được đổi role cần **đăng xuất/đăng nhập lại** (hoặc đợi token tự refresh) để quyền mới có hiệu lực trên toàn hệ thống.
