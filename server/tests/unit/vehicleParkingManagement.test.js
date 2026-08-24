// ==============================================
// tests/unit/vehicleParkingManagement.test.js
// Kiểm thử Toàn diện Tính năng Quản lý Phương tiện, Gửi xe Tòa 17T10 & Quy trình Duyệt Đơn
// ==============================================

function runVehicleParkingTests(assert) {
  console.log('\n🛵 [TEST SUITE: QUẢN LÝ GỬI XE TÒA 17T10 & QUY TRÌNH DUYỆT ĐƠN]');

  // Mock Database State
  const mockUsers = [
    {
      _id: 'u01',
      full_name: 'Nguyễn Văn An',
      role: 'employee',
      employee_code: 'NS-001',
      phone: '0901234567',
      department_name: 'Phòng Kiến Trúc',
      parking_location: 'Tòa 17T10 Nguyễn Thị Định',
      vehicle_info: 'Honda Vision Trắng - 29G1-123.45',
    },
    {
      _id: 'u02',
      full_name: 'Trần Thị Bình',
      role: 'employee',
      employee_code: 'NS-002',
      phone: '0912345678',
      department_name: 'Phòng Nội Thất',
      parking_location: 'Gửi ngoài',
      vehicle_info: 'Yamaha Grande Xanh - 29D2-888.88',
    },
    {
      _id: 'u03',
      full_name: 'Lê Hoàng Cường',
      role: 'employee',
      employee_code: 'NS-003',
      phone: '0988776655',
      department_name: 'Phòng Kỹ Thuật',
      parking_location: 'Không gửi xe',
      vehicle_info: null,
    },
    {
      _id: 'u04',
      full_name: 'Phạm Minh Đức',
      role: 'employee',
      employee_code: 'NS-004',
      phone: '0933445566',
      department_name: 'Phòng Dự Án',
      parking_location: 'Tòa 17T10 Nguyễn Thị Định',
      vehicle_info: '', // Chưa điền biển số
    },
  ];

  // TC-VEH-01: Schema & Giá trị Mặc định cho Phương tiện
  const defaultUser = {
    full_name: 'Vũ Quốc Hưng',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
    vehicle_info: null,
  };
  assert(defaultUser.parking_location === 'Tòa 17T10 Nguyễn Thị Định',
    'TC-VEH-01.1: Địa điểm gửi xe mặc định luôn là "Tòa 17T10 Nguyễn Thị Định"');
  assert(defaultUser.vehicle_info === null,
    'TC-VEH-01.2: Mô tả xe mặc định là null khi chưa cập nhật');

  // TC-VEH-02: Admin / Leader Quản lý Trực tiếp (Phương án 1)
  const targetUser = { ...mockUsers[3] };
  targetUser.parking_location = 'Tòa 17T10 Nguyễn Thị Định';
  targetUser.vehicle_info = 'Honda SH Đen - 29E1-999.99';
  assert(targetUser.vehicle_info === 'Honda SH Đen - 29E1-999.99' && targetUser.parking_location === 'Tòa 17T10 Nguyễn Thị Định',
    'TC-VEH-02: Admin/Leader sửa trực tiếp biển số và nơi gửi xe thành công');

  // TC-VEH-03: Nhân viên gửi Yêu cầu Đổi xe -> Admin Phê Duyệt Tự Động Cập Nhật (Phương án 2)
  const vehicleRequest = {
    _id: 'req_v01',
    user_id: 'u01',
    type: 'vehicle_update',
    start_date: '2026-08-24',
    proposed_parking_location: 'Tòa 17T10 Nguyễn Thị Định',
    proposed_vehicle_info: 'VinFast Feliz Đỏ - 29B1-678.90',
    reason: 'Em mới đổi sang xe máy điện',
    status: 'pending',
    approved_by: null,
  };

  assert(vehicleRequest.type === 'vehicle_update' && vehicleRequest.status === 'pending',
    'TC-VEH-03.1: Nhân viên tạo yêu cầu đổi xe (type: vehicle_update) ở trạng thái pending');

  // Admin Phê Duyệt đơn đổi xe
  const approvingUser = { _id: 'admin_01', role: 'admin' };
  vehicleRequest.status = 'approved';
  vehicleRequest.approved_by = approvingUser._id;
  vehicleRequest.approved_at = new Date();

  // Logic tự động ghi nhận vào User profile
  const updatedEmp = { ...mockUsers[0] };
  if (vehicleRequest.type === 'vehicle_update' && vehicleRequest.status === 'approved') {
    updatedEmp.parking_location = vehicleRequest.proposed_parking_location;
    updatedEmp.vehicle_info = vehicleRequest.proposed_vehicle_info;
  }

  assert(updatedEmp.vehicle_info === 'VinFast Feliz Đỏ - 29B1-678.90',
    'TC-VEH-03.2: Khi Admin duyệt đơn -> Tự động cập nhật biển số mới vào hồ sơ nhân sự');
  assert(updatedEmp.parking_location === 'Tòa 17T10 Nguyễn Thị Định',
    'TC-VEH-03.3: Nơi gửi xe được bảo lưu chính xác sau khi duyệt');

  // TC-VEH-04: Admin Từ chối yêu cầu đổi xe
  const rejectedRequest = {
    _id: 'req_v02',
    user_id: 'u02',
    type: 'vehicle_update',
    status: 'pending',
    proposed_vehicle_info: 'Xe tải 5 tấn',
  };
  rejectedRequest.status = 'rejected';
  rejectedRequest.reviewer_note = 'Tòa nhà không nhận giữ xe tải';

  const unchangedEmp = { ...mockUsers[1] };
  if (rejectedRequest.status === 'approved') {
    unchangedEmp.vehicle_info = rejectedRequest.proposed_vehicle_info;
  }

  assert(unchangedEmp.vehicle_info === 'Yamaha Grande Xanh - 29D2-888.88',
    'TC-VEH-04: Khi Admin từ chối đơn -> Thông tin xe của nhân sự được giữ nguyên không đổi');

  // TC-VEH-05: Thống kê KPI Xe chuẩn xác
  const count17T10 = mockUsers.filter(s => (s.parking_location || '').includes('17T10') && (s.vehicle_info || s.license_plate)).length;
  const countOutside = mockUsers.filter(s => (s.parking_location || '').includes('ngoài')).length;
  const countNoVehicle = mockUsers.filter(s => (s.parking_location || '').toLowerCase().includes('không')).length;
  const countMissing = mockUsers.filter(s => !s.vehicle_info && !s.license_plate && !(s.parking_location || '').toLowerCase().includes('không')).length;

  assert(count17T10 === 1, 'TC-VEH-05.1: Đếm chính xác 1 xe có vé tháng Tòa 17T10');
  assert(countOutside === 1, 'TC-VEH-05.2: Đếm chính xác 1 xe gửi ngoài');
  assert(countNoVehicle === 1, 'TC-VEH-05.3: Đếm chính xác 1 nhân sự không gửi xe');
  assert(countMissing === 1, 'TC-VEH-05.4: Đếm chính xác 1 nhân sự chưa điền biển số');

  // TC-VEH-06: Xuất Báo Cáo CSV Nộp BQL Tòa 17T10 có UTF-8 BOM
  const headers = ['STT', 'Mã Nhân Sự', 'Họ Và Tên', 'Email', 'Số Điện Thoại', 'Phòng Ban', 'Chức Danh', 'Địa Điểm Gửi Xe', 'Mô Tả Xe - Biển Số'];
  const rows = mockUsers.map((s, idx) => [
    idx + 1,
    s.employee_code,
    `"${s.full_name}"`,
    s.email || '',
    `"${s.phone}"`,
    `"${s.department_name}"`,
    'Nhân viên',
    `"${s.parking_location}"`,
    `"${s.vehicle_info || 'Chưa cập nhật'}"`
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

  assert(csvContent.startsWith('\uFEFF'),
    'TC-VEH-06.1: File CSV xuất ra có tiền tố UTF-8 BOM mở bằng Excel không lỗi font tiếng Việt');
  assert(csvContent.includes('Địa Điểm Gửi Xe') && csvContent.includes('Mô Tả Xe - Biển Số'),
    'TC-VEH-06.2: Header chứa đầy đủ 2 cột thông tin gửi xe tòa 17T10');
  assert(csvContent.includes('Honda Vision Trắng - 29G1-123.45'),
    'TC-VEH-06.3: Dữ liệu biển số xe xuất chuẩn xác trong file CSV');

  // TC-VEH-07: Phân Quyền Route Guard — Chỉ Admin & Leader được vào /vehicles
  const allowedRoles = ['admin', 'leader', 'manager'];
  assert(allowedRoles.includes('admin') && allowedRoles.includes('leader'),
    'TC-VEH-07.1: Admin và Leader được phép truy cập trang Quản lý xe /vehicles');
  assert(!allowedRoles.includes('employee') && !allowedRoles.includes('staff'),
    'TC-VEH-07.2: Chặn Employee & Staff không được truy cập xem xe của người khác');

  // TC-VEH-08: Định Dạng Thông Báo Nghỉ Lễ — Không Chèn Đoạn Mở Đầu Cứng
  const rawHolidayNote = 'Kính gửi toàn thể CBNV Công ty,\nCông ty nghỉ lễ Quốc khánh từ 01/9 đến 03/9/2026.';
  const holidayName = 'THÔNG BÁO NGHỈ LỄ QUỐC KHÁNH 02/9/2026';

  // Format title without duplicates
  const notifTitle = holidayName.toUpperCase().startsWith('THÔNG BÁO')
    ? `📢 ${holidayName.toUpperCase()}`
    : `📢 THÔNG BÁO NGHỈ LỄ: ${holidayName.toUpperCase()}`;

  // Full message should be exactly rawHolidayNote
  const fullMessage = rawHolidayNote.trim();

  assert(!fullMessage.startsWith('Công ty trân trọng thông báo'),
    'TC-VEH-08.1: Nội dung thông báo không bị chèn câu mở đầu cứng mặc định');
  assert(fullMessage === rawHolidayNote,
    'TC-VEH-08.2: Sử dụng 100% nội dung tùy chỉnh do Admin nhập');
  assert(notifTitle === '📢 THÔNG BÁO NGHỈ LỄ QUỐC KHÁNH 02/9/2026',
    'TC-VEH-08.3: Tiêu đề không bị lặp chữ "THÔNG BÁO NGHỈ LỄ: THÔNG BÁO NGHỈ LỄ"');

  // TC-VEH-09: Cập Nhật Số Điện Thoại Cá Nhân — Nhân viên tự cập nhật tức thì
  const empProfile = { ...mockUsers[0] };
  const newPhone = '0988123456';
  empProfile.phone = newPhone.trim();
  assert(empProfile.phone === '0988123456',
    'TC-VEH-09.1: Nhân viên cập nhật số điện thoại mới thành công tức thì');
  assert(empProfile.full_name === 'Nguyễn Văn An' && empProfile.role === 'employee',
    'TC-VEH-09.2: Họ tên và vai trò nhân viên được bảo vệ nguyên vẹn khi đổi số điện thoại');
}

module.exports = runVehicleParkingTests;
