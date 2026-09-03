// ==============================================
// tests/integration/requestHttpPipeline.test.js
// Integration Testing for Request Lifecycle, Transactions, Locks & Real Express HTTP Pipeline
// ==============================================

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const Request = require('../../src/models/Request');
const TimesheetLock = require('../../src/models/TimesheetLock');
const SystemSetting = require('../../src/models/SystemSetting');
const Notification = require('../../src/models/Notification');

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

async function runRequestHttpPipelineTests(assert) {
  console.log('\n🚪 [TEST SUITE: REQUEST HTTP PIPELINE, TRANSACTIONS, GUARDS & RBAC]');

  const mockAdmin = {
    _id: '507f1f77bcf86cd799439011',
    employee_code: 'NS-000',
    full_name: 'Admin Tổng',
    role: 'admin',
    email: 'admin@etoffice.vn',
    is_active: true,
    toObject() { return { ...this }; },
  };

  const mockLeader = {
    _id: '507f1f77bcf86cd799439022',
    employee_code: 'NS-001',
    full_name: 'Trưởng Phòng IT',
    role: 'leader',
    email: 'leader@etoffice.vn',
    department_id: '507f1f77bcf86cd799439099',
    department_ids: ['507f1f77bcf86cd799439099'],
    is_active: true,
    toObject() { return { ...this }; },
  };

  const mockEmployee = {
    _id: '507f1f77bcf86cd799439033',
    employee_code: 'NS-002',
    full_name: 'Nguyễn Văn Nhân Viên',
    role: 'employee',
    email: 'employee@etoffice.vn',
    department_id: '507f1f77bcf86cd799439099',
    department_ids: ['507f1f77bcf86cd799439099'],
    is_active: true,
    toObject() { return { ...this }; },
  };

  const adminToken = generateTestToken(mockAdmin);
  const leaderToken = generateTestToken(mockLeader);
  const employeeToken = generateTestToken(mockEmployee);

  const origUserFindById = User.findById;
  const origUserFind = User.find;
  const origAttFindOne = Attendance.findOne;
  const origAttCreate = Attendance.create;
  const origReqFindOne = Request.findOne;
  const origReqFindById = Request.findById;
  const origReqFind = Request.find;
  const origReqCountDocuments = Request.countDocuments;
  const origReqCreate = Request.create;
  const origLockFindOne = TimesheetLock.findOne;
  const origLockFindOneAndUpdate = TimesheetLock.findOneAndUpdate;
  const origLockUpdateOne = TimesheetLock.updateOne;
  const origSettingFindOne = SystemSetting.findOne;
  const origNotifCreate = Notification.create;
  const origNotifInsertMany = Notification.insertMany;
  const origMongooseStartSession = mongoose.startSession;
  const origReadyState = mongoose.connection ? mongoose.connection.readyState : 0;
  const origClient = mongoose.connection ? mongoose.connection.client : undefined;

  try {
    // Tracking Session Propagation
    let mockSessionActive = false;
    let mockSessionCommitted = false;
    let mockSessionEnded = false;
    const passedSessions = {
      user: null,
      request: null,
      attendance: null,
      lock: null,
      setting: null,
      attendanceSave: null,
      requestSave: null,
    };

    const mockSessionInstance = {
      _id: 'mock_tx_session_uuid_999',
      async withTransaction(fn) {
        mockSessionActive = true;
        await fn();
        mockSessionCommitted = true;
      },
      startTransaction() {
        mockSessionActive = true;
      },
      async commitTransaction() {
        mockSessionCommitted = true;
      },
      async abortTransaction() {
        mockSessionActive = false;
      },
      async endSession() {
        mockSessionEnded = true;
      },
    };

    if (mongoose.connection) {
      mongoose.connection.readyState = 1;
      mongoose.connection.client = {
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary',
            servers: new Map([['host1', {}]]),
          },
        },
      };
    }

    mongoose.startSession = async () => mockSessionInstance;

    User.findById = (id) => {
      const idStr = id ? id.toString() : '';
      const found = [mockAdmin, mockLeader, mockEmployee].find(u => u._id === idStr) || mockAdmin;
      return createChain(found, (sess) => { passedSessions.user = sess; });
    };
    User.find = () => createChain([mockAdmin, mockLeader, mockEmployee]);
    Notification.create = async () => ({});
    Notification.insertMany = async () => [];
    SystemSetting.findOne = () => createChain({ work_start_time: '09:00', work_end_time: '18:30' }, (sess) => { passedSessions.setting = sess; });
    Request.findOne = () => createChain(null, (sess) => { passedSessions.request = sess; });
    Request.findById = () => createChain(null);
    Request.create = async (doc) => ({ _id: 'req_valid_01', ...doc });
    TimesheetLock.findOne = () => createChain(null, (sess) => { passedSessions.lock = sess; });
    TimesheetLock.findOneAndUpdate = async (filter, update, opts) => {
      if (opts?.session) passedSessions.lock = opts.session;
      return { is_locked: false, guard_version: 1 };
    };
    TimesheetLock.updateOne = async () => ({ acknowledged: true });
    Attendance.findOne = () => createChain(null, (sess) => { passedSessions.attendance = sess; });

    // TC-REQ-HTTP-01: Chặn nộp đơn bổ sung checkout cho ngày tương lai
    const resFuture = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2099-01-01',
        end_time: '18:30',
        reason: 'Quên checkout ngày tương lai',
      });
    assert(resFuture.status === 400 && resFuture.body.error?.includes('thời gian hiện tại'),
      'TC-REQ-HTTP-01: POST /api/requests - Chặn đơn bổ sung checkout cho ngày tương lai (400)');

    // TC-REQ-HTTP-02: Chặn khi ngày đó chưa có check-in
    Attendance.findOne = () => createChain(null);
    Request.findOne = () => createChain(null);
    const resNoCheckin = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_time: '18:30',
        reason: 'Quên checkout nhưng chưa checkin',
      });
    assert(resNoCheckin.status === 400 && resNoCheckin.body.error?.includes('chưa có dữ liệu check-in'),
      'TC-REQ-HTTP-02: POST /api/requests - Chặn đơn khi ngày đó chưa có check-in (400)');

    // TC-REQ-HTTP-03: Chặn khi giờ checkout đề xuất <= giờ check-in lúc tạo đơn
    Attendance.findOne = () => createChain({
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T09:30:00+07:00',
      check_out_time: null,
    });
    const resInvalidTime = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_time: '09:00', // Sớm hơn 09:30
        reason: 'Nhập giờ ra trước giờ vào',
      });
    assert(resInvalidTime.status === 400 && resInvalidTime.body.error?.includes('phải sau giờ check-in'),
      'TC-REQ-HTTP-03: POST /api/requests - Chặn giờ checkout đề xuất sớm hơn giờ check-in (400)');

    // TC-REQ-HTTP-04: Chặn khi ngày đó đã có checkout thực tế
    const RealDate = global.Date;
    const fakeNow = new RealDate('2026-08-31T09:00:00+07:00');
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fakeNow.getTime());
        } else {
          super(...args);
        }
      }
      static now() {
        return fakeNow.getTime();
      }
    }
    global.Date = MockDate;

    Attendance.findOne = () => createChain({
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T09:00:00+07:00',
      check_out_time: '2026-08-30T18:35:00+07:00',
    });
    const resAlreadyCheckedOut = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_time: '19:00',
        reason: 'Gửi đè checkout',
      });
    assert(resAlreadyCheckedOut.status === 400 && resAlreadyCheckedOut.body.error?.includes('đã có dữ liệu checkout'),
      'TC-REQ-HTTP-04: POST /api/requests - Chặn nộp đơn khi đã có dữ liệu checkout thực tế (400)');

    // TC-REQ-HTTP-05: Gửi đơn hợp lệ thành công (201 Created) và cưỡng chế end_date = start_date
    Attendance.findOne = () => createChain({
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T09:00:00+07:00',
      check_out_time: null,
    });
    let capturedDoc = null;
    Request.create = async (doc) => { capturedDoc = doc; return { _id: 'req_valid_01', ...doc }; };
    const resValidCreate = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_date: '2026-09-05', // Cố tình gửi dải nhiều ngày
        end_time: '18:30',
        reason: 'Quên bấm checkout khi về',
      });
    assert(resValidCreate.status === 201,
      'TC-REQ-HTTP-05.1: POST /api/requests - Gửi đơn bổ sung checkout hợp lệ thành công (201)');
    assert(capturedDoc && capturedDoc.end_date === '2026-08-30',
      'TC-REQ-HTTP-05.2: Cưỡng chế end_date = start_date cho đơn forgot_checkout cùng ngày');

    // TC-REQ-HTTP-05.3: Chặn nộp đơn khi đã quá hạn 48 giờ sau ca làm việc
    Attendance.findOne = () => createChain({
      user_id: mockEmployee._id,
      date: '2026-08-25',
      check_in_time: '2026-08-25T09:00:00+07:00',
      check_out_time: null,
    });
    const resExpired = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-25',
        end_time: '18:30',
        reason: 'Quên checkout 6 ngày trước',
      });
    assert(resExpired.status === 400 && resExpired.body.error?.includes('quá hạn'),
      'TC-REQ-HTTP-05.3: Chặn nộp đơn bổ sung checkout khi đã quá hạn 48 giờ (400)');

    // TC-REQ-HTTP-05.4: Gửi đơn forgot_checkout ca xuyên ngày (end_date = start_date + 1)
    Attendance.findOne = () => createChain({
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T18:00:00+07:00',
      check_out_time: null,
    });
    let capturedOvernightDoc = null;
    Request.create = async (doc) => { capturedOvernightDoc = doc; return { _id: 'req_valid_on_01', ...doc }; };
    const resValidOvernight = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_date: '2026-08-31',
        end_time: '02:00',
        reason: 'Làm việc xuyên đêm quên checkout',
      });
    assert(resValidOvernight.status === 201,
      'TC-REQ-HTTP-05.4: POST /api/requests - Gửi đơn forgot_checkout ca xuyên ngày thành công (201)');
    assert(capturedOvernightDoc && capturedOvernightDoc.end_date === '2026-08-31',
      'TC-REQ-HTTP-05.5: Cho phép end_date là ngày hôm sau (+1) cho ca xuyên ngày');

    global.Date = RealDate;

    // TC-REQ-HTTP-06: Leader bị CHẶN khi cố duyệt đơn forgot_checkout (Chỉ Admin mới có quyền)
    Request.findById = () => createChain({
      _id: 'req_valid_01',
      user_id: mockEmployee._id,
      type: 'forgot_checkout',
      start_date: '2026-08-30',
      end_date: '2026-08-30',
      end_time: '18:30',
      reason: 'Quên checkout',
      status: 'pending',
    });
    const resLeaderApprove = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ reviewer_note: 'Leader duyệt' });
    assert(resLeaderApprove.status === 403 && resLeaderApprove.body.error?.includes('Quản trị viên (Admin)'),
      'TC-REQ-HTTP-06: PUT /api/requests/:id/approve - Chặn Leader duyệt đơn forgot_checkout (403)');

    // TC-REQ-HTTP-07: Write-Intent Guard chặn duyệt 403 khi Bảng công đã bị chốt khóa
    TimesheetLock.findOneAndUpdate = async () => null; // Bị khóa
    Request.findOne = () => createChain({
      _id: 'req_valid_01',
      user_id: mockEmployee._id,
      type: 'forgot_checkout',
      start_date: '2026-08-30',
      end_date: '2026-08-30',
      end_time: '18:30',
      reason: 'Quên checkout',
      status: 'pending',
    });
    const resLockedApprove = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Admin duyệt' });
    assert(resLockedApprove.status === 403 && resLockedApprove.body.error?.includes('chốt khóa'),
      'TC-REQ-HTTP-07: PUT /api/requests/:id/approve - Write-Intent Guard chặn 403 khi Bảng công đã bị chốt khóa');

    // TC-REQ-HTTP-08: Chặn duyệt nếu nhân viên đã checkout trước khi duyệt (Race check)
    TimesheetLock.findOneAndUpdate = async () => ({ is_locked: false, guard_version: 2 });
    Attendance.findOne = () => createChain({
      _id: 'att_01',
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T09:00:00+07:00',
      check_out_time: '2026-08-30T18:40:00+07:00', // Đã checkout thật
    });
    const resRaceApprove = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Duyệt' });
    assert(resRaceApprove.status === 409 && resRaceApprove.body.error?.includes('đã có dữ liệu checkout thực tế'),
      'TC-REQ-HTTP-08: PUT /api/requests/:id/approve - Chặn 409 Conflict khi nhân viên đã checkout thật trước khi duyệt');

    // TC-REQ-HTTP-09: Re-check tại thời điểm duyệt chặn giờ checkout đề xuất <= giờ check-in đã sửa
    Attendance.findOne = () => createChain({
      _id: 'att_01',
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T19:00:00+07:00', // Admin đã sửa check-in thành 19:00
      check_out_time: null,
    });
    Request.findOne = () => createChain({
      _id: 'req_valid_01',
      user_id: mockEmployee._id,
      type: 'forgot_checkout',
      start_date: '2026-08-30',
      end_date: '2026-08-30',
      end_time: '18:30', // Đề xuất cũ 18:30 < 19:00
      reason: 'Quên checkout',
      status: 'pending',
    });
    const resApprovalTimeCheck = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Duyệt' });
    assert(resApprovalTimeCheck.status === 400 && resApprovalTimeCheck.body.error?.includes('phải sau giờ check-in thực tế'),
      'TC-REQ-HTTP-09: PUT /api/requests/:id/approve - Recheck tại thời điểm duyệt chặn giờ ra <= giờ vào (400)');

    // TC-REQ-HTTP-10: Duyệt thành công trong withTransaction, xác minh session propagation xuyên suốt các Model và Mutation Writes
    let savedAtt = null;
    let savedReq = null;
    mockSessionActive = false;
    mockSessionCommitted = false;
    mockSessionEnded = false;
    passedSessions.user = null;
    passedSessions.request = null;
    passedSessions.attendance = null;
    passedSessions.lock = null;
    passedSessions.setting = null;
    passedSessions.attendanceSave = null;
    passedSessions.requestSave = null;

    Attendance.findOne = () => createChain({
      _id: 'att_01',
      user_id: mockEmployee._id,
      date: '2026-08-30',
      check_in_time: '2026-08-30T09:00:00+07:00',
      check_out_time: null,
      total_hours: 0,
      ot_hours: 2.5,
      work_units: 0,
      status: 'present',
      save: async function (opts) {
        passedSessions.attendanceSave = opts?.session;
        savedAtt = this;
        return this;
      },
    }, (sess) => { passedSessions.attendance = sess; });

    const makeReqPending = () => ({
      _id: 'req_valid_01',
      user_id: mockEmployee._id,
      type: 'forgot_checkout',
      start_date: '2026-08-30',
      end_date: '2026-08-30',
      end_time: '18:30',
      reason: 'Quên checkout',
      status: 'pending',
      save: async function (opts) {
        passedSessions.requestSave = opts?.session;
        savedReq = this;
        return this;
      },
      toObject() { return { ...this }; },
    });

    Request.findById = () => createChain(makeReqPending());
    Request.findOne = () => createChain(makeReqPending(), (sess) => { passedSessions.request = sess; });

    TimesheetLock.findOneAndUpdate = async (filter, update, opts) => {
      if (opts?.session) passedSessions.lock = opts.session;
      return { is_locked: false, guard_version: 1 };
    };

    const resSuccessApprove = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Duyệt giờ về 18:30' });

    assert(resSuccessApprove.status === 200,
      'TC-REQ-HTTP-10.1: PUT /api/requests/:id/approve - Admin duyệt thành công (200 OK)');
    assert(mockSessionActive && mockSessionCommitted && mockSessionEnded,
      'TC-REQ-HTTP-10.2: Giao dịch được thực thi qua withTransaction, commit và endSession an toàn');
    assert(
      passedSessions.request === mockSessionInstance &&
      passedSessions.attendance === mockSessionInstance &&
      passedSessions.lock === mockSessionInstance &&
      passedSessions.user === mockSessionInstance &&
      passedSessions.setting === mockSessionInstance &&
      passedSessions.attendanceSave === mockSessionInstance &&
      passedSessions.requestSave === mockSessionInstance,
      'TC-REQ-HTTP-10.3: Session được truyền xuyên suốt vào Request, Attendance, User, SystemSetting, Lock query & Save mutations'
    );
    assert(savedAtt && savedAtt.check_out_time !== null,
      'TC-REQ-HTTP-10.4: Attendance được cập nhật check_out_time chuẩn xác');
    assert(savedAtt && savedAtt.ot_hours === 0 && savedAtt.is_early_leave === false,
      'TC-REQ-HTTP-10.5: Reset ot_hours=0 và is_early_leave=false khi ra đúng ca 18:30');
    assert(savedReq && savedReq.snapshot_before?.attendance_records?.length > 0,
      'TC-REQ-HTTP-10.6: Request lưu đầy đủ snapshot_before để phục vụ hoàn tác 100%');
    assert(resSuccessApprove.body.request?.status === 'approved',
      'TC-REQ-HTTP-10.7: API response trả về đối tượng Request mang trạng thái approved mới nhất');

    // TC-REQ-HTTP-11: Error Boundary bắt trọn lỗi DB tại Request.findById và trả HTTP 500 được sanitize sạch sẽ
    Request.findById = () => {
      const p = Promise.reject(new Error('MongoServerError: E11000 duplicate key error collection: et_office.requests index: user_1_date_1'));
      p.select = () => p;
      p.populate = () => p;
      return p;
    };
    const resErrorBoundary = await request(app)
      .put('/api/requests/req_valid_01/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_note: 'Duyệt' });
    assert(
      resErrorBoundary.status === 500 &&
      resErrorBoundary.body.error?.includes('Lỗi duyệt đơn') &&
      !resErrorBoundary.body.error?.includes('E11000') &&
      !resErrorBoundary.body.error?.includes('et_office.requests'),
      'TC-REQ-HTTP-11: Error boundary bắt Promise Rejection và sanitize thông điệp lỗi DB an toàn (không lộ collection/index)'
    );

    // TC-REQ-HTTP-12: Nhân viên bị CHẶN khi tự hoàn tác đơn đã duyệt (403)
    const makeReqApproved = () => ({
      _id: 'req_valid_01',
      user_id: mockEmployee._id,
      type: 'forgot_checkout',
      start_date: '2026-08-30',
      end_date: '2026-08-30',
      status: 'approved',
      snapshot_before: {
        attendance_records: [{
          date: '2026-08-30',
          was_created: false,
          doc: {
            status: 'present',
            work_units: 0,
            total_hours: 0,
            ot_hours: 0,
            check_in_time: '2026-08-30T09:00:00+07:00',
            check_out_time: null,
            notes: 'Gốc',
          },
        }],
      },
      save: async function () { return this; },
      toObject() { return { ...this }; },
    });
    Request.findById = () => createChain(makeReqApproved());
    Request.findOne = () => createChain(makeReqApproved());

    const resEmpRevert = await request(app)
      .put('/api/requests/req_valid_01/revert')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Nhân viên tự hoàn tác' });
    assert(resEmpRevert.status === 403,
      'TC-REQ-HTTP-12: PUT /api/requests/:id/revert - Chặn 403 khi Nhân viên tự hoàn tác đơn đã duyệt');

    // TC-REQ-HTTP-13: Admin hoàn tác thành công -> Phục hồi snapshot và trả response trạng thái pending
    let restoredAtt = null;
    Attendance.findOne = () => createChain({
      _id: 'att_01',
      user_id: mockEmployee._id,
      date: '2026-08-30',
      save: async function () { restoredAtt = this; return this; },
    });
    const resAdminRevert = await request(app)
      .put('/api/requests/req_valid_01/revert')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Admin hoàn tác xem xét lại' });

    assert(resAdminRevert.status === 200,
      'TC-REQ-HTTP-13.1: PUT /api/requests/:id/revert - Admin hoàn tác thành công (200 OK)');
    assert(restoredAtt && restoredAtt.check_out_time === null,
      'TC-REQ-HTTP-13.2: Attendance được phục hồi 100% về trạng thái "Chưa ra" (check_out_time=null)');
    assert(resAdminRevert.body.request?.status === 'pending',
      'TC-REQ-HTTP-13.3: API response trả về đối tượng Request mang trạng thái pending mới nhất');

    // TC-REQ-HTTP-14: Chống rò rỉ session tại đường thoát sớm (Early-exit cleanup) khi session thiếu transaction methods
    const origEnv = process.env.NODE_ENV;
    let defectiveSessionEnded = false;
    try {
      process.env.NODE_ENV = 'production';
      mongoose.startSession = async () => ({
        _id: 'defective_sess_01',
        // Không có withTransaction, không có startTransaction
        async endSession() { defectiveSessionEnded = true; },
      });
      const resDefective = await request(app)
        .put('/api/requests/req_valid_01/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewer_note: 'Duyệt' });
      assert(
        resDefective.status === 500 &&
        resDefective.body.error?.includes('thiếu phương thức transaction') &&
        defectiveSessionEnded === true,
        'TC-REQ-HTTP-14: Early-exit đóng session an toàn (endSession) khi session thiếu transaction API trong production'
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    // TC-REQ-HTTP-15: [P3] Topology Single trên môi trường có DB thật: withTransaction bị từ chối với lỗi Transaction numbers are only allowed... -> Fail-Closed HTTP 500 & 0 mutation
    let singleSaveMutationCount = 0;
    let standaloneSessionEnded = false;
    try {
      process.env.NODE_ENV = 'development';
      if (mongoose.connection) {
        mongoose.connection.readyState = 1;
        mongoose.connection.client = {
          topology: {
            description: {
              type: 'Single',
              servers: new Map([['host1', {}]]),
            },
          },
        };
      }
      mongoose.startSession = async () => ({
        _id: 'standalone_sess_01',
        async withTransaction() {
          throw new Error('MongoServerError: Transaction numbers are only allowed on a replica set member or mongos');
        },
        async endSession() { standaloneSessionEnded = true; },
      });

      Attendance.findOne = () => createChain({
        _id: 'att_01',
        user_id: mockEmployee._id,
        date: '2026-08-30',
        check_in_time: '2026-08-30T09:00:00+07:00',
        check_out_time: null,
        save: async () => { singleSaveMutationCount++; },
      });
      Request.findById = () => createChain({
        _id: 'req_valid_01',
        user_id: mockEmployee._id,
        type: 'forgot_checkout',
        start_date: '2026-08-30',
        end_date: '2026-08-30',
        status: 'pending',
        save: async () => { singleSaveMutationCount++; },
      });

      const resSingle = await request(app)
        .put('/api/requests/req_valid_01/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewer_note: 'Duyệt trên Single deployment' });

      assert(
        resSingle.status === 500 &&
        resSingle.body.error?.includes('Lỗi duyệt đơn') &&
        singleSaveMutationCount === 0 &&
        standaloneSessionEnded === true,
        'TC-REQ-HTTP-15: MongoDB Single thật từ chối transaction -> Fail-Closed HTTP 500, 0 save mutation & session được đóng an toàn'
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      mongoose.startSession = async () => mockSessionInstance;
    }

    // TC-REQ-HTTP-16: [P3] Môi trường development mất kết nối (readyState: 0) lập tức Fail-Fast HTTP 500 mà không gọi startSession
    let startSessionAttempted = false;
    try {
      process.env.NODE_ENV = 'development';
      if (mongoose.connection) {
        mongoose.connection.readyState = 0; // Disconnected
        mongoose.connection.client = {
          topology: {
            description: {
              type: 'ReplicaSetWithPrimary',
              servers: new Map([['host1', {}]]),
            },
          },
        };
      }
      mongoose.startSession = async () => {
        startSessionAttempted = true;
        return mockSessionInstance;
      };

      const resDisconnected = await request(app)
        .put('/api/requests/req_valid_01/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewer_note: 'Duyệt khi mất kết nối' });

      assert(
        resDisconnected.status === 500 &&
        resDisconnected.body.error?.includes('Lỗi kết nối cơ sở dữ liệu') &&
        startSessionAttempted === false,
        'TC-REQ-HTTP-16: Development mất kết nối (readyState: 0) Fail-Fast HTTP 500 ngay trước khi gọi startSession'
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      mongoose.startSession = async () => mockSessionInstance;
    }

    // TC-REQ-HTTP-17: Danh sách phân trang chỉ trả metadata ảnh, không đẩy Base64 nặng về client
    Request.find = () => createChain([{
      _id: 'req_attachment_01',
      user_id: mockEmployee,
      type: 'other',
      start_date: '2026-08-30',
      reason: 'Có ảnh minh chứng',
      status: 'pending',
      attachment_url: 'data:image/png;base64,very-large-payload',
      snapshot_before: { private: 'large-snapshot' },
      toObject() { return { ...this }; },
    }]);
    Request.countDocuments = async () => 1;

    const resRequestList = await request(app)
      .get('/api/requests/my-requests?page=1&limit=20')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert(
      resRequestList.status === 200 &&
      resRequestList.body.requests?.length === 1 &&
      resRequestList.body.requests[0].has_attachment === true &&
      !Object.hasOwn(resRequestList.body.requests[0], 'attachment_url') &&
      !Object.hasOwn(resRequestList.body.requests[0], 'snapshot_before') &&
      resRequestList.body.pagination?.total === 1,
      'TC-REQ-HTTP-17: Danh sách đơn phân trang loại Base64/snapshot, chỉ trả has_attachment nhẹ'
    );

    // TC-REQ-HTTP-18: Chủ đơn tải ảnh theo nhu cầu qua endpoint bảo vệ riêng
    Request.findById = () => createChain({
      _id: 'req_attachment_01',
      user_id: mockEmployee._id,
      attachment_url: 'data:image/png;base64,on-demand-image',
    });
    const resAttachment = await request(app)
      .get('/api/requests/req_attachment_01/attachment')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert(
      resAttachment.status === 200 &&
      resAttachment.body.attachment_url === 'data:image/png;base64,on-demand-image' &&
      String(resAttachment.headers['cache-control'] || '').includes('private'),
      'TC-REQ-HTTP-18: Ảnh minh chứng chỉ được tải theo nhu cầu bởi chủ đơn qua endpoint riêng'
    );

  } finally {
    User.findById = origUserFindById;
    User.find = origUserFind;
    Attendance.findOne = origAttFindOne;
    Attendance.create = origAttCreate;
    Request.findOne = origReqFindOne;
    Request.findById = origReqFindById;
    Request.find = origReqFind;
    Request.countDocuments = origReqCountDocuments;
    Request.create = origReqCreate;
    TimesheetLock.findOne = origLockFindOne;
    TimesheetLock.findOneAndUpdate = origLockFindOneAndUpdate;
    TimesheetLock.updateOne = origLockUpdateOne;
    SystemSetting.findOne = origSettingFindOne;
    Notification.create = origNotifCreate;
    Notification.insertMany = origNotifInsertMany;
    mongoose.startSession = origMongooseStartSession;
    if (mongoose.connection) {
      mongoose.connection.readyState = origReadyState;
      mongoose.connection.client = origClient;
    }
  }
}

module.exports = runRequestHttpPipelineTests;
