# User Manual
## ET Office Portal

---

## A. Dành cho NHÂN VIÊN (Employee)

### 1. Đăng nhập
- Truy cập địa chỉ Portal → bấm **"Đăng nhập bằng Google"** → chọn đúng tài khoản Gmail công ty đã đăng ký.
- Nếu báo "Email chưa có trong hệ thống": liên hệ Admin để được thêm vào danh sách nhân sự.

### 2. Chấm công
- Vào trang **Chấm công**, bấm **CHECK IN** khi bắt đầu làm việc.
- Hệ thống tự kiểm tra vị trí GPS — nếu bạn đang ở ngoài văn phòng, hệ thống **vẫn cho chấm công** nhưng sẽ hiển thị cảnh báo màu cam (dùng để giải trình sau nếu cần).
- Sau khi Check In, sẽ có popup hỏi **"Hôm nay bạn làm dự án nào?"** — chọn dự án tương ứng.
- Cuối ngày, bấm **CHECK OUT**, sau đó điền **Daily Report**: chọn loại công việc đã làm (Revit, CAD, Render, Meeting...) và ghi chú ngắn nếu cần.

### 3. Giải trình
- Nếu đi muộn/về sớm/có OT, vào trang **Giải trình**, ghi lý do (vd: "Tắc đường", "Render dự án Hương Khê").
- Bạn có **72 giờ** kể từ thời điểm chấm công để sửa lý do; sau đó hệ thống tự khóa, cần liên hệ Admin/PGĐ nếu cần sửa thêm.

### 4. Xem lịch sử chấm công
- **Bảng chấm công (Timesheet)**: xem dạng bảng như Excel, mỗi ô là 1 ngày, ký hiệu công theo chuẩn công ty (`x`, `0.75x`, `WFH`, `P`, `O`, `KL`, `CT1`, `CT2`, `K`). Bấm vào 1 ô để xem chi tiết giờ vào/ra, GPS, lý do.
- **Calendar View**: xem dạng lịch tháng trực quan hơn, ngày lễ được tô màu riêng.

### 5. Dashboard cá nhân
- Xem nhanh: công tháng này, số lần đi muộn, giờ OT, WFH, nghỉ phép.
- Xem **Activity Feed** của nhóm/phòng ban (ai vừa Check In, ai đi muộn hôm nay).

### 6. Tìm kiếm nhanh
- Bấm `Ctrl + K` (Windows) hoặc `⌘ + K` (Mac) để mở ô tìm kiếm nhanh, gõ tên trang/dự án/đồng nghiệp cần tìm.

---

## B. Dành cho LEADER (Trưởng nhóm)

Ngoài toàn bộ quyền của Employee:
- Xem được danh sách chấm công của **thành viên trong nhóm mình quản lý** (không xem được nhóm khác).
- Theo dõi giải trình của thành viên (chỉ xem, **không có quyền duyệt/từ chối** — quyền này thuộc PGĐ).
- Xem Project Dashboard cho dự án nhóm mình tham gia (giờ công, phân bổ công việc).

---

## C. Dành cho PGĐ (Nguyễn Danh Trường)

Ngoài toàn bộ quyền trên:

### 1. Dashboard riêng — có thể click vào số liệu để xem chi tiết
- Ví dụ bấm vào thẻ **"Đi muộn: 2"** → mở ngay danh sách 2 người đó, kèm giờ vào, GPS, nút "Yêu cầu giải trình".
- Bấm vào thẻ **"Đang OT: 14 người"** → xem danh sách, đang làm dự án gì.
- Xem widget **Sinh nhật hôm nay** và **Kỷ niệm ngày vào làm** ngay trên Dashboard.

### 2. Duyệt giải trình
- Vào trang **Giải trình**, xem toàn bộ giải trình toàn công ty, bấm **Duyệt** hoặc **Từ chối** từng mục.

### 3. Chốt công tháng
- Cuối tháng, vào **Bảng chấm công** → rà soát → bấm **"Chốt công tháng"**.
- Hệ thống sẽ chặn nếu còn giải trình chưa duyệt — cần xử lý hết trước khi chốt.
- Sau khi chốt: dữ liệu tháng đó bị khóa, nhân viên không sửa được nữa.

### 4. Xuất bảng lương
- Sau khi chốt công, bấm **Export Excel/PDF** để lấy bảng chấm công tổng hợp phục vụ tính lương.

### 5. Xem toàn bộ GPS / OT / lịch sử
- Có quyền xem chi tiết vị trí chấm công, giờ OT, lịch sử của **mọi nhân sự**, phục vụ đối chiếu khi cần.

### 6. Sửa dữ liệu đã khóa (trường hợp đặc biệt)
- Vào bản ghi đã khóa → chọn **"Mở khóa để sửa"** → **bắt buộc nhập lý do** → hệ thống ghi lại toàn bộ hành động này vào Audit Log (không thể xóa), đảm bảo minh bạch.

---

## D. Dành cho ADMIN

Xem chi tiết đầy đủ tại `10-admin-manual.md`. Tóm tắt nhanh:
- Đồng bộ/Import danh sách nhân sự.
- Quản lý công ty/văn phòng/ca làm việc/lịch nghỉ lễ.
- Quản lý dự án.
- Cấu hình theme, ký hiệu bảng công, quy tắc đi muộn/OT (không cần sửa code).

---

## E. Câu hỏi thường gặp (FAQ)

**Q: Vì sao hệ thống báo tôi ở ngoài văn phòng dù tôi đang ở công ty?**
A: GPS trình duyệt có sai số 20–50m, đặc biệt trong nhà/tòa nhà cao tầng. Hệ thống không chặn chấm công vì lý do này, chỉ cảnh báo — bạn vẫn chấm công bình thường.

**Q: Tôi quên Check Out thì sao?**
A: Liên hệ Admin/PGĐ để được hỗ trợ bổ sung thủ công (có ghi Audit Log).

**Q: Sao tôi không sửa được lý do giải trình nữa?**
A: Đã quá 72 giờ kể từ lúc chấm công — đây là quy định để đảm bảo dữ liệu ổn định trước khi chốt công. Liên hệ PGĐ nếu thực sự cần sửa.
