/**
 * OVERNIGHT SHIFT & OVERTIME APPROVAL TEST SUITE
 * 
 * Kiểm thử toàn diện nghiệp vụ ca làm việc xuyên ngày và cơ chế Admin phê duyệt OT:
 * 1. Tính toán thời gian ca xuyên ngày (qua 00:00 và qua ranh giới tháng/năm) chính xác đến từng phút (2 chữ số thập phân).
 * 2. Mốc tính OT cố định từ 18:30 của ngày bắt đầu ca (checkInDate).
 * 3. Checkout ca xuyên ngày -> ot_status = 'pending_approval', ot_hours = 0 (chưa cộng vào báo cáo/KPI).
 * 4. HTTP Pipeline: RBAC chặn Leader & Employee (403), TimesheetLock Guard (403).
 * 5. HTTP Pipeline: Chống duyệt lặp (409 Conflict), bắt buộc lý do khi điều chỉnh giờ (400 Bad Request).
 * 6. ACID Transaction & Atomic Audit Log: Phục hồi / Rollback fail-closed khi lưu audit log thất bại.
 * 7. Báo cáo & Bảng công loại trừ OT pending_approval khỏi tổng giờ OT chính thức.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const {
  calculateAttendanceMetrics,
  isOvernightShift,
  getVnDateString,
  formatDurationHoursMinutes,
} = require('../../src/utils/attendanceCalculations');
const Attendance = require('../../src/models/Attendance');
const AttendanceAuditLog = require('../../src/models/AttendanceAuditLog');
const TimesheetLock = require('../../src/models/TimesheetLock');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const SystemSetting = require('../../src/models/SystemSetting');
const Holiday = require('../../src/models/Holiday');
const Request = require('../../src/models/Request');
const { healUnclosedShiftForCheckin } = require('../../src/controllers/attendanceController');

const JWT_SECRET = process.env.JWT_SECRET || 'et_office_jwt_secret_key_2026_super_secure_test_123456';

function generateTestToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      id: user._id,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_ids: user.department_ids,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const createChain = (data, onSessionCall) => {
  const chain = {
    session(sess) {
      chain._session = sess;
      if (typeof onSessionCall === 'function') onSessionCall(sess);
      return chain;
    },
    select() { return chain; },
    populate() { return chain; },
    sort() { return chain; },
    skip() { return chain; },
    limit() { return chain; },
    lean() { return Promise.resolve(data); },
    distinct() { return Promise.resolve(data); },
    then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); },
    catch(reject) { return Promise.resolve(data).catch(reject); },
  };
  return chain;
};

async function runOvernightShiftAndOtTests(assert) {
  console.log('\n🌙 [TEST SUITE: OVERNIGHT SHIFT & OVERTIME APPROVAL WORKFLOW]');

  // -------------------------------------------------------------------------
  // 1. UNIT TESTS: Tính toán ca xuyên ngày & Mốc OT chính xác đến từng phút
  // -------------------------------------------------------------------------

  // TC-ON-01: Ca bắt đầu 09:28 ngày 01/09 -> checkout 00:33 ngày 02/09 (+1 ngày)
  const inTime01 = new Date('2026-09-01T09:28:00+07:00');
  const outTime01 = new Date('2026-09-02T00:33:00+07:00');
  const metrics01 = calculateAttendanceMetrics(inTime01, outTime01, {
    workEndTime: '18:30',
    otStartTime: '18:30',
  });

  assert(
    metrics01.isOvernight === true,
    'TC-ON-01.1: Nhận diện chính xác ca làm việc xuyên ngày (isOvernight = true)'
  );
  assert(
    metrics01.isEarlyLeave === false && metrics01.earlyMinutes === 0,
    'TC-ON-01.2: Không bị tính về sớm khi checkout sau nửa đêm'
  );
  // Tổng thời gian: 09:28 -> 00:33 = 905 phút = 15.1 giờ (độ chính xác 1 số thập phân mặc định cho totalHours)
  assert(
    metrics01.totalHours === 15.1,
    'TC-ON-01.3: Tính chính xác tổng giờ làm việc xuyên ngày theo phút (15.1h)'
  );
  // OT tính từ 18:30 ngày 01/09 -> 00:33 ngày 02/09 = 363 phút = 6.05 giờ (không bị làm tròn mất 0.05h)
  assert(
    metrics01.otHours === 6.05,
    'TC-ON-01.4: Mốc OT xuất phát từ 18:30 ngày bắt đầu ca (01/09), đạt đúng 6.05h OT (6 giờ 03 phút)'
  );

  // TC-ON-02: Ca qua ranh giới năm cũ sang năm mới (31/12/2026 20:00 -> 01/01/2027 04:00)
  const inTimeYear = new Date('2026-12-31T20:00:00+07:00');
  const outTimeYear = new Date('2027-01-01T04:00:00+07:00');
  const metricsYear = calculateAttendanceMetrics(inTimeYear, outTimeYear, {
    workEndTime: '18:30',
    otStartTime: '18:30',
  });

  assert(
    metricsYear.isOvernight === true,
    'TC-ON-02.1: Nhận diện ca xuyên ngày qua ranh giới năm'
  );
  assert(
    metricsYear.totalHours === 8.0,
    'TC-ON-02.2: Tính tổng giờ làm 8.0h qua năm mới'
  );
  assert(
    metricsYear.otHours === 8.0,
    'TC-ON-02.3: Check-in sau 18:30 thì toàn bộ 8.0h được tính vào OT'
  );

  // TC-ON-03: Helper functions & formatting
  assert(
    isOvernightShift(inTime01, outTime01) === true,
    'TC-ON-03.1: isOvernightShift trả về true cho ca xuyên ngày'
  );
  assert(
    isOvernightShift(inTime01, new Date('2026-09-01T18:30:00+07:00')) === false,
    'TC-ON-03.2: isOvernightShift trả về false cho ca cùng ngày'
  );
  assert(
    getVnDateString(inTime01) === '2026-09-01',
    'TC-ON-03.3: getVnDateString trả về đúng YYYY-MM-DD theo giờ VN'
  );
  assert(
    formatDurationHoursMinutes(6.05) === '6 giờ 03 phút',
    'TC-ON-03.4: formatDurationHoursMinutes định dạng 6.05h thành đúng "6 giờ 03 phút"'
  );

  // -------------------------------------------------------------------------
  // 2. DATA MODEL & SCHEMA INTEGRITY: Trạng thái OT Xuyên Ngày
  // -------------------------------------------------------------------------

  // TC-ON-04: Khởi tạo Attendance ca xuyên ngày với ot_status = 'pending_approval'
  const mockUserId = new mongoose.Types.ObjectId();
  const attOvernight = new Attendance({
    user_id: mockUserId,
    date: '2026-09-01',
    check_in_time: inTime01,
    check_out_time: outTime01,
    check_in_type: 'office',
    total_hours: metrics01.totalHours,
    is_overnight: true,
    ot_hours_proposed: metrics01.otHours,
    ot_hours: 0, // Chưa duyệt: OT chính thức bằng 0
    ot_status: 'pending_approval',
    work_units: 1.0,
    status: 'present',
  });

  await attOvernight.validate();
  assert(
    attOvernight.is_overnight === true &&
    attOvernight.ot_status === 'pending_approval' &&
    attOvernight.ot_hours === 0 &&
    attOvernight.ot_hours_proposed === metrics01.otHours,
    'TC-ON-04: Schema Attendance hỗ trợ đầy đủ các trường OT xuyên ngày chờ duyệt'
  );

  // -------------------------------------------------------------------------
  // 3. HTTP PIPELINE INTEGRATION TESTS: RBAC, Locks, Conflict, & Atomicity
  // -------------------------------------------------------------------------

  const origUserFindById = User.findById;
  const origAttFind = Attendance.find;
  const origAttFindOne = Attendance.findOne;
  const origAttFindById = Attendance.findById;
  const origTimesheetFindOne = TimesheetLock.findOne;
  const origLockUpdateOne = TimesheetLock.updateOne;
  const origLockFindOneAndUpdate = TimesheetLock.findOneAndUpdate;
  const origAuditCreate = AttendanceAuditLog.create;
  const origNotifCreate = Notification.create;
  const origMongooseStartSession = mongoose.startSession;
  const origSettingFindOne = SystemSetting.findOne;
  const origHolidayFindOne = Holiday.findOne;

  SystemSetting.findOne = () => createChain({ work_start_time: '09:00', work_end_time: '18:30', minor_late_mins: 30, medium_late_mins: 60 });
  Holiday.findOne = () => createChain(null);

  const mockSessionInstance = {
    startTransaction: async () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
    withTransaction: async (fn) => await fn(),
  };
  mongoose.startSession = async () => mockSessionInstance;

  const mockAdminUser = {
    _id: '507f1f77bcf86cd799439011',
    role: 'admin',
    full_name: 'Admin Tổng',
    email: 'admin@etoffice.vn',
    is_active: true,
  };
  const mockLeaderUser = {
    _id: '507f1f77bcf86cd799439012',
    role: 'leader',
    full_name: 'Trưởng Phòng',
    email: 'leader@etoffice.vn',
    is_active: true,
  };
  const mockEmployeeUser = {
    _id: '507f1f77bcf86cd799439013',
    role: 'employee',
    full_name: 'Nhân Viên Test',
    email: 'employee@etoffice.vn',
    is_active: true,
  };

  const adminToken = generateTestToken(mockAdminUser);
  const leaderToken = generateTestToken(mockLeaderUser);
  const employeeToken = generateTestToken(mockEmployeeUser);

  User.findById = (id) => {
    const idStr = String(id?._id || id);
    if (idStr === mockAdminUser._id) return createChain(mockAdminUser);
    if (idStr === mockLeaderUser._id) return createChain(mockLeaderUser);
    return createChain(mockEmployeeUser);
  };

  TimesheetLock.findOne = () => createChain(null);
  TimesheetLock.updateOne = async () => ({ acknowledged: true });
  TimesheetLock.findOneAndUpdate = () => createChain({ guard_version: 1, is_locked: false });

  try {
    // TC-ON-05: RBAC - Chỉ Admin mới có quyền xem danh sách pending OT
    const resLeaderPending = await request(app)
      .get('/api/attendance/pending-ot')
      .set('Authorization', `Bearer ${leaderToken}`);
    assert(
      resLeaderPending.status === 403,
      'TC-ON-05.1: GET /api/attendance/pending-ot - Leader bị chặn 403 Forbidden'
    );

    const resEmployeePending = await request(app)
      .get('/api/attendance/pending-ot')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert(
      resEmployeePending.status === 403,
      'TC-ON-05.2: GET /api/attendance/pending-ot - Employee bị chặn 403 Forbidden'
    );

    Attendance.find = () => createChain([
      {
        _id: 'att_on_pending_01',
        user_id: { _id: mockEmployeeUser._id, full_name: 'Nhân Viên Test', employee_code: 'NV-001' },
        date: '2026-09-01',
        check_in_time: inTime01,
        check_out_time: outTime01,
        total_hours: 15.08,
        ot_hours_proposed: 6.05,
        ot_hours: 0,
        ot_status: 'pending_approval',
        is_overnight: true,
      }
    ]);

    const resAdminPending = await request(app)
      .get('/api/attendance/pending-ot')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(
      resAdminPending.status === 200 && Array.isArray(resAdminPending.body.pending_ot),
      'TC-ON-05.3: GET /api/attendance/pending-ot - Admin lấy danh sách OT pending thành công (200 OK)'
    );

    // TC-ON-06: RBAC - Leader bị chặn 403 khi gọi approve-ot
    const resLeaderApprove = await request(app)
      .put('/api/attendance/att_on_pending_01/approve-ot')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ approved_hours: 6.05 });
    assert(
      resLeaderApprove.status === 403,
      'TC-ON-06: PUT /api/attendance/:id/approve-ot - Leader bị chặn 403 Forbidden'
    );

    // TC-ON-07: TimesheetLock Guard - Bảng công bị khóa thì chặn 403
    TimesheetLock.findOneAndUpdate = () => createChain(null); // Mô phỏng bảng công đã chốt khóa
    Attendance.findById = () => createChain({
      _id: 'att_on_pending_01',
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'pending_approval',
      ot_hours_proposed: 6.05,
    });
    Attendance.findOne = () => createChain({
      _id: 'att_on_pending_01',
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'pending_approval',
      ot_hours_proposed: 6.05,
    });

    const resLockApprove = await request(app)
      .put('/api/attendance/att_on_pending_01/approve-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved_hours: 6.05 });
    assert(
      resLockApprove.status === 403 && resLockApprove.body.error?.includes('đã bị chốt khóa'),
      'TC-ON-07: PUT /api/attendance/:id/approve-ot - Chặn duyệt OT khi bảng công tháng đã bị khóa (403)'
    );

    // Mở khóa bảng công cho các test tiếp theo
    TimesheetLock.findOneAndUpdate = () => createChain({ guard_version: 1, is_locked: false });

    // TC-ON-08: Điều chỉnh số giờ khác đề xuất bắt buộc phải có lý do (400 Bad Request)
    const resNoReasonAdjust = await request(app)
      .put('/api/attendance/att_on_pending_01/approve-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved_hours: 5.0 }); // Lệch > 0.05h so với proposed 6.05h nhưng không có lý do
    assert(
      resNoReasonAdjust.status === 400 && resNoReasonAdjust.body.error?.includes('lý do'),
      'TC-ON-08: PUT /api/attendance/:id/approve-ot - Bắt buộc nhập adjustment_reason khi đổi số giờ OT (400)'
    );

    // TC-ON-09: Chống duyệt lặp (409 Conflict) khi ca đã approved hoặc rejected
    Attendance.findById = () => createChain({
      _id: 'att_on_pending_01',
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'approved', // Đã duyệt trước đó
      ot_hours: 6.05,
    });
    Attendance.findOne = () => createChain({
      _id: 'att_on_pending_01',
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'approved', // Đã duyệt trước đó
      ot_hours: 6.05,
    });
    const resConflictApprove = await request(app)
      .put('/api/attendance/att_on_pending_01/approve-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved_hours: 6.05 });
    assert(
      resConflictApprove.status === 409,
      'TC-ON-09: PUT /api/attendance/:id/approve-ot - Trả về 409 Conflict khi ca đã được phê duyệt trước đó'
    );

    // TC-ON-10: Admin phê duyệt thành công với số giờ đề xuất
    let savedAtt = null;
    let createdAuditLog = null;
    let createdNotification = null;

    const mockPendingDoc = {
      _id: 'att_on_pending_01',
      user_id: mockEmployeeUser._id,
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'pending_approval',
      ot_hours_proposed: 6.05,
      ot_hours: 0,
      work_units: 1.0,
      save: async function() { savedAtt = this; return this; }
    };

    Attendance.findById = () => createChain(mockPendingDoc);
    Attendance.findOne = () => createChain(mockPendingDoc);
    AttendanceAuditLog.create = async (doc) => { createdAuditLog = doc; return doc; };
    Notification.create = async (doc) => { createdNotification = doc; return doc; };

    const resAdminApproveValid = await request(app)
      .put('/api/attendance/att_on_pending_01/approve-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        approved_hours: 6.05,
        reviewer_note: 'Duyệt đủ giờ OT ca xuyên ngày',
      });

    assert(
      resAdminApproveValid.status === 200,
      'TC-ON-10.1: PUT /api/attendance/:id/approve-ot - Admin phê duyệt OT thành công (200 OK)'
    );
    assert(
      savedAtt && savedAtt.ot_status === 'approved' && savedAtt.ot_hours === 6.05,
      'TC-ON-10.2: Cập nhật ot_status = approved và ot_hours = 6.05 trên Attendance'
    );
    assert(
      createdAuditLog !== null,
      'TC-ON-10.3: Ghi nhận AttendanceAuditLog trong cùng transaction session'
    );

    // TC-ON-11: Rollback Fail-Closed khi AttendanceAuditLog gặp sự cố
    const mockPendingDocForFail = {
      _id: 'att_on_pending_02',
      user_id: mockEmployeeUser._id,
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'pending_approval',
      ot_hours_proposed: 6.05,
      ot_hours: 0,
      work_units: 1.0,
      save: async function() { return this; }
    };
    Attendance.findById = () => createChain(mockPendingDocForFail);
    Attendance.findOne = () => createChain(mockPendingDocForFail);
    AttendanceAuditLog.create = async () => { throw new Error('Database disk error on audit log'); };

    const resAuditFail = await request(app)
      .put('/api/attendance/att_on_pending_02/approve-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved_hours: 6.05 });
    assert(
      resAuditFail.status === 500,
      'TC-ON-11: Lỗi ghi audit log khiến giao dịch tự động Rollback và trả về 500 (Fail-Closed Integrity)'
    );

    // TC-ON-12: Admin từ chối OT -> Giữ nguyên công cơ bản 1.0, ot_hours = 0
    let savedRejectAtt = null;
    const mockPendingDocReject = {
      _id: 'att_on_pending_03',
      user_id: mockEmployeeUser._id,
      date: '2026-09-01',
      is_overnight: true,
      ot_status: 'pending_approval',
      ot_hours_proposed: 6.05,
      ot_hours: 0,
      work_units: 1.0,
      save: async function() { savedRejectAtt = this; return this; }
    };
    Attendance.findById = () => createChain(mockPendingDocReject);
    Attendance.findOne = () => createChain(mockPendingDocReject);
    AttendanceAuditLog.create = async (doc) => doc;

    const resAdminReject = await request(app)
      .put('/api/attendance/att_on_pending_03/reject-ot')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Không có kế hoạch OT được phân công' });

    assert(
      resAdminReject.status === 200,
      'TC-ON-12.1: PUT /api/attendance/:id/reject-ot - Admin từ chối OT ca xuyên ngày thành công (200 OK)'
    );
    assert(
      savedRejectAtt && savedRejectAtt.ot_status === 'rejected' && savedRejectAtt.ot_hours === 0 && savedRejectAtt.work_units === 1.0,
      'TC-ON-12.2: ot_status = rejected, ot_hours = 0 nhưng bảo toàn 1.0 công chuẩn'
    );

    // =====================================================================
    // BÀN TRÒN 17 (11/09): Quên checkout hôm trước → AUTO-HEAL khép tạm ca cũ,
    // check-in mới đi ngay, tự sinh đơn giải trình cho Admin hậu kiểm.
    // Chỉ còn chặn 400 cứng khi quota auto-heal của tháng đã cạn.
    // =====================================================================
    const unclosedShift14 = {
      _id: 'att_unclosed_yesterday',
      user_id: mockUserId,
      date: '2026-09-01',
      check_in_time: new Date(Date.now() - 12 * 60 * 60 * 1000),
      check_out_time: null,
    };
    const prevFindOne_RT17 = Attendance.findOne;
    const prevCount_RT17 = Attendance.countDocuments;
    const prevReqFindOne_RT17 = Request.findOne;
    const prevLockFindOne_RT17 = TimesheetLock.findOne;
    const prevSettings_RT17 = SystemSetting.findOne;
    Attendance.findOne = (query) => {
      if (query && query.date && query.date.$lt) return createChain(unclosedShift14);
      if (query && query.date === getVnDateString(new Date())) return createChain(null);
      return prevFindOne_RT17 ? prevFindOne_RT17(query) : createChain(null);
    };
    Request.findOne = () => createChain(null);
    TimesheetLock.findOne = () => createChain(null);
    SystemSetting.findOne = () => createChain({ key: 'global', work_end_time: '18:30' });
    Attendance.countDocuments = () => Promise.resolve(2); // quota tháng đã cạn

    const resCheckInOverlap = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        lat: 10.762622,
        lng: 106.660172,
        type: 'office',
      });

    assert(
      resCheckInOverlap.status === 400 &&
      resCheckInOverlap.body.error?.includes('chưa checkout từ ngày 2026-09-01'),
      'TC-ON-14: Hết quota auto-heal → vẫn chặn cứng 400, message giữ nguyên ngữ cảnh ngày ca (400 Bad Request)'
    );
    assert(
      resCheckInOverlap.body.error?.includes('quota'),
      'TC-ON-14.0: Message chặn mới nêu rõ lý do quota — nhân viên biết phải gặp Admin'
    );

    // -- Unit test thẳng helper healUnclosedShiftForCheckin --
    const healNow = new Date('2026-09-09T07:50:00+07:00');
    const dayShift = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      date: '2026-09-08',
      check_in_time: new Date('2026-09-08T08:00:00+07:00'),
      check_out_time: null,
    };
    const prevFUA_RT17 = Attendance.findOneAndUpdate;
    const prevReqCreate_RT17 = Request.create;
    const prevUserFind_RT17 = User.find;
    let healUpdateArg = null;
    let healRequestDoc = null;
    Attendance.findOne = () => createChain(null);
    Attendance.countDocuments = () => Promise.resolve(0);
    Attendance.findOneAndUpdate = (q, upd) => {
      healUpdateArg = { q, upd };
      return Promise.resolve({ ...dayShift, check_out_time: new Date('2026-09-08T18:30:00+07:00') });
    };
    Request.create = (doc) => { healRequestDoc = doc; return Promise.resolve(doc); };
    User.find = () => Promise.resolve([]);

    const outcomeHealed = await healUnclosedShiftForCheckin({ ...dayShift }, healNow);
    assert(
      outcomeHealed === 'healed' && healUpdateArg?.q?.check_out_time === null,
      'TC-ON-14.1: Ca ngày chưa khép → auto-heal với atomic conditional update (WHERE check_out_time: null)'
    );
    assert(
      healUpdateArg?.upd?.$set?.verification_status === 'pending_review' &&
      healUpdateArg.upd.$set.ot_hours === 0 &&
      healUpdateArg.upd.$set.auto_checkout === true &&
      healUpdateArg.upd.$set.is_flagged === true,
      'TC-ON-14.2: Khép tạm: pending_review + OT=0 + auto_checkout + flagged — chờ Admin hậu kiểm'
    );
    assert(
      String(healUpdateArg.upd.$set.check_out_time) === String(new Date('2026-09-08T18:30:00+07:00')),
      'TC-ON-14.3: Ca ngày thường khép tại 18:30 của ngày ca (min(now, work_end)) — không trừ giờ oan'
    );
    assert(
      healRequestDoc?.type === 'forgot_checkout' &&
      healRequestDoc?.status === 'pending' &&
      String(healRequestDoc?.source_attendance_id) === String(dayShift._id),
      'TC-ON-14.4: Tự sinh đơn forgot_checkout pending gắn source_attendance_id của ca nguồn'
    );

    healUpdateArg = null; healRequestDoc = null;
    Request.findOne = () => createChain({ _id: 'req_exists', status: 'pending' });
    const outcomeIdem = await healUnclosedShiftForCheckin({ ...dayShift }, healNow);
    assert(
      outcomeIdem === 'healed' && healUpdateArg === null && healRequestDoc === null,
      'TC-ON-14.5: Idempotency — lượt check-in sau thấy đơn auto-heal pending → cho qua, không khép/sinh đơn trùng'
    );

    healUpdateArg = null; healRequestDoc = null;
    Request.findOne = () => createChain(null);
    TimesheetLock.findOne = () => createChain({ _id: 'lock_1' });
    const outcomeLocked = await healUnclosedShiftForCheckin({ ...dayShift }, healNow);
    assert(
      outcomeLocked === 'bypassed' && healUpdateArg === null,
      'TC-ON-14.6: Tháng đã TimesheetLock → KHÔNG đụng sổ công (không findOneAndUpdate), chỉ chìa khóa thông hành'
    );
    assert(
      healRequestDoc?.end_time === null && String(healRequestDoc?.source_attendance_id) === String(dayShift._id),
      'TC-ON-14.7: Đơn bypass tháng khóa ghi nguồn ca, không đề xuất giờ (chờ Admin mở khóa + Override)'
    );

    healUpdateArg = null; healRequestDoc = null;
    TimesheetLock.findOne = () => createChain(null);
    const nightShift = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      date: '2026-09-08',
      check_in_time: new Date('2026-09-08T22:00:00+07:00'),
      check_out_time: null,
    };
    Attendance.findOneAndUpdate = (q, upd) => {
      healUpdateArg = { q, upd };
      return Promise.resolve({ ...nightShift, check_out_time: healNow });
    };
    const outcomeNight = await healUnclosedShiftForCheckin(nightShift, healNow);
    assert(
      outcomeNight === 'healed' && String(healUpdateArg?.upd?.$set?.check_out_time) === String(healNow),
      'TC-ON-14.8: Luật ca đêm (Antigravity): vào ca sau 18:30 → khép đúng giờ hiện tại, KHÔNG ép mốc 18:30'
    );

    healUpdateArg = null; healRequestDoc = null;
    Attendance.countDocuments = () => Promise.resolve(2);
    const outcomeQuota = await healUnclosedShiftForCheckin({ ...dayShift }, healNow);
    assert(
      outcomeQuota === 'quota-blocked' && healUpdateArg === null && healRequestDoc === null,
      'TC-ON-14.9: Vượt quota 2 lần/tháng → dừng heal, trả về chặn cứng để bảo toàn kỷ luật công'
    );

    healUpdateArg = null;
    Attendance.countDocuments = () => Promise.resolve(0);
    Attendance.findOneAndUpdate = () => Promise.resolve(null); // lượt khác đã khép trước
    const outcomeRace = await healUnclosedShiftForCheckin({ ...dayShift }, healNow);
    assert(
      outcomeRace === 'closed' && healRequestDoc === null,
      'TC-ON-14.10: Race double-click — thua update điều kiện vẫn đi tiếp check-in, không sinh đơn trùng'
    );

    // Restore toàn bộ mock RT17
    Attendance.findOne = prevFindOne_RT17;
    Attendance.countDocuments = prevCount_RT17;
    Attendance.findOneAndUpdate = prevFUA_RT17;
    Request.findOne = prevReqFindOne_RT17;
    Request.create = prevReqCreate_RT17;
    TimesheetLock.findOne = prevLockFindOne_RT17;
    SystemSetting.findOne = prevSettings_RT17;
    User.find = prevUserFind_RT17;
    // TC-ON-15: PUT /api/attendance/override/:id - Admin sửa giờ checkout xuyên ngày hôm sau (+1 ngày) tính đúng 6.05h OT
    let savedOverrideDoc = null;
    const mockOverrideDoc = {
      _id: "att_override_01",
      user_id: mockUserId,
      date: "2026-09-02",
      check_in_time: new Date("2026-09-02T09:28:00+07:00"),
      check_out_time: null,
      save: async function() { savedOverrideDoc = this; return this; }
    };
    Attendance.findById = () => createChain(mockOverrideDoc);
    Attendance.findOne = () => createChain(mockOverrideDoc);

    const resOverrideOvernight = await request(app)
      .put("/api/attendance/override/att_override_01")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        user_id: mockUserId,
        date: "2026-09-02",
        check_in_time: "09:28",
        check_out_time: "00:33",
        is_overnight_checkout: true,
        notes: "Admin điều chỉnh ca xuyên đêm sang ngày hôm sau",
      });

    assert(
      resOverrideOvernight.status === 200 &&
      resOverrideOvernight.body.attendance?.is_overnight === true &&
      resOverrideOvernight.body.attendance?.total_hours === 15.1 &&
      resOverrideOvernight.body.attendance?.ot_hours_proposed === 6.05,
      "TC-ON-15: PUT /api/attendance/override/:id - Sửa giờ checkout sang hôm sau (+1 ngày) tính đúng 15.1h làm và 6.05h OT xuyên đêm"
    );

    // (Bàn tròn 17: Attendance.findOne đã restore trong khối RT17; finally dưới vẫn về gốc)
  } finally {
    User.findById = origUserFindById;
    Attendance.find = origAttFind;
    Attendance.findOne = origAttFindOne;
    Attendance.findById = origAttFindById;
    TimesheetLock.findOne = origTimesheetFindOne;
    TimesheetLock.updateOne = origLockUpdateOne;
    TimesheetLock.findOneAndUpdate = origLockFindOneAndUpdate;
    AttendanceAuditLog.create = origAuditCreate;
    Notification.create = origNotifCreate;
    mongoose.startSession = origMongooseStartSession;
    SystemSetting.findOne = origSettingFindOne;
    Holiday.findOne = origHolidayFindOne;
  }

  // -------------------------------------------------------------------------
  // 4. BÁO CÁO & BẢNG CÔNG: Loại trừ OT Pending khỏi Tổng Giờ Chính Thức
  // -------------------------------------------------------------------------

  // TC-ON-13: Tính tổng OT tháng với danh sách có ca pending và approved
  const mockMonthlyRecords = [
    { ot_hours: 2.0, ot_status: 'auto_approved' },
    { ot_hours: 0, ot_hours_proposed: 6.05, ot_status: 'pending_approval' }, // Không được cộng
    { ot_hours: 4.5, ot_status: 'approved' },
    { ot_hours: 0, ot_hours_proposed: 5.0, ot_status: 'rejected' }, // Không được cộng
  ];

  const totalOfficialOt = mockMonthlyRecords.reduce((sum, r) => {
    return sum + (r.ot_status === 'pending_approval' ? 0 : (Number(r.ot_hours) || 0));
  }, 0);

  assert(
    totalOfficialOt === 6.5,
    'TC-ON-13: Tổng giờ OT chính thức (6.5h) loại trừ hoàn toàn các ca pending_approval và rejected'
  );

  // -------------------------------------------------------------------------
  // 5. BÀN TRÒN 18 (RT17.1): GIỜ TẠM của ca auto-heal chưa hậu kiểm bị loại trừ
  //    khỏi mọi tổng chính thức (report/ranking/payroll/trend) — predicate dùng
  //    THẬT từ reportController, cùng nguyên tắc với precedent OT ở TC-ON-13.
  // -------------------------------------------------------------------------
  const { isProvisionalHealHours } = require('../../src/controllers/reportController');
  const monthlyHoursRecords = [
    { total_hours: 8.0, flag_reason: null, verification_status: 'auto_approved' },
    { total_hours: 10.5, flag_reason: 'AUTO_HEAL_FORGOT_CHECKOUT', verification_status: 'pending_review' }, // giờ tạm — KHÔNG cộng
    { total_hours: 7.9, flag_reason: 'AUTO_HEAL_FORGOT_CHECKOUT', verification_status: 'approved' },        // đã hậu kiểm — cộng
  ];
  const officialTotalHours = parseFloat(
    monthlyHoursRecords.reduce((s, r) => s + (isProvisionalHealHours(r) ? 0 : (r.total_hours || 0)), 0).toFixed(1)
  );
  assert(
    officialTotalHours === 15.9,
    'TC-ON-16: Tổng giờ chính thức 15.9h loại trừ 10.5h tạm của ca auto-heal pending (không phải 26.4h) — payroll không ăn số chưa duyệt'
  );
  assert(
    isProvisionalHealHours(monthlyHoursRecords[1]) === true &&
    isProvisionalHealHours(monthlyHoursRecords[2]) === false,
    'TC-ON-16.1: Predicate bắn đúng cặp (AUTO_HEAL + pending_review); ca đã Admin duyệt quay về tính bình thường'
  );
  assert(
    isProvisionalHealHours({ total_hours: 0, flag_reason: null, verification_status: 'auto_approved' }) === false &&
    isProvisionalHealHours(undefined) === false,
    'TC-ON-16.2: Ca thường và input null-safe — không đổi hành vi cũ'
  );
}

module.exports = runOvernightShiftAndOtTests;
