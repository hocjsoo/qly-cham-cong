# ET OFFICE PORTAL — Product & UI Specification

> Phiên bản: 1.0  
> Ngôn ngữ sản phẩm: Tiếng Việt  
> Nền tảng: Responsive Web App / PWA  
> Quy mô mục tiêu: Doanh nghiệp 30–50 nhân viên  
> Định hướng giao diện: Liquid Glass có kiểm soát, mobile-first, hỗ trợ sáng/tối

## 1. Tổng quan sản phẩm

ET OFFICE PORTAL là cổng quản lý văn phòng và chấm công thông minh dành cho doanh nghiệp vừa và nhỏ. Sản phẩm hợp nhất chấm công GPS, xác thực selfie, chống gian lận thiết bị, đơn từ, ngày phép, dự án, báo cáo, phương tiện, chi tiêu và thông báo trong một trải nghiệm thống nhất.

Sản phẩm phải giúp nhân viên hoàn thành tác vụ hằng ngày trong ít thao tác, đồng thời cung cấp cho quản lý đủ dữ liệu để ra quyết định mà không làm lộ thông tin ngoài phạm vi quyền hạn.

### 1.1 Giá trị cốt lõi

- Chấm công nhanh, rõ ràng và đáng tin cậy.
- Giảm gian lận GPS, tab ẩn danh, đổi trình duyệt và dùng chung thiết bị.
- Duyệt đơn, cảnh báo và selfie theo đúng phạm vi quản lý.
- Báo cáo công minh bạch, dễ kiểm tra và xuất dữ liệu.
- Hoạt động tốt trên điện thoại, kể cả trong điều kiện mạng không ổn định.
- Giao diện hiện đại nhưng không đánh đổi khả năng đọc, hiệu năng hoặc khả năng truy cập.

### 1.2 Mục tiêu thành công

- Nhân viên hiểu ngay trạng thái chấm công hôm nay.
- Tác vụ check-in/check-out chính hoàn thành trong tối đa ba bước sau khi đã cấp quyền GPS/camera.
- Admin và Leader nhận biết ngay số người có mặt, đi muộn, vắng mặt và số việc chờ duyệt.
- Mọi hành động sửa, xóa, từ chối hoặc hoàn tác đều có ngữ cảnh và xác nhận phù hợp.
- Không có hành động nào vượt khỏi quyền của vai trò hiện tại.
- Giao diện dùng được từ màn hình điện thoại 360px đến desktop lớn.

## 2. Phạm vi và nguyên tắc bất biến

Thiết kế giao diện không được tự ý thay đổi:

- API, schema dữ liệu hoặc logic nghiệp vụ hiện tại.
- JWT, bcrypt, middleware xác thực và phân quyền.
- Mapping tương thích `manager` → `leader`, `staff` → `employee`.
- Quy trình GPS, selfie và chữ ký phần cứng `pure_hardware_uuid`.
- Quy tắc duyệt cảnh báo và tự động trust thiết bị sau khi duyệt.
- Quy tắc hoàn phép, trừ OT khi hoàn tác đơn.
- Quyền admin-only đối với sửa/xóa giờ công, chốt công, phương tiện và cài đặt.
- Quyền sửa dự án của PM theo `pm_id` hoặc `pm_name`.
- Offline fallback và hành vi PWA hiện có.

Mọi đề xuất thay đổi nghiệp vụ phải được tách riêng khỏi thay đổi giao diện và cần phê duyệt trước khi triển khai.

## 3. Người dùng và phân quyền

### 3.1 Admin

Admin có toàn quyền:

- Xem dashboard toàn công ty.
- Quản lý nhân sự và phòng ban.
- Xem, đặt máy chính hoặc xóa thiết bị nhân viên.
- Duyệt, từ chối, hoàn tác hoặc xóa ca cảnh báo.
- Sửa hoặc xóa bản ghi chấm công.
- Duyệt, từ chối, hoàn tác hoặc xóa đơn từ.
- Quản lý ngày phép, ngày lễ, vị trí GPS và ca làm việc.
- Tạo, sửa và xóa dự án.
- Sửa thông tin phương tiện.
- Xem báo cáo, xuất dữ liệu và chốt công.
- Gửi thông báo toàn hệ thống.

### 3.2 Leader

Leader quản lý phòng ban được giao:

- Xem dashboard đội nhóm.
- Xem thông tin nhân viên theo DTO và phạm vi được phép.
- Duyệt đơn của nhân viên thuộc phòng ban phụ trách.
- Duyệt ca cảnh báo và selfie trong phạm vi phụ trách.
- Quản lý ngày phép theo quyền hiện tại.
- Xuất dữ liệu được phép.
- Gửi thông báo theo phạm vi cho phép.
- Sửa dự án nếu chính họ là PM.

Leader không được:

- Sửa hoặc xóa giờ chấm công.
- Quản lý thiết bị chính chủ qua API admin-only.
- Sửa phương tiện.
- Tạo hoặc xóa dự án chung.
- Truy cập cài đặt hệ thống, chốt công hoặc báo cáo admin-only.

### 3.3 PM dự án

PM có thể mang vai trò Admin, Leader hoặc Employee. Quyền PM chỉ mở rộng trong dự án được giao:

- Sửa thông tin dự án.
- Cập nhật tiến độ và deadline.
- Quản lý nội dung được API dự án cho phép.

Quyền PM không tự động cấp quyền quản trị nhân sự hoặc chấm công.

### 3.4 Employee

Employee có quyền cá nhân:

- Check-in/check-out với GPS và selfie khi được yêu cầu.
- Xem trạng thái hôm nay và lịch sử của mình.
- Gửi và theo dõi đơn từ.
- Xem thông báo.
- Xem bảng xếp hạng chuyên cần.
- Xem dự án tham gia và sửa dự án nếu là PM.
- Xem/sửa hồ sơ, đổi mật khẩu và thông tin xe cá nhân theo API hiện có.

## 4. Kiến trúc điều hướng

### 4.1 Desktop

- Sidebar cố định bên trái.
- Logo và tên `ET OFFICE` ở đầu sidebar.
- Nhóm điều hướng chính ở giữa.
- Trợ giúp, thu gọn sidebar và thông tin tài khoản ở cuối.
- Header phía trên nội dung gồm tiêu đề trang, ngày hiện tại, thông báo và menu tài khoản.
- Mục đang hoạt động phải có nền nổi, màu nhấn và chỉ báo cạnh; không chỉ dựa vào màu chữ.

### 4.2 Mobile

- Bottom navigation chỉ chứa tối đa năm tác vụ thường dùng theo vai trò.
- Các mục còn lại nằm trong menu `Thêm` hoặc trang hồ sơ.
- Header mobile gọn, giữ tiêu đề, thông báo và hành động quan trọng nhất.
- Nút chấm công chính phải nằm trong vùng dễ chạm bằng ngón cái.
- Không dùng bảng desktop thu nhỏ; chuyển thành card, danh sách hoặc cho cuộn ngang có chỉ báo rõ ràng.

### 4.3 Điều hướng đề xuất theo vai trò

#### Admin

Tổng quan, Chấm công, Nhân sự, Đơn từ, Dự án, Báo cáo, Chi tiêu, Phương tiện, Cài đặt.

#### Leader

Tổng quan, Chấm công, Nhân sự đội nhóm, Đơn từ, Dự án, Xuất dữ liệu.

#### Employee

Chấm công, Lịch sử, Đơn từ, Bảng xếp hạng, Dự án, Hồ sơ.

## 5. Ngôn ngữ thiết kế Liquid Glass

### 5.1 Nguyên tắc

Liquid Glass được dùng để tạo chiều sâu và phân cấp, không phải làm mọi bề mặt trong suốt.

Dùng kính cho:

- Sidebar và header.
- Bottom navigation.
- Thẻ thống kê.
- Toolbar, bộ lọc và segmented control.
- Modal, drawer và panel phụ.
- Toast và notification panel.

Giữ bề mặt gần đặc cho:

- Bảng dữ liệu.
- Biểu mẫu dài.
- Lịch và timeline chi tiết.
- Bản đồ GPS.
- Ảnh selfie và vùng xác minh.
- Nội dung cảnh báo, báo cáo và dữ liệu tài chính.

### 5.2 Design tokens đề xuất

```css
:root {
  --color-primary: #0969f0;
  --color-primary-strong: #0754c9;
  --color-success: #079455;
  --color-warning: #f79009;
  --color-danger: #e5484d;
  --color-info: #3b82f6;

  --text-primary: #10204a;
  --text-secondary: #53658d;
  --text-muted: #7d8baa;

  --page-bg: #edf6ff;
  --surface-solid: rgba(255, 255, 255, 0.94);
  --glass-subtle: rgba(255, 255, 255, 0.72);
  --glass-medium: rgba(255, 255, 255, 0.56);
  --glass-border: rgba(255, 255, 255, 0.78);
  --glass-highlight: rgba(255, 255, 255, 0.92);

  --blur-sm: 10px;
  --blur-md: 18px;
  --blur-lg: 28px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 22px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --shadow-glass: 0 16px 48px rgba(28, 67, 135, 0.14);
  --shadow-float: 0 20px 60px rgba(17, 46, 102, 0.20);
}

[data-theme='dark'] {
  --text-primary: #eef4ff;
  --text-secondary: #b7c4de;
  --text-muted: #8795b2;
  --page-bg: #081225;
  --surface-solid: rgba(15, 28, 52, 0.96);
  --glass-subtle: rgba(23, 40, 70, 0.78);
  --glass-medium: rgba(16, 31, 57, 0.62);
  --glass-border: rgba(255, 255, 255, 0.13);
  --glass-highlight: rgba(255, 255, 255, 0.20);
  --shadow-glass: 0 18px 56px rgba(0, 0, 0, 0.34);
}
```

Các token trên là định hướng. Khi triển khai phải ánh xạ vào biến CSS hiện có và tránh tạo hai hệ token song song.

### 5.3 Typography

- Font ưu tiên: Inter hoặc font sans-serif hệ thống tương đương.
- Tiêu đề trang desktop: 24–30px, 650–700.
- Tiêu đề section: 16–20px, 600–700.
- Nội dung chính: 14–16px.
- Nhãn phụ và metadata: 12–13px, không nhỏ hơn 12px.
- Số liệu KPI dùng tabular numbers khi có thể.

### 5.4 Motion

- Thời gian chuyển trạng thái thường: 160–240ms.
- Modal/drawer: 220–320ms.
- Chỉ animate opacity, transform và các thuộc tính tối ưu tốt.
- Không animate blur liên tục trên danh sách dài.
- Tuân thủ `prefers-reduced-motion`.

### 5.5 Khả năng truy cập

- Vùng chạm tối thiểu 44×44px.
- Focus ring rõ ràng cho bàn phím.
- Không dùng màu làm tín hiệu duy nhất; luôn kèm icon hoặc nhãn.
- Văn bản thường đạt tương phản tối thiểu WCAG AA.
- Modal khóa focus, hỗ trợ Escape và trả focus về phần tử mở.
- Tooltip không chứa thông tin bắt buộc duy nhất.

## 6. Thành phần dùng chung

### 6.1 App shell

- Sidebar desktop có trạng thái mở/thu gọn.
- Bottom navigation mobile theo vai trò.
- Header có tiêu đề trang, notification bell, theme toggle và user menu.
- Nền có gradient/quầng sáng rất nhẹ; không gây nhiễu nội dung.

### 6.2 Card

- `GlassCard`: KPI, bộ lọc, panel phụ.
- `SolidCard`: bảng, form, lịch, dữ liệu nhạy cảm.
- Card có header tùy chọn, action slot và trạng thái loading.

### 6.3 Button

- Primary: hành động chính duy nhất trong một vùng.
- Secondary: hành động phụ.
- Ghost: toolbar/navigation.
- Danger: xóa hoặc từ chối không thể hoàn tác trực tiếp.
- Loading giữ nguyên chiều rộng và vô hiệu hóa nhấn lặp.

### 6.4 Form

- Label luôn hiển thị, không dùng placeholder thay label.
- Helper text và error text đặt ngay dưới trường.
- Trạng thái required, disabled, readonly và loading phải phân biệt rõ.
- Date/time picker phù hợp ngôn ngữ Việt Nam.

### 6.5 Status chip

- Có mặt / Thành công: xanh lá.
- Đi muộn / Cần chú ý: cam.
- Vắng mặt / Từ chối / Lỗi: đỏ.
- Chờ duyệt: xanh dương hoặc vàng dịu.
- Nghỉ phép / Trung tính: tím hoặc xám xanh.

### 6.6 Data table

- Header sticky khi bảng dài.
- Tìm kiếm, lọc và phân trang rõ ràng.
- Cột hành động ghim bên phải nếu cần.
- Mobile chuyển sang card hoặc chế độ cuộn ngang có nhãn cột.
- Skeleton loading giữ cấu trúc bảng.

### 6.7 Modal và drawer

- Modal cho xác nhận hoặc form ngắn.
- Drawer cho nội dung chi tiết và form dài trên desktop.
- Mobile ưu tiên bottom sheet/full-screen sheet.
- Hành động nguy hiểm phải nêu rõ đối tượng và hậu quả.

## 7. Đặc tả từng trang

## 7.1 LoginPage — Đăng nhập

### Mục tiêu

Cho phép người dùng đăng nhập nhanh và nhận biết rõ lỗi xác thực.

### Bố cục

- Nền gradient Liquid Glass tối giản.
- Card đăng nhập gần đặc, đặt giữa màn hình.
- Logo ET OFFICE, lời chào ngắn, email/tên đăng nhập, mật khẩu.
- Nút hiện/ẩn mật khẩu, `Quên mật khẩu?`, nút `Đăng nhập`.
- Hiển thị trạng thái offline hoặc không kết nối server khi có.

### Trạng thái

- Loading khi đăng nhập.
- Sai tài khoản/mật khẩu.
- Tài khoản bị khóa hoặc không hoạt động.
- Server không khả dụng.
- Token hết hạn và chuyển về đăng nhập.

## 7.2 ForgotPasswordPage — Quên mật khẩu

### Luồng

1. Nhập email hoặc định danh tài khoản.
2. Nhận mã xác minh theo cơ chế hiện tại.
3. Nhập code và mật khẩu mới.
4. Xác nhận thành công và quay lại đăng nhập.

### Yêu cầu UI

- Stepper rõ bước hiện tại.
- Đếm thời gian gửi lại mã nếu API hỗ trợ.
- Quy tắc mật khẩu hiển thị trước khi submit.
- Không tiết lộ tài khoản có tồn tại hay không nếu backend chủ động che thông tin.

## 7.3 DashboardPage — Tổng quan

### Admin

- KPI: tổng nhân viên, có mặt, đi muộn, vắng mặt.
- Biểu đồ chấm công theo giờ hoặc xu hướng.
- Đơn chờ duyệt và cảnh báo chờ xử lý.
- Bảng chấm công hôm nay.
- Bộ lọc phòng ban và ngày.

### Leader

- Cùng cấu trúc nhưng chỉ hiển thị dữ liệu đội nhóm/phòng ban được phép.
- Nhãn phạm vi dữ liệu phải rõ ràng.

### Trạng thái

- Không có dữ liệu hôm nay.
- Đang tải từng widget độc lập.
- Lỗi một widget không làm hỏng toàn trang.
- Pull-to-refresh hoặc refresh action trên mobile.

## 7.4 CheckInPage — Chấm công

### Thông tin chính

- Đồng hồ và ngày hiện tại.
- Trạng thái ca làm việc.
- Nút `Chấm công vào` hoặc `Chấm công ra` theo trạng thái.
- Vị trí GPS, khoảng cách và độ chính xác.
- Bản đồ vị trí.
- Camera/selfie khi được yêu cầu.
- Timeline check-in/check-out trong ngày.

### Quy tắc UX

- Không bật hành động chính khi chưa có GPS bắt buộc.
- Nêu rõ đang xin quyền, đang định vị, GPS yếu hoặc bị từ chối.
- Khi cần selfie, giải thích lý do ngắn gọn, không mang tính buộc tội.
- Sau submit hiển thị giờ, vị trí, trạng thái xác minh và bước tiếp theo.
- Ngăn submit lặp khi đang xử lý.

### Trạng thái lỗi

- Trình duyệt không hỗ trợ GPS/camera.
- Người dùng từ chối quyền.
- GPS ngoài phạm vi.
- Độ chính xác không đạt.
- Camera không khả dụng.
- Offline hoặc timeout.
- Ca đã chấm hoặc bản ghi bị khóa.

## 7.5 HistoryPage — Lịch sử chấm công

### Bố cục

- Chuyển đổi giữa danh sách và lịch tháng.
- Calendar có dot/màu trạng thái và chú giải.
- Chọn ngày để xem timeline chi tiết.
- Tổng kết tháng: đủ giờ, đi muộn, về sớm, vắng, nghỉ phép, tổng giờ.
- Stepper điều chỉnh ±15 phút chỉ xuất hiện đúng quyền/ngữ cảnh hiện tại.

### Quy tắc

- Employee chỉ xem dữ liệu cá nhân.
- Các sửa đổi hoặc yêu cầu sửa công phải thể hiện lịch sử/trạng thái.
- Ngày chưa có dữ liệu không bị hiểu nhầm là vắng nếu chưa đến ngày làm việc.

## 7.6 LeaderboardPage — Bảng xếp hạng

### Bố cục

- Tabs: Hôm nay / Tuần / Tháng.
- Top 3 nổi bật nhưng không phô trương quá mức.
- Danh sách còn lại có thứ hạng, tên, phòng ban và chỉ số chuyên cần.
- Hiển thị cách tính hoặc tooltip giải thích điểm.

### Yêu cầu

- Không hiển thị dữ liệu nhạy cảm như lương, lý do nghỉ hoặc chi tiết cảnh báo.
- Empty state khi chưa đủ dữ liệu.

## 7.7 RequestsPage — Đơn từ và cảnh báo

### Khu vực đơn từ

- Tabs loại đơn: nghỉ phép, đi muộn/về sớm, công tác, tăng ca, khác.
- Bộ lọc trạng thái: tất cả, chờ duyệt, đã duyệt, từ chối.
- Danh sách có mã đơn, loại, thời gian, số ngày/giờ, người gửi và trạng thái.
- Form tạo đơn dạng drawer/modal.
- Chi tiết đơn có lịch sử duyệt và lý do từ chối.

### Hành động quản lý

- Duyệt.
- Từ chối kèm lý do.
- Hoàn tác về pending.
- Xóa an toàn.

### Trung tâm cảnh báo

- Filter: chờ duyệt, thiết bị lạ, kèm selfie, đã duyệt, từ chối.
- Card hoặc bảng hiển thị nhân viên, ca, thiết bị, lý do cảnh báo và selfie.
- Hành động duyệt, từ chối, hoàn tác hoặc xóa theo quyền.
- Khi từ chối, có gợi ý lý do và tùy chọn xóa dữ liệu để chấm lại.

## 7.8 StaffPage — Quản lý nhân sự

### Danh sách

- Tìm kiếm theo tên, mã hoặc email.
- Lọc phòng ban, vai trò và trạng thái.
- Cột: mã nhân viên, họ tên, phòng ban, chức vụ, liên hệ, vai trò, trạng thái.
- Action menu theo quyền.

### Chi tiết nhân viên

- Thông tin cơ bản.
- Phòng ban và vai trò.
- Trạng thái tài khoản.
- Thiết bị theo DTO được phép.
- Ngày phép hoặc thông tin liên quan nếu đúng quyền.

### Quản lý thiết bị — Admin only

- Danh sách thiết bị và thời điểm sử dụng gần nhất.
- Chỉ báo `MÁY CHÍNH`.
- Đặt trusted device.
- Xóa thiết bị cũ với xác nhận.

Leader không được thấy hoặc kích hoạt các action admin-only.

## 7.9 ProfilePage — Hồ sơ cá nhân

- Ảnh đại diện hoặc initials.
- Thông tin cá nhân và công việc.
- Đổi mật khẩu.
- Thông tin xe cá nhân theo API hiện có.
- Thiết lập giao diện nếu có.
- Phiên đăng nhập/đăng xuất.

Các trường không được sửa phải hiển thị readonly rõ ràng, không giả dạng input disabled khó đọc.

## 7.10 ProjectsPage — Dự án/công trình

### Danh sách

- Card hoặc bảng theo mật độ dữ liệu.
- Tên, mã, khách hàng/địa điểm nếu có, PM, thành viên, deadline, tiến độ và trạng thái.
- Tìm kiếm và lọc trạng thái/PM.

### Quyền hành động

- Admin: tạo, sửa, xóa.
- PM: sửa dự án mình phụ trách.
- Người khác: chỉ xem.

### Trạng thái

- Sắp đến hạn, trễ hạn, hoàn thành.
- Dự án chưa có PM hoặc chưa có thành viên.

## 7.11 ExpensesPage — Chi tiêu và hoàn ứng

- KPI tổng chi, đang chờ, đã hoàn và cần xử lý.
- Bộ lọc thời gian, dự án, nhân viên và trạng thái.
- Bảng giao dịch/đề nghị hoàn ứng.
- Chi tiết chứng từ trong drawer.
- Số tiền dùng định dạng Việt Nam và căn phải.
- Bề mặt gần đặc; hạn chế trong suốt vì đây là dữ liệu tài chính.

## 7.12 VehiclesPage — Phương tiện

- Bảng tinh gọn: nhân viên, loại xe, biển số, trạng thái gửi xe và ghi chú.
- Tìm kiếm theo tên hoặc biển số.
- Chỉ Admin thấy action sửa.
- Employee xem/sửa thông tin cá nhân qua luồng hồ sơ nếu API cho phép.
- Biển số hiển thị rõ, không dùng font quá trang trí.

## 7.13 ReportPage — Báo cáo

- Bộ chọn kỳ báo cáo.
- Bộ lọc phòng ban và nhân viên.
- Thẻ tổng hợp.
- Ma trận công và bảng chi tiết cá nhân.
- Hành động xuất PDF/CSV/Excel theo khả năng hiện có.
- Trạng thái dữ liệu bị khóa/chốt phải rõ.
- Bản in/PDF không chứa gradient hoặc blur gây mất nội dung.

Trang này là admin-only theo API báo cáo hiện tại.

## 7.14 SettingsPage — Cài đặt hệ thống

### Nhóm cấu hình

- Ca làm việc.
- Vị trí GPS văn phòng.
- Ngày lễ.
- Quy tắc hệ thống hiện có.
- Chốt công và trạng thái liên quan nếu được bố trí tại đây.

### UX

- Chia section rõ, có mô tả tác động.
- Save bar sticky khi có thay đổi chưa lưu.
- Cảnh báo trước thay đổi ảnh hưởng nhiều nhân viên.
- Admin-only; không render route/action cho vai trò khác.

## 8. Notification Center

- Bell hiển thị badge số chưa đọc.
- Panel kính mở từ header trên desktop; full-height sheet trên mobile.
- Nhóm theo hôm nay, trước đó hoặc loại thông báo.
- Hành động đánh dấu đã đọc từng mục/tất cả.
- Click thông báo điều hướng đúng trang và đối tượng nếu còn tồn tại.
- Empty state thân thiện, không hiển thị badge khi bằng 0.

## 9. Trạng thái hệ thống dùng chung

Mỗi trang phải thiết kế tối thiểu các trạng thái phù hợp:

- Initial loading.
- Background refresh.
- Empty state.
- Không có kết quả tìm kiếm.
- Lỗi mạng/server.
- Offline với dữ liệu fallback.
- Không có quyền.
- Phiên đăng nhập hết hạn.
- Success sau mutation.
- Conflict khi dữ liệu đã thay đổi hoặc bị khóa.

Không thay toàn màn hình bằng spinner nếu có thể giữ shell và skeleton theo khu vực.

## 10. Nội dung và giọng điệu

- Ngắn gọn, chuyên nghiệp và trung lập.
- Không dùng ngôn ngữ buộc tội khi phát hiện thiết bị lạ.
- Nút dùng động từ cụ thể: `Duyệt đơn`, `Từ chối`, `Hoàn tác`, `Xóa ca`.
- Confirmation phải nêu đối tượng và hậu quả.
- Ngày giờ theo định dạng Việt Nam nhất quán.
- Số giờ dùng `8 giờ 15 phút` ở nội dung; bảng có thể dùng `8h 15m`.
- Số tiền dùng dấu phân tách và đơn vị rõ ràng.

## 11. Dữ liệu mẫu cho thiết kế

Sử dụng tên và dữ liệu giả, không dùng dữ liệu nhân viên thật:

- Nguyễn Văn An — Kinh doanh — Trưởng phòng.
- Trần Thị Bích Ngọc — Nhân sự — Chuyên viên.
- Lê Minh Hoàng — IT — Kỹ sư phần mềm.
- Phạm Thu Hà — Kế toán — Kế toán viên.
- Hoàng Quốc Dũng — Vận hành — Nhân viên.

Trạng thái mẫu:

- Có mặt: 07:58–17:02.
- Đi muộn: 08:15–17:03.
- Về sớm: 08:05–16:30.
- Vắng mặt: chưa có check-in.
- Đơn chờ duyệt, đã duyệt và từ chối.
- Thiết bị tin cậy, chưa xác thực và thiết bị lạ.

## 12. Responsive breakpoints đề xuất

- Mobile nhỏ: 360–479px.
- Mobile lớn: 480–767px.
- Tablet: 768–1023px.
- Desktop: 1024–1439px.
- Desktop lớn: từ 1440px.

Thiết kế phải fluid giữa breakpoint; không chỉ tạo hai ảnh desktop/mobile tách biệt.

## 13. Hiệu năng và fallback

- Có màu nền thay thế khi không hỗ trợ `backdrop-filter`.
- Giảm blur trên mobile hoặc thiết bị yếu.
- Không đặt nhiều lớp blur lồng nhau.
- Lazy-load ảnh selfie và nội dung nặng.
- Giữ hiệu ứng Magic Cursor chỉ trên thiết bị con trỏ chính xác và khi không giảm chuyển động.
- Không để nền động tiêu tốn pin liên tục.

## 14. Bảo mật và riêng tư trong giao diện

- Không lưu hoặc log JWT, mật khẩu, selfie hay dữ liệu thiết bị vào thông báo giao diện không cần thiết.
- Không hiển thị dữ liệu vượt quá DTO của vai trò.
- Selfie chỉ hiển thị cho người có quyền duyệt.
- Hành động admin-only không chỉ disabled mà phải được loại khỏi UI của vai trò khác.
- Khi phiên hết hạn, xóa trạng thái nhạy cảm trước khi về trang đăng nhập.
- Nội dung lỗi không lộ stack trace hoặc chi tiết hệ thống.

## 15. Tiêu chí nghiệm thu

### Thiết kế

- Tất cả 14 trang sử dụng chung hệ token và component.
- Liquid Glass có phân cấp, không ảnh hưởng khả năng đọc.
- Light/dark mode hoàn chỉnh.
- Có thiết kế desktop và mobile cho tác vụ chính.
- Có trạng thái loading, empty, error và permission phù hợp.

### Chức năng

- Không thay đổi API, quyền hạn hoặc nghiệp vụ ngoài phạm vi UI.
- Các action chỉ xuất hiện đúng vai trò.
- GPS, selfie và anti-fraud tiếp tục hoạt động.
- Offline fallback không bị phá vỡ.
- Form hiển thị lỗi đúng trường và ngăn submit lặp.

### Chất lượng

- Frontend build thành công.
- Không có lỗi console nghiêm trọng trong luồng chính.
- Test backend hiện có tiếp tục đạt.
- Kiểm tra các kích thước 360px, 768px, 1024px và 1440px.
- Kiểm tra keyboard navigation, focus, contrast và reduced motion.
- Kiểm tra trình duyệt có và không hỗ trợ `backdrop-filter`.

## 16. Thứ tự triển khai đề xuất

### Giai đoạn 1 — Nền tảng giao diện

- Chuẩn hóa token màu, glass surface, shadow, radius và spacing.
- Cập nhật app shell, sidebar, header, bottom navigation và theme.
- Xây dựng component dùng chung và fallback.

### Giai đoạn 2 — Luồng cốt lõi

- Login và quên mật khẩu.
- Dashboard.
- Chấm công.
- Lịch sử.
- Đơn từ và cảnh báo.

### Giai đoạn 3 — Quản trị

- Nhân sự và thiết bị.
- Dự án.
- Báo cáo.
- Cài đặt.
- Phương tiện và chi tiêu.

### Giai đoạn 4 — Hoàn thiện

- Leaderboard, profile và notification center.
- Dark mode, responsive và accessibility audit.
- Tối ưu hiệu năng blur/animation.
- Regression test toàn bộ vai trò.

## 17. Hướng dẫn dành cho công cụ thiết kế/AI

Khi tạo mockup hoặc mã giao diện:

1. Dùng cấu trúc và quyền hạn trong tài liệu này làm nguồn sự thật.
2. Không tự sáng tạo thêm quyền hoặc nghiệp vụ.
3. Ưu tiên khả năng sử dụng hơn hiệu ứng kính.
4. Giữ bảng, form, bản đồ và selfie dễ đọc.
5. Thiết kế từng trang ở cả desktop và mobile khi trang có luồng quan trọng.
6. Dùng dữ liệu giả trong mục 11.
7. Nêu rõ giả định nếu thông tin chưa được mô tả.
8. Mọi thay đổi nghiệp vụ phải tách khỏi đề xuất UI.

