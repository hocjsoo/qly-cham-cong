# Kế hoạch nâng cấp ET OFFICE PORTAL

Ngày lập: 06/09/2026. Mốc mã nguồn khảo sát: `c3c8f98`.

Cập nhật ưu tiên theo yêu cầu tiếp theo: **tối ưu tải và cải thiện giao diện trước**. Đợt đầu đã triển khai trên mã làm việc: điều hướng mobile 4 mục chính + tiện ích, giữ app shell khi tải trang, tải trước tối đa 2 trang theo quyền/kết nối, hủy lượt tải cũ ở Lịch sử/Chi tiêu/Xếp hạng/Lịch tuần, ảnh tải theo nhu cầu và kiểm thử trình duyệt. Chưa phát hành lên hệ thống đang sử dụng. Chi tiết kiểm tra nằm trong [hướng dẫn test frontend](D:/QLY_CHAM_CONG/client/tests/README.md). Lộ trình tổng thể bên dưới giữ làm danh sách công việc tiếp theo; đợt UI này mới thực hiện một phần phạm vi của đợt 2 và 4.

Mục tiêu ưu tiên: dữ liệu công/phép chính xác, thao tác ổn định, tải trang nhanh, dễ dùng trên điện thoại, dễ bảo trì và khôi phục khi có sự cố. Phạm vi gồm toàn bộ sản phẩm hiện có. Đây là kế hoạch triển khai; các hạng mục bên dưới chưa được thực hiện chỉ bởi việc lập tài liệu này.

**1. Hướng nâng cấp**

Giữ React, Express, MongoDB, JavaScript/JSX và hệ thống CSS hiện tại. Chia nhỏ trách nhiệm bên trong ứng dụng; giữ một trang đầu vào và một bộ route/controller theo từng nghiệp vụ, đưa logic dùng chung sang component, hook và service. Quy mô hiện tại 30–50 nhân viên chưa cung cấp bằng chứng cần tách microservices, thêm Redis hay đổi nền tảng.

Theo ưu tiên mới, cải thiện tải trang và thao tác giao diện trước, giữ các quy tắc công/phép hiện tại. Khi triển khai phần nghiệp vụ tiếp theo, hoàn thiện các đường xử lý dữ liệu trước khi mở rộng chức năng. Mỗi đợt có bản phát hành riêng, kiểm thử hồi quy và khả năng quay lại phiên bản trước. Kiểm thử, phân quyền và vận hành được làm xuyên suốt.

**2. Hiện trạng đã xác minh**

| Hạng mục | Hiện trạng | Hệ quả với kế hoạch |
|---|---|---|
| Kiểm tra mã nguồn | Bộ chạy backend báo 525/525 đạt; frontend lint và build đạt tại thời điểm khảo sát | Giữ làm nền; con số này không phải tỷ lệ bao phủ mã hoặc bằng chứng đủ cho tải thực tế |
| Tối ưu vừa hoàn thành | Tách tải trang, cache GET theo phạm vi tài khoản, gộp GET đang chạy, chống phản hồi cũ tại Report/Requests, giảm dữ liệu một số API | Kế thừa, bổ sung đo lường và mở rộng những chỗ còn thiếu |
| Đơn nghỉ dài ngày | Mô hình đơn đã có ngày bắt đầu/kết thúc; truy vấn cảnh báo đã loại ca bình thường và dòng nghỉ không có cảnh báo thực | Không làm lại mô hình từ đầu; hoàn thiện lọc theo khoảng thời gian, số đếm, công/phép và kiểm thử |
| Frontend | 17 tệp trang; Report khoảng 2.908 dòng, Requests 2.227, Projects 2.053, Dashboard 2.035 | Tách theo chức năng trong lúc sửa nghiệp vụ; tránh một đợt viết lại toàn bộ |
| Dữ liệu phía trình duyệt | Có cache tự quản; TanStack Query đã khai báo nhưng chưa dùng trong source được khảo sát | Chuyển dần sang một cơ chế quản lý dữ liệu thống nhất; không duy trì hai cache cho cùng tài nguyên |
| Kiểm thử giao diện | Lệnh test của client đang chạy lại bộ test server; một số test kiểm tra chuỗi source hoặc logic mô phỏng | Bổ sung kiểm thử component/hook thật và trình duyệt cho luồng quan trọng |
| CI | Đã có lint/build frontend và test backend, dùng lockfile; cấu hình Node 20 | Mở rộng pipeline hiện tại, đồng bộ runtime được hỗ trợ |
| PWA | Có manifest; chưa tìm thấy service worker trong source | Xác định rõ hành vi mất mạng trước khi bổ sung khả năng offline |
| Vận hành | Health check kết nối DB cơ bản; chưa thấy runbook staging, restore, rollback trong repo | Kiểm kê cấu hình nhà cung cấp khi triển khai; chưa kết luận dịch vụ đang thiếu backup |

Build tham chiếu: CSS chính 18,90 kB gzip; vendor-core 92,41 kB; ReportPage 23,45 kB; vendor-charts 106,60 kB; jspdf 129,77 kB; html2canvas 46,78 kB. Các gói tải theo nhu cầu không được cộng mặc định vào dung lượng lần mở đầu. Chưa đo thời gian tải thực tế trên hệ thống đang phục vụ người dùng.

**3. Những vấn đề cần xử lý trước**

| Ưu tiên | Bằng chứng trong mã nguồn | Thay đổi cần làm và tiêu chí chính |
|---|---|---|
| P0 — Chặn phát hành phần liên quan | [Seed lúc khởi động](D:/QLY_CHAM_CONG/server/src/server.js:17) và [ghi đè lịch làm việc](D:/QLY_CHAM_CONG/server/src/database/seed.js:64) | Khởi động lại có thể đổi lịch hợp lệ 5 ngày thành 6 ngày. Tách khởi tạo và migration có phiên bản. Lưu lịch 5 ngày → restart/deploy → giữ nguyên |
| P0 — Chặn phát hành phần liên quan | [Duyệt yêu cầu sửa công](D:/QLY_CHAM_CONG/server/src/controllers/correctionController.js:78), [xử lý ca cảnh báo](D:/QLY_CHAM_CONG/server/src/controllers/attendanceController.js:1856) | Chưa có kiểm tra chốt công nhất quán trên mọi đường thay đổi dữ liệu; correction lưu trạng thái trước cập nhật công. Dùng chung kiểm tra quyền, phạm vi, khóa tháng/cá nhân, giao dịch và nhật ký; lỗi giữa chừng không để dữ liệu lệch |
| P1 — Công/phép | [Tổng hợp tháng](D:/QLY_CHAM_CONG/server/src/controllers/reportController.js:56), [hoàn phép](D:/QLY_CHAM_CONG/server/src/controllers/leaveBalanceController.js:136) | Có nơi lọc theo tháng bắt đầu, đếm số đơn thành số ngày nghỉ, dùng mốc 22 ngày cố định hoặc hoàn về năm bắt đầu. Thống nhất lịch công và cách phân bổ theo từng ngày/năm |
| P1 — Hoàn tác | [Phục hồi snapshot](D:/QLY_CHAM_CONG/server/src/controllers/requestController.js:593) | Hoàn tác có thể ghi đè thay đổi xảy ra sau lúc duyệt. Kiểm tra phiên bản/xung đột hoặc theo dõi phần đóng góp của từng đơn; giữ thay đổi mới hoặc trả lỗi xung đột có hướng xử lý |
| P1 — Dữ liệu đầu vào | [Khoảng ngày](D:/QLY_CHAM_CONG/server/src/controllers/requestController.js:84), [tạo đơn](D:/QLY_CHAM_CONG/server/src/controllers/requestController.js:273) | Kiểm tra ngày lịch hợp lệ, thứ tự và giới hạn khoảng ngày; quy tắc trùng theo loại đơn; chống gửi/duyệt lặp đồng thời. Không cấm tất cả đơn trùng ngày vì OT và các loại đơn khác có thể tương thích |
| P1 — Phiên và cache | [Auth](D:/QLY_CHAM_CONG/server/src/controllers/authController.js), [NotificationCenter](D:/QLY_CHAM_CONG/client/src/components/NotificationCenter.jsx) | Bổ sung cơ chế thu hồi phiên khi đổi/reset mật khẩu hoặc thay đổi quyền; cache bám phiên, quyền và phòng ban. Kiểm thử A đăng xuất → B đăng nhập khi request A còn đang chạy |
| P1 — Phản hồi tới sai thứ tự | History, Expenses, Leaderboard, TtsSchedule, Settings, Staff | Áp dụng nhất quán hủy request và bảo vệ lần tải mới nhất. Đổi tháng/bộ lọc nhanh không bị phản hồi cũ ghi đè |

P0 ở đây là mức ưu tiên cho đợt nâng cấp, không khẳng định đã xảy ra sự cố trên dữ liệu thật.

**4. Lộ trình và đầu ra từng đợt**

Ước lượng dưới đây dành cho một lập trình viên làm toàn thời gian, có người dùng nghiệm thu nghiệp vụ kịp thời. Ngày là ngày công, chưa phải cam kết lịch giao. Các công việc QA/ops đã nằm trong từng đợt, không cộng thêm lần nữa.

| Đợt | Thời lượng | Công việc chính | Điều kiện hoàn tất |
|---|---:|---|---|
| 0. Khóa mốc và nền tảng | 2 ngày | Lưu kết quả test/build, dựng dữ liệu giả và phép đo; tái hiện lỗi ưu tiên; sửa seed khi khởi động; kiểm kê quyền và môi trường; kiểm tra tương thích runtime LTS | Restart không đổi cài đặt; fixture tái lập; báo cáo phân biệt kiểm thử mock, controller thật, DB thật và trình duyệt |
| 1. Đúng dữ liệu và quyền | 6–8 ngày | Kiểm tra khóa trên mọi đường ghi; giao dịch correction; lịch công/phép chung; đơn xuyên tháng/năm; chống duyệt kép; hoàn tác có kiểm tra xung đột; đối chiếu quyền báo cáo/sửa công | Chốt tháng được bảo vệ trên mọi API liên quan; không trừ phép hai lần; đơn dài ngày và hoàn tác khớp bảng công, phép, báo cáo và nhật ký; kiểm thử giao dịch trên Mongo replica set tạm đạt trước phát hành |
| 2. Tải trang và quản lý dữ liệu | 5–7 ngày | Chuẩn hóa query/cache theo phiên; lần lượt chuyển Report, Requests, Dashboard rồi trang còn lại; hủy request thật; cập nhật cache sau thay đổi; tải trước theo quyền/kết nối; giảm polling nền | Phản hồi mới nhất luôn thắng; đổi tài khoản không thấy dữ liệu cũ; cùng query chỉ có một GET đang chạy; thay đổi công/đơn cập nhật mọi màn hình liên quan; component/browser test về phiên và cache đạt trước phát hành |
| 3. API, lưu trữ và cấu trúc | 5–7 ngày | Giảm trường truy vấn ngay tại DB, phân trang danh sách, bỏ N+1, đo index; tách service/component; chuẩn hóa lỗi/DTO; tách ảnh khỏi danh sách và chuẩn bị chuyển lưu trữ | API đạt mục tiêu đo đã chốt; danh sách không mang Base64 ảnh; dữ liệu cũ vẫn đọc được; API tương thích trong lúc chuyển đổi |
| 4. Trải nghiệm toàn sản phẩm | 6–8 ngày | Điều hướng mobile, form/modal/bảng thống nhất; hoàn thiện các module theo bảng mục 5; lỗi/thử lại rõ; khả năng dùng bàn phím, dark/light; luồng GPS/camera trên thiết bị thật | Hoàn tất checklist theo vai trò và thiết bị; tác vụ chính dùng được ở màn hình tối thiểu 320 px, kiểm tra thêm máy đại diện 360 px; thông báo và số đếm đúng phạm vi |
| 5. Vận hành và bảo trì | 5–7 ngày | Hoàn thiện phiên đăng nhập và pipeline kiểm thử đã đưa vào từ đợt 1–2; staging riêng; log/metrics; backup/restore; migration/rollback; PWA có giới hạn cache rõ | CI bảo vệ mã chạy thật; diễn tập khôi phục thành công; truy được lỗi UI → API; cache offline không lộ dữ liệu HR giữa tài khoản |
| 6. Nghiệm thu và phát hành | 3–4 ngày | Đối chiếu báo cáo mẫu đã duyệt; chạy bộ hồi quy; so sánh hiệu năng trước/sau; nghiệm thu admin/leader/nhân viên/PM; phát hành theo đợt và cập nhật hướng dẫn | Không còn lỗi chặn phát hành; đạt chỉ tiêu; có phiên bản, bản sao lưu, hướng quay lại và người nghiệm thu |

Tổng: **32–43 ngày công**, thêm khoảng 20% dự phòng thành **39–52 ngày công, tương đương khoảng 8–11 tuần**. Phần ưu tiên từ đợt 0 đến đợt 2 khoảng **3–4 tuần**. Sẽ điều chỉnh sau baseline, kết quả thử migration và các quyết định nghiệp vụ ở mục 10.

Quan hệ phụ thuộc: đợt 1 dựa trên baseline đợt 0; đợt 2 dùng quy tắc thay đổi dữ liệu của đợt 1 để xác định cache cần làm mới; đợt 3 giữ hợp đồng API đã thống nhất; đợt 4 dùng component/query chung. Chuẩn bị staging, kiểm thử và phương án khôi phục bắt đầu từ đợt 0; mọi thay đổi dữ liệu thật phải có phương án khôi phục trước khi chạy.

**5. Nâng cấp theo từng phần sản phẩm**

| Phần sản phẩm | Phạm vi nâng cấp | Ví dụ nghiệm thu |
|---|---|---|
| Chấm công, GPS, selfie | Trạng thái xin quyền/lỗi/thử lại rõ; chặn gửi lặp; thời gian và ca qua đêm dùng quy tắc chung; ảnh tải riêng; cảnh báo thiết bị có giải thích | Mạng chập chờn và bấm hai lần chỉ tạo một kết quả hợp lệ; thử GPS/camera bằng thiết bị thật; không tin tuyệt đối vào fingerprint phía trình duyệt |
| Đơn từ, nghỉ phép | Một đơn cho một lần đăng ký nhiều ngày; thẻ hiển thị từ–đến, số ngày và trạng thái; lọc tháng theo giao nhau của khoảng ngày; lý do từ chối/hoàn tác rõ | Đơn 28/09–03/10 xuất hiện khi xem cả tháng 9 lẫn tháng 10; mỗi danh sách đếm một đơn, bảng công vẫn có dòng từng ngày |
| Lịch sử cá nhân | Đổi tháng nhanh ổn định; tải chi tiết khi cần; trạng thái công/đơn dễ hiểu; sửa/giải trình theo đúng quyền | Đổi tháng ba lần liên tiếp chỉ hiển thị tháng cuối; phần chỉnh giờ không vượt khóa và quyền hiện tại |
| Bảng công, báo cáo, xuất tệp, chốt công | Một bộ tính công/phép/OT dùng chung; thống nhất màn hình với Excel/PDF; phân biệt tháng đang chạy và tháng đã chốt; tối ưu bảng lớn | Cùng nhân viên/kỳ có tổng giờ, công, phép, OT giống nhau ở UI và bản xuất; kiểm tra ca qua đêm, lễ, đơn xuyên năm |
| Dashboard, chuyên cần | Tổng hợp theo phạm vi vai trò, lịch làm việc thực; giảm gọi lặp; tạm dừng polling khi tab ẩn; hiển thị thời điểm cập nhật | Duyệt nghỉ/sửa công làm mới đúng số liệu; không tính ngày nghỉ hợp lệ thành hiện diện hoặc thiếu công do công thức cố định |
| Nhân sự, phòng ban, thiết bị | DTO tối thiểu theo vai trò; tìm kiếm/phân trang; quy trình đổi phòng ban, khóa tài khoản, đặt máy chính rõ; nhật ký thay đổi | Leader chỉ xử lý đúng phạm vi đã chốt; khóa hoặc đổi quyền có hiệu lực với phiên/cache; không lộ trường HR ngoài phạm vi |
| Đăng nhập, hồ sơ, mật khẩu | Thu hồi phiên theo phiên bản tài khoản; xử lý hết hạn nhất quán; đồng bộ đăng xuất giữa tab; rà reset/rate limit | Sau reset hoặc thu hồi phiên, token cũ bị từ chối và dữ liệu phiên cũ không quay lại giao diện |
| Dự án/công trình, PM | Tách danh sách, bộ lọc, form, chi tiết; quyền sửa theo người phụ trách; kiểm tra deadline/tiến độ; tải chi tiết theo nhu cầu | PM sửa được dự án được giao và bị từ chối với dự án khác cả UI lẫn API |
| Chi tiêu/hoàn ứng | Chống phản hồi cũ khi tìm kiếm; danh sách nhẹ; biên nhận tải riêng; kiểm tra số tiền/trạng thái; thống nhất xuất dữ liệu | Tìm kiếm nhanh không nhảy về kết quả cũ; tổng tiền khớp chi tiết; lỗi gửi không tạo bản ghi lặp |
| Phương tiện/gửi xe | Luồng đề nghị đổi và duyệt rõ; phân quyền sửa trực tiếp; tìm kiếm và trạng thái thống nhất | Nhân viên gửi đề nghị; chỉ vai trò được phép sửa dữ liệu chính; nhật ký lưu thay đổi |
| Lịch TTS | Tải theo kỳ, chống race khi đổi tuần/tháng; xác thực lịch và quyền; đối chiếu với quy tắc tính công áp dụng | Lịch đã xác nhận được dùng nhất quán trong báo cáo; chuyển kỳ nhanh không hiển thị dữ liệu kỳ cũ |
| Thông báo, email | Cache/badge theo người dùng; đọc/đánh dấu cập nhật đồng bộ; tải từng phần; theo dõi gửi lại có chống trùng theo khả năng kênh | Đổi tài khoản không còn thông báo người trước; thử email bằng hộp thư giả ở staging, không gửi nhân viên thật khi kiểm thử |
| Cài đặt, lễ, ngày phép | Ngày hiệu lực/quy tắc thay đổi rõ; kiểm tra dữ liệu; vô hiệu cache phụ thuộc; khởi động không tự sửa cài đặt | Đổi lịch làm việc ảnh hưởng đúng kỳ theo chính sách; tháng đã chốt không bị tính lại âm thầm |
| App shell, giao diện, PWA | Mobile dùng 4 mục chính theo vai trò + “Thêm”; bảng cần thiết có cuộn trong vùng; modal/focus/loading/error thống nhất; cập nhật ứng dụng và mất mạng rõ | Dùng bàn phím, màn hình 320/360 px và dark/light; báo đúng mất mạng; không báo chấm công thành công khi máy chủ chưa xác nhận |

Riêng yêu cầu gộp đơn dài ngày: một bản ghi Request là đơn gốc; các bản ghi Attendance theo từng ngày phục vụ tính công. Không đưa tất cả dòng nghỉ vào hàng đợi cảnh báo thiết bị. Nếu có nhiều đơn cũ độc lập, không tự gộp chỉ vì trùng người/lý do/ngày liền nhau; cần xem trước, xác định nguồn, giữ liên kết và lịch sử duyệt trước khi chuyển dữ liệu.

**6. Các quyết định kỹ thuật quan trọng**

1. **Một nơi tính công và kiểm tra thay đổi.** Dùng chung lịch làm việc, ngày lễ, ca qua đêm, đơn và ngày khóa cho các controller. Trước khi ghi phải kiểm tra quyền, người/phòng ban, khóa kỳ và phiên bản dữ liệu. Kiểm thử tranh chấp giữa chốt tháng với một thao tác ghi đang chạy. Lưu dấu vết đủ để đối chiếu và hoàn tác, tránh sao chép ảnh vào nhật ký.
2. **Phép theo chính sách có hiệu lực.** Ghi lại phân bổ ngày/phần ngày và năm phép tại lúc duyệt; hoàn tác hoàn đúng lượng đã trừ. Quy tắc cuối tuần/ngày lễ/nửa ngày/chuyển phép cần được thống nhất trước; không tự đổi chính sách công ty. Không tính lại kỳ đã khóa chỉ vì công thức hoặc cài đặt mới.
3. **Một cơ chế query.** Tiếp tục dùng `api.js` cho HTTP và Zustand cho phiên/trạng thái giao diện. Chuyển từng nghiệp vụ sang TanStack Query đã có sẵn, chuyển xong mới bỏ cache cũ của phần đó. Lập bảng phụ thuộc: duyệt đơn → đơn, lịch sử, bảng công, dashboard, phép; đổi cài đặt → dữ liệu kỳ chịu ảnh hưởng. Cơ chế invalidation có thể làm mới đúng nhóm dữ liệu đang được xem. [Tài liệu TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).
4. **Hủy request có hiệu lực.** Truyền `AbortSignal` xuống Axios; thay khóa cache hoặc xóa map không đồng nghĩa hủy kết nối đang chạy. Khi logout, kết hợp hủy request, xóa dữ liệu phiên và chặn kết quả từ phiên cũ. [Tài liệu query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
5. **Truy vấn theo nhu cầu.** Chọn trường ngay tại DB; giới hạn trang mặc định 50 và giới hạn tối đa hữu hạn; tính tổng/đếm với cùng bộ lọc và phạm vi quyền. Gộp các truy vấn phép theo nhân viên. Khi dùng dữ liệu dạng lean, giữ giá trị mặc định nghiệp vụ của bản ghi cũ.
6. **Index dựa trên phép đo.** Kiểm kê index thực tế và dùng `explain` trên DB thử nghiệm với truy vấn ngày, nhân viên, trạng thái và nhật ký sửa công. Thứ tự trường và tiền tố index ảnh hưởng khả năng phục vụ truy vấn; chỉ thêm index sau khi so sánh đọc, ghi và dung lượng. [Tài liệu MongoDB](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/).
7. **Ảnh lưu riêng, truy cập có quyền.** Dùng tham chiếu tệp, thumbnail và URL có kiểm soát truy cập; kiểm tra loại/kích thước ảnh và vòng đời lưu trữ. Chuyển theo bước: hỗ trợ đọc cũ+mới → sao chép → xác minh → đổi tham chiếu. Chỉ dọn dữ liệu cũ sau khi xác nhận backup và chính sách lưu giữ. Chọn dịch vụ sau khi biết chi phí và giới hạn gói hiện tại.
8. **Runtime và dependency có kiểm soát.** Kế hoạch chọn Node 24 LTS, thử tương thích rồi đồng bộ local, CI và backend; pin phiên bản đã kiểm tra. Node 20 đã hết hỗ trợ theo lịch chính thức. Kiểm kê thư viện không dùng, audit và cập nhật từng nhóm, không nâng tất cả cùng lúc. [Lịch phát hành Node.js](https://nodejs.org/en/about/previous-releases).
9. **Offline có giới hạn.** Bắt đầu với app shell và tài nguyên tĩnh, màn hình mất mạng/thử lại. Không cache mặc định API HR, selfie hoặc báo cáo vào service worker. Chấm công offline có đồng bộ là tính năng riêng cần thiết kế chống trùng, thời gian và xác thực trước khi đưa vào phạm vi triển khai.

**7. Cách đo tốc độ và điều kiện nghiệm thu**

Mọi con số bên dưới là mục tiêu đề xuất, chưa phải kết quả đã đạt. Đợt 0 sẽ ghi rõ thiết bị, mạng, phiên bản, kích thước dữ liệu và trạng thái máy chủ để chốt ngưỡng phù hợp.

| Chỉ tiêu | Mục tiêu đề xuất | Cách kiểm tra |
|---|---|---|
| Web Vitals | p75: LCP ≤ 2,5 giây; INP ≤ 200 ms; CLS ≤ 0,1 | Đo trên thiết bị/mạng đại diện; tách mobile/desktop. Đo lab ban đầu, xác nhận p75 khi có đủ mẫu người dùng; không coi một lần Lighthouse là số liệu thực địa |
| API đọc thường dùng | p95 ≤ 500 ms khi backend đã hoạt động ổn định | Fixture 50 nhân viên; đo cả API và truy vấn DB; ghi riêng khởi động nguội |
| Bảng công tháng | p95 API ≤ 1,5 giây với 50 nhân viên/31 ngày | Đo API, dung lượng phản hồi và thời gian render riêng; so sánh cùng fixture |
| Gọi API lặp | Cùng query và cùng phiên chỉ một GET đang chạy; không polling khi tab ẩn nếu nghiệp vụ không cần | Ghi lại hành trình Dashboard → Đơn từ → Bảng công → quay lại, đo trước/sau và kiểm tra cập nhật sau thao tác |
| Dung lượng danh sách | Trang mặc định tối đa 50 mục; không có ảnh Base64 trong payload danh sách | Kiểm tra payload, DTO và phân quyền; API báo cáo có giới hạn kỳ riêng |
| Tải theo nhu cầu | Map, biểu đồ và bộ xuất PDF chỉ tải ở hành trình cần dùng | Kiểm tra network và phân tích build; thiết lập ngân sách dung lượng sau baseline |
| Tính đúng của phiên | Không có phản hồi/cache phiên A xuất hiện ở phiên B | Component/browser test có request trì hoãn, logout, đổi vai trò/phòng ban, nhiều tab |
| Tính đúng dữ liệu | Không trùng bản ghi hoặc trừ phép kép; công/phép/OT khớp bản xuất; khóa kỳ có hiệu lực | Kiểm thử controller thật, Mongo replica set tạm và nghiệm thu bộ dữ liệu mẫu |

Ngưỡng Web Vitals lấy theo [hướng dẫn chính thức](https://web.dev/articles/vitals). Fixture cơ bản: 50 người, 12 tháng, khoảng 18.000 bản ghi công; fixture mở rộng: 250 người, khoảng 91.000 bản ghi để tìm giới hạn, không phải dự báo quy mô sẽ tăng ngay. Mỗi kịch bản đo tự động đủ lượt sau warm-up, đề xuất tối thiểu 100 mẫu cho p95; đo cold-start riêng. Dữ liệu kiểm thử là dữ liệu giả, không sao chép thông tin nhân sự thật vào log/báo cáo đo.

**8. Kiểm thử, migration và vận hành**

- Giữ bộ test backend hiện tại, chuẩn hóa reporter để đếm cả những suite dùng bộ đếm riêng. Ưu tiên test gọi mã thật; không tăng số test bằng cách sao chép thuật toán ứng dụng vào test.
- Thêm test hook/component cho query, auth, form và lỗi mạng; browser test đăng nhập, đổi tài khoản, tạo/duyệt/hoàn tác đơn, bảng công, export, quyền PM, mobile. Kiểm tra GPS/camera bằng giả lập có kiểm soát và thiết bị thật.
- Dùng Mongo replica set tạm cho transaction, unique index và cạnh tranh đồng thời; môi trường test phải từ chối URI production và không lấy bí mật production. Email/upload dùng dịch vụ giả hoặc nơi lưu riêng.
- CI hiện tại được mở rộng với các lớp kiểm thử trên, báo cáo lỗi và ngân sách hiệu năng có thể tái lập. Đồng bộ tài liệu chạy dự án, tên biến môi trường và số liệu test sinh từ reporter.
- Bổ sung request ID, log có cấu trúc, thời gian API, lỗi frontend, readiness và shutdown an toàn. Không ghi token, mật khẩu, selfie hoặc nội dung nhạy cảm của đơn vào log vận hành.
- Có staging với DB, nơi lưu ảnh và email riêng. Ghi rõ phiên bản frontend/backend, smoke test sau deploy, cấu hình và người nghiệm thu.
- Migration phải có xem trước, khả năng chạy lại an toàn, checkpoint khi cần, đối chiếu số lượng/tổng công-phép trước sau. Triển khai schema bổ sung trước, chuyển dữ liệu sau; giữ khả năng đọc tương thích trong thời gian phát hành.
- Kiểm tra backup thực tế của nhà cung cấp và diễn tập restore vào DB cách ly trước thay đổi dữ liệu. Chốt RPO (mức dữ liệu có thể mất) và RTO (thời gian phục hồi) theo nhu cầu công ty và gói hosting; không cam kết khi chưa thử khôi phục.
- Có hướng quay về bản ứng dụng trước và hướng xử lý migration tương ứng. Quay lại mã cũ không tự khôi phục dữ liệu đã thay đổi. Mọi đợt đụng dữ liệu công/phép cần đối chiếu trước khi mở cho toàn bộ người dùng.

**9. Các phần việc đầu tiên có thể giao triển khai ngay**

| Thứ tự | Phạm vi thay đổi nhỏ | Bằng chứng nghiệm thu |
|---|---|---|
| 1 | Mốc test/build và fixture, sửa khởi động không ghi đè lịch làm việc | Lịch 5 ngày giữ nguyên sau khởi động; initializer chạy lại không tạo trùng |
| 2 | Kiểm tra khóa/quyền dùng chung cho correction và ca cảnh báo; transaction cho correction | Tháng khóa chặn sửa/xóa/hoàn tác theo chính sách; lỗi cập nhật công không để đơn ở trạng thái duyệt sai |
| 3 | Khoảng ngày hợp lệ, lọc giao nhau, tính phép theo kỳ và báo cáo ngày nghỉ | Đơn qua tháng/năm được đếm và phân bổ đúng; số đơn khác số ngày nghỉ; kiểm thử cuối tuần/lễ theo chính sách đã chốt |
| 4 | Chống duyệt kép, hoàn tác có phát hiện xung đột | Hai lần duyệt đồng thời chỉ tác động một lần; duyệt A → sửa B → hoàn tác A không mất B |
| 5 | Thí điểm query chung ở Requests và sửa race ở History/Expenses | Đổi bộ lọc nhanh, đổi tài khoản, unmount giữa lúc tải đều cho kết quả đúng; không còn hai cache cho phần đã chuyển |
| 6 | Giảm payload/query ở các API còn nặng và bổ sung phép đo | So sánh số request, bytes và p50/p95 trước/sau bằng cùng fixture; không thay đổi kết quả hoặc phạm vi quyền |

Mỗi phần việc phải có kết quả review được, kiểm thử đúng rủi ro và phạm vi phát hành rõ. Lịch triển khai được cập nhật từ kết quả thực tế của các phần đầu tiên.

**10. Những quyết định cần chốt trong quá trình triển khai**

| Quyết định | Tình trạng hiện tại | Cách xử lý |
|---|---|---|
| Ai được xem bảng công toàn công ty? | Tài liệu mô tả quyền admin; một route bảng công hiện cho mọi tài khoản đăng nhập xem | Đối chiếu ý đồ sản phẩm trước khi thay quyền; ghi lại ma trận được chấp nhận và kiểm thử API/UI. Không tự mở rộng quyền |
| Leader duyệt sửa công tới mức nào? | Có luồng duyệt correction ghi giờ; tài liệu giới hạn sửa giờ trực tiếp cho admin | Chốt khác biệt giữa phê duyệt đề nghị và chỉnh giờ trực tiếp; cả hai phải tuân thủ khóa kỳ và phạm vi nhân viên |
| Cách trừ phép, ngày lễ, cuối tuần, nửa ngày, chuyển năm | Công thức hiện có chưa nhất quán giữa một số luồng | Lấy ví dụ đã được công ty xác nhận làm chuẩn; lưu chính sách có hiệu lực, không suy đoán quy định lao động |
| Hạ tầng staging, ảnh, backup, cold-start | Chưa kiểm kê cấu hình/gói đang dùng | Ưu tiên khả năng sẵn có; trình lựa chọn và chi phí cụ thể trước khi mua hoặc đổi gói |
| Mức làm mới giao diện | Người dùng đã ưu tiên tốc độ/hiệu suất; chưa yêu cầu đổi nhận diện | Giữ nhận diện, nâng tính dễ dùng và nhất quán; không để việc làm lại hình thức cản sửa lỗi nghiệp vụ |

Những điểm chưa chốt không cản việc bắt đầu baseline, sửa seed, bảo vệ khóa, chống request cũ và đo hiệu năng. Các thay đổi ảnh hưởng cách tính công/phép hoặc quyền truy cập phải dựa trên quyết định nghiệp vụ được xác nhận.
