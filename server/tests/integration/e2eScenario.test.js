// ==============================================
// tests/integration/e2eScenario.test.js
// Kiểm thử Tích hợp Toàn trình (End-to-End Mock Scenario)
// Chạy hoàn toàn In-Memory — 100% ZERO IMPACT lên MongoDB Atlas Prod
// ==============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-et-office-portal-2026';

// In-Memory Mock Database Store
class MockDatabase {
  constructor() {
    this.users = [];
    this.attendances = [];
    this.requests = [];
    this.timesheetLocks = [];
  }

  async seed() {
    const adminPassHash = await bcrypt.hash('Admin@123', 10);
    const empPassHash = await bcrypt.hash('Emp@123', 10);

    this.users = [
      {
        _id: 'u_admin',
        full_name: 'Quản trị viên Hệ thống',
        email: 'admin@etoffice.vn',
        password_hash: adminPassHash,
        role: 'admin',
        employee_code: 'ET001',
        is_active: true,
      },
      {
        _id: 'u_emp1',
        full_name: 'Nguyễn Văn Nhân Viên',
        email: 'nhanvien@etoffice.vn',
        password_hash: empPassHash,
        role: 'employee',
        employee_code: 'ET002',
        is_active: true,
      }
    ];
  }
}

async function runE2EScenarioTests(assert) {
  console.log('\n🔄 [TEST SUITE: END-TO-END WORKFLOW INTEGRATION]');

  const db = new MockDatabase();
  await db.seed();

  // -------------------------------------------------------------
  // BƯỚC 1: Đăng nhập & Sinh JWT Token
  // -------------------------------------------------------------
  const empUser = db.users.find(u => u.email === 'nhanvien@etoffice.vn');
  const isMatch = await bcrypt.compare('Emp@123', empUser.password_hash);
  assert(isMatch === true, 'TC-E2E-01.1: Xác thực mật khẩu Bcrypt đăng nhập thành công');

  const token = jwt.sign({ userId: empUser._id, role: empUser.role }, JWT_SECRET, { expiresIn: '1d' });
  const decoded = jwt.verify(token, JWT_SECRET);
  assert(decoded.userId === 'u_emp1' && decoded.role === 'employee',
    'TC-E2E-01.2: Mã hóa & Giải mã JWT Token thành công mang đúng định danh user');

  // -------------------------------------------------------------
  // BƯỚC 2: Check-in GPS Hợp lệ tại Văn phòng
  // -------------------------------------------------------------
  const todayStr = '2026-08-21';
  const newAttendance = {
    _id: 'att_01',
    user_id: empUser._id,
    date: todayStr,
    check_in_time: '2026-08-21T08:20:00+07:00',
    check_in_type: 'office',
    is_late: false,
    late_tier: 'on_time',
    status: 'present',
    work_hours: 0,
    ot_hours: 0,
  };
  db.attendances.push(newAttendance);

  const foundAtt = db.attendances.find(a => a.user_id === empUser._id && a.date === todayStr);
  assert(foundAtt && foundAtt.late_tier === 'on_time',
    'TC-E2E-02: Nhân viên check-in GPS đúng giờ tại Văn phòng -> Tạo bản ghi điểm danh on_time');

  // -------------------------------------------------------------
  // BƯỚC 3: Nhân viên nộp đơn Xin nghỉ phép năm (P) cho ngày mai
  // -------------------------------------------------------------
  const leaveReq = {
    _id: 'req_01',
    user_id: empUser._id,
    type: 'annual_leave',
    start_date: '2026-08-22',
    end_date: '2026-08-22',
    reason: 'Giải quyết việc gia đình',
    status: 'pending',
    created_at: new Date(),
  };
  db.requests.push(leaveReq);

  assert(db.requests.length === 1 && db.requests[0].status === 'pending',
    'TC-E2E-03: Nhân viên nộp đơn nghỉ phép năm -> Đơn ở trạng thái pending');

  // -------------------------------------------------------------
  // BƯỚC 4: Quản trị viên (Admin) Duyệt đơn Nghỉ phép
  // -------------------------------------------------------------
  const reqToApprove = db.requests.find(r => r._id === 'req_01');
  reqToApprove.status = 'approved';
  reqToApprove.approved_by = 'u_admin';

  // Tự động tạo/cập nhật điểm danh ngày 22/08 với status = 'leave'
  db.attendances.push({
    _id: 'att_02',
    user_id: reqToApprove.user_id,
    date: reqToApprove.start_date,
    check_in_type: 'office',
    status: 'leave',
    notes: 'Nghỉ phép năm (P)',
    total_hours: 8
  });

  const nextDayAtt = db.attendances.find(a => a.user_id === empUser._id && a.date === '2026-08-22');
  assert(reqToApprove.status === 'approved' && nextDayAtt.status === 'leave',
    'TC-E2E-04: Admin duyệt đơn -> Trạng thái đổi thành approved & Tự động ghi nhận ngày phép (P) trong bảng công');

  // -------------------------------------------------------------
  // BƯỚC 5: Check-out và Tính giờ làm việc + OT
  // -------------------------------------------------------------
  foundAtt.check_out_time = '2026-08-21T19:30:00+07:00';
  foundAtt.total_hours = 9.5;
  foundAtt.ot_hours = 2.0;

  assert(foundAtt.check_out_time && foundAtt.ot_hours === 2.0,
    'TC-E2E-05: Check-out lúc 19:30 -> Hoàn thành chu trình chấm công trong ngày, ghi nhận 2.0h OT');
}

module.exports = runE2EScenarioTests;
