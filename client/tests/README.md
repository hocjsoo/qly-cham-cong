# Kiểm tra tải trang và điều hướng

Chạy tại thư mục `client` sau `npm ci`:

```sh
npm run test:prefetch
npx playwright install chromium
npm run test:ui
```

Nếu Windows đã cài Microsoft Edge, có thể dùng trình duyệt đó:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:ui
```

`test:prefetch` thực thi scheduler thật với đồng hồ và loader có kiểm soát: ngân sách hai trang, vai trò cũ/mới, miễn chấm công, tiết kiệm dữ liệu, offline/tab ẩn, hủy lịch, lỗi/thử lại và gộp lượt import.

`test:ui` tự mở Vite ở `127.0.0.1:4177`, dùng trình duyệt riêng và tài khoản giả. Tất cả `/api/*` đều bị chặn để trả dữ liệu giả; request ngoài địa chỉ local bị hủy. Không khởi động backend hoặc kết nối MongoDB. Mỗi test có bộ nhớ trình duyệt riêng. Cổng đang được dùng sẽ báo lỗi, không dùng lại máy chủ lạ.

Các kiểm tra trình duyệt hiện có:

- Menu 320 px: bốn mục chính và một nút tiện ích; kiểm tra admin, leader, manager, employee, staff và nhân viên miễn chấm công.
- Sheet tiện ích: giữ focus, Escape, trả focus, nền không tương tác, dark theme và chuyển lên desktop.
- Trang mới tải chậm: thanh điều hướng tiếp tục hiện và dùng được.
- Lịch sử: đổi tháng khi request cũ chưa xong phải hủy request cũ và giữ đúng dữ liệu tháng mới.
- Chi tiêu: hủy tìm kiếm cũ ngay khi nhập truy vấn mới, kể cả trong thời gian debounce; không hiện toast lỗi do hủy.
- Lịch tuần: bảng còn xem được sau khi lưu, các nút sửa bị khóa tới khi nhận dữ liệu mới để tránh ghi đè bằng lịch cũ.

Ảnh lỗi và trace nằm trong `test-results/`, được bỏ qua bởi Git. Bộ kiểm thử chạy mã React thật với API giả; không thay thế kiểm tra API/DB hay phép đo hiệu năng production. CI chạy cả hai lệnh cùng lint/build hiện có.

Mốc xác nhận 06/09/2026: 12/12 kiểm tra scheduler, 11/11 kiểm tra trình duyệt Microsoft Edge, frontend lint/build đạt. Giới hạn tự tải trước thay đổi từ bảy trang xuống tối đa hai trang; đây là giảm số trang tải nền, không phải cam kết phần trăm tăng tốc toàn hệ thống.
