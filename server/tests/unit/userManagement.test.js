// ==============================================
// tests/unit/userManagement.test.js
// Kiểm thử Nghiệp vụ Quản lý Nhân sự, Multi-Department & Phân cấp Dữ liệu
// ==============================================

function getLeaderManagedUserFilter(leaderUser) {
  const leaderDeptIds = leaderUser.department_ids && leaderUser.department_ids.length > 0
    ? leaderUser.department_ids
    : (leaderUser.department_id ? [leaderUser.department_id] : []);

  return {
    $or: [
      { _id: leaderUser._id },
      { department_ids: { $in: leaderDeptIds } },
      { department_id: { $in: leaderDeptIds } }
    ]
  };
}

function filterUsersForLeader(allUsers, leaderUser) {
  const leaderDeptIds = leaderUser.department_ids && leaderUser.department_ids.length > 0
    ? leaderUser.department_ids
    : (leaderUser.department_id ? [leaderUser.department_id] : []);

  return allUsers.filter(u => {
    if (u._id === leaderUser._id) return true;
    const userDepts = u.department_ids || (u.department_id ? [u.department_id] : []);
    return userDepts.some(d => leaderDeptIds.includes(d));
  });
}

function validateUserCreation(creatorRole, newUserPayload) {
  const { email, full_name, password, role, department_ids, department_id } = newUserPayload;

  if (!email || !full_name || !password) {
    return { valid: false, error: 'Email, họ tên và mật khẩu là bắt buộc.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải ít nhất 6 ký tự.' };
  }
  if (role === 'admin' && creatorRole !== 'admin') {
    return { valid: false, error: 'Chỉ Admin mới có quyền tạo tài khoản Admin.' };
  }

  const deptIds = Array.isArray(department_ids) && department_ids.length > 0
    ? department_ids
    : (department_id ? [department_id] : []);

  if (['leader', 'manager'].includes(role) && deptIds.length === 0) {
    return { valid: false, error: 'Khi chọn vai trò Leader, bắt buộc phải chọn phòng ban quản lý.' };
  }

  return { valid: true, deptIds };
}

function runUserManagementTests(assert) {
  console.log('\n👥 [TEST SUITE: USER & MULTI-DEPARTMENT MANAGEMENT]');

  const mockUsers = [
    { _id: 'u_admin', full_name: 'Admin Tổng', role: 'admin', department_ids: [] },
    { _id: 'u_lead_it', full_name: 'Trưởng Phòng IT', role: 'leader', department_ids: ['dept_it'] },
    { _id: 'u_emp_it', full_name: 'Dev IT 1', role: 'employee', department_ids: ['dept_it'] },
    { _id: 'u_emp_sale', full_name: 'Kinh Doanh 1', role: 'employee', department_ids: ['dept_sale'] },
    { _id: 'u_emp_both', full_name: 'Chuyên viên IT & Sale', role: 'employee', department_ids: ['dept_it', 'dept_sale'] },
  ];

  // TC-USER-01: Lọc danh sách nhân viên theo phòng ban của Leader
  const itLeader = mockUsers[1];
  const itTeam = filterUsersForLeader(mockUsers, itLeader);
  assert(itTeam.length === 3, 'TC-USER-01.1: Leader IT chỉ thấy chính mình + 2 nhân viên có thuộc phòng IT');
  assert(!itTeam.some(u => u._id === 'u_emp_sale'), 'TC-USER-01.2: Leader IT không thấy nhân viên phòng Sale độc lập');

  // TC-USER-02: Multi-department - Nhân viên thuộc nhiều phòng ban
  const multiDeptEmp = mockUsers.find(u => u._id === 'u_emp_both');
  assert(multiDeptEmp.department_ids.length === 2 && multiDeptEmp.department_ids.includes('dept_it') && multiDeptEmp.department_ids.includes('dept_sale'),
    'TC-USER-02: Nhân viên hỗ trợ đa phòng ban (department_ids là array nhiều phần tử)');

  // TC-USER-03: Bảo mật tạo tài khoản - Leader không được tạo tài khoản Admin
  const tryCreateAdmin = validateUserCreation('leader', {
    email: 'admin2@et.vn', full_name: 'Admin 2', password: 'password123', role: 'admin'
  });
  assert(tryCreateAdmin.valid === false && tryCreateAdmin.error.includes('Chỉ Admin'),
    'TC-USER-03: Chặn Leader tạo tài khoản vai trò Admin');

  // TC-USER-04: Leader bắt buộc phải gán ít nhất 1 phòng ban quản lý
  const tryCreateLeaderNoDept = validateUserCreation('admin', {
    email: 'lead2@et.vn', full_name: 'Lead 2', password: 'password123', role: 'leader', department_ids: []
  });
  assert(tryCreateLeaderNoDept.valid === false && tryCreateLeaderNoDept.error.includes('phòng ban'),
    'TC-USER-04: Bắt buộc chọn phòng ban khi tạo tài khoản Leader');

  // TC-USER-05: Kiểm tra độ dài tối thiểu mật khẩu
  const tryShortPass = validateUserCreation('admin', {
    email: 'emp@et.vn', full_name: 'Emp', password: '123', role: 'employee', department_ids: ['dept_it']
  });
  assert(tryShortPass.valid === false && tryShortPass.error.includes('ít nhất 6 ký tự'),
    'TC-USER-05: Chặn mật khẩu dưới 6 ký tự');

  // TC-USER-06: Strict Whitelist DTO cho Employee gọi danh bạ
  function sanitizeUserForDirectory(user, callerRole) {
    if (['admin', 'leader', 'manager'].includes(callerRole)) {
      return { ...user };
    }
    const whitelist = ['_id', 'employee_code', 'full_name', 'position', 'email', 'phone', 'department_id', 'department_ids', 'avatar_url', 'is_active', 'employment_status'];
    const sanitized = {};
    for (const key of whitelist) {
      if (user[key] !== undefined) sanitized[key] = user[key];
    }
    return sanitized;
  }

  const mockFullUser = {
    _id: 'u_101',
    employee_code: 'NS-001',
    full_name: 'Nguyễn Văn A',
    position: 'Kiến trúc sư',
    email: 'nva@company.com',
    phone: '0912345678',
    avatar_url: 'https://img.png',
    dob: '1995-05-15',
    cccd: '001234567890',
    bank_account: '190012345678',
    bhxh_code: 'BH123456',
    parking_location: 'Tòa 17T10',
    vehicle_info: 'Honda SH 29X1-123.45',
    license_plate: '29X1-123.45'
  };

  const empView = sanitizeUserForDirectory(mockFullUser, 'employee');
  assert(empView.full_name === 'Nguyễn Văn A' && empView.employee_code === 'NS-001', 'TC-USER-06.1: Employee nhận được thông tin danh bạ cơ bản');
  assert(empView.dob === undefined && empView.cccd === undefined && empView.bank_account === undefined && empView.bhxh_code === undefined, 'TC-USER-06.2: Employee bị ẩn hoàn toàn ngày sinh, CCCD, Ngân hàng, BHXH');
  assert(empView.parking_location === undefined && empView.vehicle_info === undefined, 'TC-USER-06.3: Employee không nhận thông tin xe riêng tư của nhân viên khác');

  // TC-USER-07: Sửa thông tin cá nhân & Quyền sửa xe
  function processProfileUpdate(user, updatePayload, callerRole) {
    const updateData = {};
    if (updatePayload.full_name !== undefined) updateData.full_name = updatePayload.full_name;
    if (updatePayload.phone !== undefined) updateData.phone = updatePayload.phone;
    if (callerRole === 'admin') {
      if (updatePayload.parking_location !== undefined) updateData.parking_location = updatePayload.parking_location;
      if (updatePayload.vehicle_info !== undefined) updateData.vehicle_info = updatePayload.vehicle_info;
    }
    return { ...user, ...updateData };
  }

  // Leader tự sửa tên và SĐT
  const leaderUpdated = processProfileUpdate({ full_name: 'Leader Cũ', phone: '0901' }, { full_name: 'Leader Mới', phone: '0902' }, 'leader');
  assert(leaderUpdated.full_name === 'Leader Mới' && leaderUpdated.phone === '0902', 'TC-USER-07.1: Leader cập nhật họ tên và số điện thoại thành công');

  // Leader cố tình gửi payload sửa xe -> không được cập nhật
  const leaderTryChangeVehicle = processProfileUpdate({ parking_location: '17T10' }, { parking_location: 'Gửi ngoài' }, 'leader');
  assert(leaderTryChangeVehicle.parking_location === '17T10', 'TC-USER-07.2: Chặn Leader sửa trực tiếp thông tin gửi xe (chỉ Admin mới có quyền)');
}

module.exports = runUserManagementTests;
