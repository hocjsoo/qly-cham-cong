// ==============================================
// tests/integration/controllerIntegration.test.js
// Integration Testing for Real Express App, Routes, Middleware Pipeline & Supertest
// ==============================================

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.DATABASE_URL;

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const OfficeLocation = require('../../src/models/OfficeLocation');
const SystemSetting = require('../../src/models/SystemSetting');
const DeviceRegistry = require('../../src/models/DeviceRegistry');
const DeviceSession = require('../../src/models/DeviceSession');
const Project = require('../../src/models/Project');
const AttendanceAuditLog = require('../../src/models/AttendanceAuditLog');
const TimesheetLock = require('../../src/models/TimesheetLock');
const Holiday = require('../../src/models/Holiday');

const JWT_SECRET = process.env.JWT_SECRET || 'et_office_jwt_secret_key_2026_super_secure_key_123456';

// Helper tạo JWT Token thật để test Middleware Pipeline
function generateTestToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      id: user._id,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_ids: user.department_ids
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runControllerIntegrationTests(assert) {
  console.log('\n🎯 [TEST SUITE: REAL EXPRESS APP & SUPERTEST INTEGRATION PIPELINE]');

  const originalUserFind = User.find;
  const originalFindById = User.findById;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;

  const originalSettingFindOne = SystemSetting.findOne;
  const originalLocationFind = OfficeLocation.find;
  const originalAttFindOne = Attendance.findOne;
  const originalAttFind = Attendance.find;
  const originalAttCreate = Attendance.create;
  const originalAttSave = Attendance.prototype.save;
  const originalDevRegFind = DeviceRegistry.find;
  const originalDevRegFindOneAndUpdate = DeviceRegistry.findOneAndUpdate;
  const originalDevSessFindOne = DeviceSession.findOne;
  const originalDevSessSave = DeviceSession.prototype.save;
  const originalProjFind = Project.find;
  const originalAuditLogCreate = AttendanceAuditLog.create;
  const originalAuditLogFind = AttendanceAuditLog.find;
  const originalAuditLogFindById = AttendanceAuditLog.findById;
  const originalAuditLogCountDocuments = AttendanceAuditLog.countDocuments;
  const originalLockFindOne = TimesheetLock.findOne;
  const originalLockFindOneAndUpdate = TimesheetLock.findOneAndUpdate;
  const originalLockUpdateOne = TimesheetLock.updateOne;
  const originalHolidayFindOne = Holiday.findOne;
  TimesheetLock.findOne = async () => null;
  TimesheetLock.findOneAndUpdate = async () => ({ is_locked: false });
  TimesheetLock.updateOne = async () => ({ acknowledged: true });
  const originalMongooseStartSession = mongoose.startSession;
  const originalConnectionReadyState = mongoose.connection?.readyState;
  const originalConnectionClient = mongoose.connection ? mongoose.connection.client : undefined;

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'et_office_jwt_secret_key_2026_super_secure_key_123456';

  const mockAdminUser = {
    _id: '507f1f77bcf86cd799439011',
    employee_code: 'NS-000',
    full_name: 'Admin Tổng',
    role: 'admin',
    email: 'admin@company.com',
    is_active: true,
    toObject() { return { ...this }; }
  };

  const mockLeaderUser = {
    _id: '507f1f77bcf86cd799439012',
    employee_code: 'NS-001',
    full_name: 'Trưởng Phòng IT',
    role: 'leader',
    department_id: 'dept_it',
    department_ids: ['dept_it'],
    email: 'lead_it@company.com',
    phone: '0901',
    is_active: true,
    toObject() { return { ...this }; }
  };

  const mockEmpUser = {
    _id: '507f1f77bcf86cd799439013',
    employee_code: 'NS-002',
    full_name: 'Dev IT 1',
    role: 'employee',
    department_id: 'dept_it',
    department_ids: ['dept_it'],
    email: 'emp_it@company.com',
    phone: '0902',
    is_active: true,
    toObject() { return { ...this }; }
  };

  const userNamEmp = {
    _id: '507f1f77bcf86cd799439099',
    employee_code: 'NS-099',
    full_name: 'Nguyễn Văn Nam',
    role: 'employee',
    email: 'nam_nv@company.com',
    is_active: true,
    toObject() { return { ...this }; }
  };

  const adminToken = generateTestToken(mockAdminUser);
  const leaderToken = generateTestToken(mockLeaderUser);
  const employeeToken = generateTestToken(mockEmpUser);

  const sampleDbUsers = [
    {
      _id: '507f1f77bcf86cd799439012',
      employee_code: 'NS-001',
      full_name: 'Trưởng Phòng IT',
      role: 'leader',
      department_id: { _id: 'dept_it', name: 'Phòng IT' },
      department_ids: [{ _id: 'dept_it', name: 'Phòng IT' }],
      email: 'lead_it@company.com',
      phone: '0901',
      dob: '1990-01-01',
      cccd: '123456789012',
      bank_account: '99998888',
      parking_location: '17T10',
      vehicle_info: 'Wave 29A-1234',
      is_active: true,
      employment_status: 'Dang lam viec',
      toObject() { return { ...this }; }
    },
    {
      _id: '507f1f77bcf86cd799439013',
      employee_code: 'NS-002',
      full_name: 'Dev IT 1',
      position: 'Dev IT 1',
      role: 'employee',
      department_id: { _id: 'dept_it', name: 'Phòng IT' },
      department_ids: [{ _id: 'dept_it', name: 'Phòng IT' }],
      email: 'emp_it@company.com',
      phone: '0902',
      dob: '1995-05-05',
      cccd: '987654321098',
      bank_account: '77776666',
      parking_location: '17T10',
      vehicle_info: 'Lead 29B-5678',
      is_active: true,
      employment_status: 'Dang lam viec',
      toObject() { return { ...this }; }
    },
    {
      _id: '507f1f77bcf86cd799439014',
      employee_code: 'NS-003',
      full_name: 'Kinh Doanh 1',
      role: 'employee',
      department_id: { _id: 'dept_sale', name: 'Phòng Kinh Doanh' },
      department_ids: [{ _id: 'dept_sale', name: 'Phòng Kinh Doanh' }],
      email: 'sale1@company.com',
      phone: '0903',
      dob: '1998-08-08',
      cccd: '555544443333',
      bank_account: '11112222',
      parking_location: 'Gửi ngoài',
      vehicle_info: 'SH 29C-9999',
      is_active: true,
      employment_status: 'Dang lam viec',
      toObject() { return { ...this }; }
    }
  ];

  const createQueryChain = (data) => {
    const chain = {
      select() { return chain; },
      populate() { return chain; },
      sort() { return chain; },
      limit() { return chain; },
      lean() { return Promise.resolve(data); },
      distinct() { return Promise.resolve(data); },
      then(resolve, reject) { return Promise.resolve(data).then(resolve, reject); },
      catch(reject) { return Promise.resolve(data).catch(reject); },
    };
    return chain;
  };

  User.find = function() {
    return createQueryChain(sampleDbUsers);
  };

  User.findById = function(id) {
    const found = [mockAdminUser, mockLeaderUser, mockEmpUser, userNamEmp].find(u => u._id.toString() === id.toString()) || mockAdminUser;
    const userDoc = {
      ...found,
      toObject() { return { ...found }; }
    };
    const chain = {
      session(sess) {
        chain._session = sess;
        return chain;
      },
      select() { return chain; },
      populate() { return chain; },
      then(resolve, reject) { return Promise.resolve(userDoc).then(resolve, reject); },
      catch(reject) { return Promise.resolve(userDoc).catch(reject); }
    };
    return chain;
  };

  let lastUpdatedData = null;
  User.findByIdAndUpdate = function(id, updateData) {
    lastUpdatedData = updateData;
    const baseUser = sampleDbUsers[0];
    return {
      select() {
        return {
          populate() {
            return Promise.resolve({
              ...baseUser,
              ...updateData,
              toObject() { return { ...baseUser, ...updateData }; }
            });
          }
        };
      }
    };
  };

  // Stubs cho Luồng Chấm công qua Pipeline
  SystemSetting.findOne = function() {
    return Promise.resolve({
      work_start_time: '09:00',
      work_end_time: '18:30',
      minor_late_mins: 30,
      medium_late_mins: 60,
      office_latitude: 21.0285,
      office_longitude: 105.8542,
      default_gps_radius_meters: 250,
    });
  };

  Holiday.findOne = function() {
    return createQueryChain(null);
  };

  OfficeLocation.find = function() {
    return Promise.resolve([
      { name: 'Văn phòng chính', lat: 21.0285, lng: 105.8542, radius_m: 250, is_active: true }
    ]);
  };

  DeviceRegistry.find = function() {
    return {
      populate() {
        return Promise.resolve([]);
      }
    };
  };

  DeviceRegistry.findOneAndUpdate = function() {
    return Promise.resolve({});
  };

  DeviceSession.findOne = function() {
    return Promise.resolve(null);
  };

  DeviceSession.prototype.save = function() {
    return Promise.resolve(this);
  };

  const mockSavedAttendanceMap = new Map();
  const mockAuditLogs = [];

  AttendanceAuditLog.create = async function(data) {
    const raw = Array.isArray(data) ? data[0] : data;
    const doc = new AttendanceAuditLog(raw);
    doc._id = doc._id || '507f1f77bcf86cd799439077';
    await doc.validate();
    mockAuditLogs.push(doc);
    return Array.isArray(data) ? [doc] : doc;
  };

  AttendanceAuditLog.find = function(query) {
    let list = [...mockAuditLogs];
    if (query?.date?.$gte && query?.date?.$lte) {
      list = list.filter(l => l.date >= query.date.$gte && l.date <= query.date.$lte);
    }
    const queryObj = {
      select(fields) {
        if (typeof fields === 'string') {
          const fieldList = fields.split(' ').filter(Boolean);
          list = list.map(item => {
            const rawItem = typeof item.toObject === 'function' ? item.toObject() : item;
            const projected = {};
            fieldList.forEach(f => {
              if (rawItem[f] !== undefined) projected[f] = rawItem[f];
            });
            projected._id = rawItem._id;
            return projected;
          });
        }
        return queryObj;
      },
      sort() { return queryObj; },
      skip(n) {
        list = list.slice(n);
        return queryObj;
      },
      limit(n) {
        list = list.slice(0, n);
        return queryObj;
      },
      then(resolve, reject) { return Promise.resolve(list).then(resolve, reject); },
      catch(reject) { return Promise.resolve(list).catch(reject); }
    };
    return queryObj;
  };

  AttendanceAuditLog.findById = function(id) {
    const found = mockAuditLogs.find(l => String(l._id) === String(id)) || mockAuditLogs[0] || null;
    return Promise.resolve(found);
  };

  AttendanceAuditLog.countDocuments = function(query) {
    let list = [...mockAuditLogs];
    if (query?.date?.$gte && query?.date?.$lte) {
      list = list.filter(l => l.date >= query.date.$gte && l.date <= query.date.$lte);
    }
    return Promise.resolve(list.length);
  };

  function matchesCond(r, cond) {
    if (cond.verification_status !== undefined) {
      if (typeof cond.verification_status === 'object' && cond.verification_status.$in) {
        if (!cond.verification_status.$in.includes(r.verification_status)) return false;
      } else if (typeof cond.verification_status === 'object' && cond.verification_status.$nin) {
        if (cond.verification_status.$nin.includes(r.verification_status)) return false;
      } else if (typeof cond.verification_status === 'object' && cond.verification_status.$ne) {
        if (r.verification_status === cond.verification_status.$ne) return false;
      } else if (r.verification_status !== cond.verification_status) {
        return false;
      }
    }
    if (cond.is_flagged !== undefined && r.is_flagged !== cond.is_flagged) {
      return false;
    }
    if (cond.selfie_url !== undefined) {
      if (cond.selfie_url.$exists && r.selfie_url === undefined) return false;
      if (cond.selfie_url.$nin?.includes(r.selfie_url)) return false;
      if (Object.hasOwn(cond.selfie_url, '$ne') && r.selfie_url === cond.selfie_url.$ne) return false;
    }
    if (cond.check_in_mode !== undefined && r.check_in_mode !== cond.check_in_mode) {
      return false;
    }
    if (cond.flag_reasons !== undefined) {
      if (!Array.isArray(r.flag_reasons) || r.flag_reasons.length === 0) return false;
      if (cond.flag_reasons.$in && !r.flag_reasons.some(reason => cond.flag_reasons.$in.includes(reason))) return false;
    }
    if (cond.flag_reason?.$regex && !cond.flag_reason.$regex.test(r.flag_reason || '')) return false;
    return true;
  }

  function matchesAttQuery(r, query) {
    if (!query) return true;
    if (query.user_id) {
      if (query.user_id.$in) {
        if (!query.user_id.$in.map(String).includes(String(r.user_id))) return false;
      } else if (String(r.user_id) !== String(query.user_id)) {
        return false;
      }
    }
    if (query.date) {
      if (typeof query.date === 'string') {
        if (r.date !== query.date) return false;
      } else if (query.date.$regex) {
        const re = new RegExp(query.date.$regex);
        if (!re.test(r.date)) return false;
      }
    }
    if (!matchesCond(r, query)) return false;
    if (query.$and) {
      for (const andCond of query.$and) {
        if (!matchesAttQuery(r, andCond)) return false;
      }
    }
    if (query.$or) {
      if (!query.$or.some(c => matchesAttQuery(r, c))) return false;
    }
    return true;
  }

  const originalAttCountDocuments = Attendance.countDocuments;
  Attendance.countDocuments = function(query) {
    const list = Array.from(mockSavedAttendanceMap.values()).filter(r => matchesAttQuery(r, query));
    return Promise.resolve(list.length);
  };

  Attendance.findOne = function(query) {
    let rec = null;
    if (query?.user_id && query?.date) {
      const key = `${query.user_id.toString()}_${query.date}`;
      rec = mockSavedAttendanceMap.get(key) || null;
    } else if (query?.user_id) {
      for (const [k, v] of mockSavedAttendanceMap.entries()) {
        if (k.startsWith(query.user_id.toString())) {
          rec = v;
          break;
        }
      }
    }
    const queryObj = {
      session(sess) {
        queryObj._session = sess;
        return queryObj;
      },
      populate() { return queryObj; },
      select() { return queryObj; },
      then(resolve, reject) { return Promise.resolve(rec).then(resolve, reject); },
      catch(reject) { return Promise.resolve(rec).catch(reject); }
    };
    return queryObj;
  };

  Attendance.find = function(query) {
    let list = Array.from(mockSavedAttendanceMap.values()).filter(r => matchesAttQuery(r, query));

    const queryObj = {
      populate() { return queryObj; },
      sort() { return queryObj; },
      skip() { return queryObj; },
      limit() { return queryObj; },
      select() { return queryObj; },
      then(resolve, reject) { return Promise.resolve(list).then(resolve, reject); },
      catch(reject) { return Promise.resolve(list).catch(reject); }
    };
    return queryObj;
  };

  Attendance.create = async function(data) {
    const raw = Array.isArray(data) ? data[0] : data;
    const doc = new Attendance(raw);
    await doc.validate();
    const key = `${(raw.user_id || '').toString()}_${raw.date || 'today'}`;
    doc.save = async function() {
      await this.validate();
      mockSavedAttendanceMap.set(key, this);
      return this;
    };
    mockSavedAttendanceMap.set(key, doc);
    return Array.isArray(data) ? [doc] : doc;
  };

  Attendance.prototype.save = async function() {
    await this.validate();
    const key = `${(this.user_id || '').toString()}_${this.date || 'today'}`;
    mockSavedAttendanceMap.set(key, this);
    return this;
  };

  try {
    // -------------------------------------------------------------
    // 1. Supertest: GET /api/users qua toàn bộ Middleware Pipeline
    // -------------------------------------------------------------

    // Case 1.1: Không có JWT Token -> 401 Unauthorized
    const resNoAuth = await request(app).get('/api/users');
    assert(resNoAuth.status === 401, 'TC-HTTP-01: GET /api/users không có Bearer token bị chặn 401 Unauthorized');

    // Case 1.2: Admin gọi GET /api/users -> 200 OK + Full Admin Fields
    const resAdmin = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(resAdmin.status === 200, 'TC-HTTP-02.1: Admin gọi GET /api/users qua Express pipeline trả về 200 OK');
    assert(resAdmin.body.length === 3, 'TC-HTTP-02.2: Admin nhận đủ 3 nhân sự công ty');
    assert(resAdmin.body[1].dob === '1995-05-05' && resAdmin.body[1].cccd === '987654321098',
      'TC-HTTP-02.3: Admin có toàn quyền truy xuất các trường HR tối mật (DOB, CCCD, Bank)');

    // Case 1.3: Leader gọi GET /api/users -> Team member có LEADER_TEAM_FIELDS, phòng khác có PUBLIC_DIRECTORY_FIELDS
    const resLeader = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${leaderToken}`);
    assert(resLeader.status === 200, 'TC-HTTP-03.1: Leader gọi GET /api/users trả về 200 OK');
    const itEmp = resLeader.body.find(u => u._id === '507f1f77bcf86cd799439013');
    const saleEmp = resLeader.body.find(u => u._id === '507f1f77bcf86cd799439014');

    assert(itEmp.phone === '0902' && itEmp.position === 'Dev IT 1',
      'TC-HTTP-03.2: Leader xem được trường quản trị công việc của thành viên trong team');
    assert(itEmp.cccd === undefined && itEmp.bank_account === undefined && itEmp.parking_location === '17T10',
      'TC-HTTP-03.3: DTO bảo vệ loại bỏ hoàn toàn CCCD, Ngân hàng trong khi vẫn duy trì thông tin xe tòa nhà');
    assert(saleEmp.full_name && saleEmp.email && saleEmp.dob === undefined && saleEmp.cccd === undefined,
      'TC-HTTP-03.4: Thành viên phòng ban khác (Sale) tự động chuyển sang Public Directory DTO');

    // Case 1.4: Employee gọi GET /api/users -> Toàn bộ danh sách là Public Directory DTO
    const resEmp = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert(resEmp.status === 200, 'TC-HTTP-04.1: Employee gọi GET /api/users trả về 200 OK');
    assert(resEmp.body[0].full_name && resEmp.body[0].email && resEmp.body[0].dob === undefined && resEmp.body[0].cccd === undefined && resEmp.body[0].parking_location !== undefined,
      'TC-HTTP-04.2: Employee nhận thông tin danh bạ & phương tiện gửi xe, ẩn 100% dữ liệu nhạy cảm');

    // -------------------------------------------------------------
    // 2. Supertest: PATCH /api/auth/profile
    // -------------------------------------------------------------

    // Case 2.1: Leader cập nhật họ tên & SĐT
    lastUpdatedData = null;
    const resProfLeader = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ full_name: 'Trưởng Phòng IT Mới', phone: '0988112233' });
    assert(resProfLeader.status === 200, 'TC-HTTP-05.1: Leader cập nhật profile qua HTTP PATCH trả về 200 OK');
    assert(lastUpdatedData.full_name === 'Trưởng Phòng IT Mới' && lastUpdatedData.phone === '0988112233',
      'TC-HTTP-05.2: Họ tên và SĐT mới được lưu chính xác vào DB');

    // Case 2.1b: Employee tự cập nhật thông tin ngân hàng của chính mình
    lastUpdatedData = null;
    const resProfBank = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ bank_name: 'MB Bank', bank_account: ' 0123456789 ', branch: 'Thanh Xuân' });
    assert(resProfBank.status === 200, 'TC-HTTP-05.3: Employee tự cập nhật thông tin ngân hàng trả về 200 OK');
    assert(lastUpdatedData.bank_name === 'MB Bank' && lastUpdatedData.bank_account === '0123456789' && lastUpdatedData.branch === 'Thanh Xuân',
      'TC-HTTP-05.4: Backend chuẩn hóa và lưu đúng thông tin ngân hàng vào chính tài khoản đang đăng nhập');
    assert(resProfBank.body.user.bank_account === '0123456789',
      'TC-HTTP-05.5: Response hồ sơ cá nhân trả lại số tài khoản mới để giao diện đồng bộ ngay');

    // Case 2.2: Non-admin gửi kèm trường xe -> Server lưu profile an toàn và trả thông báo rõ ràng
    lastUpdatedData = null;
    const resProfHack = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ full_name: 'Dev IT', parking_location: 'Gửi VIP 17T10' });
    assert(resProfHack.status === 200, 'TC-HTTP-06.1: Non-Admin gửi trường xe không gây lỗi 500');
    assert(lastUpdatedData.parking_location === undefined,
      'TC-HTTP-06.2: Backend từ chối ghi đè trường parking_location từ Non-Admin vào DB');
    assert(resProfHack.body.message.includes('Đơn đổi xe'),
      'TC-HTTP-06.3: Response thông báo rõ ràng cho user cần nộp Đơn đổi xe để Admin phê duyệt');

    // -------------------------------------------------------------
    // 3. Supertest: PUT /api/attendance/override/:id (Admin only)
    // -------------------------------------------------------------

    // Case 3.1: Leader gọi override giờ công -> 403 Forbidden qua Middleware
    const resOverrideLeader = await request(app)
      .put('/api/attendance/override/507f1f77bcf86cd799439099')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ check_in: '08:30', check_out: '17:30' });
    assert(resOverrideLeader.status === 403,
      'TC-HTTP-07: Leader gọi PUT /api/attendance/override/:id bị middleware requireRole chặn 403 Forbidden');

    // -------------------------------------------------------------
    // 4. Supertest: POST /api/attendance/checkin Pipeline & Anti-Fraud
    // -------------------------------------------------------------

    // Case 4.1: Check-in thiếu GPS -> 400 Bad Request
    const resNoGps = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ type: 'office' });
    assert(resNoGps.status === 400 && resNoGps.body.gps_required === true,
      'TC-HTTP-08: POST /api/attendance/checkin thiếu GPS bị chặn 400 và yêu cầu bật GPS');

    // Case 4.2: Check-in tọa độ hợp lệ (trong văn phòng) -> 200/201 OK
    const resOfficeCheckIn = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: 21.0285, lng: 105.8542, type: 'office', note: 'Check-in chuẩn' });
    assert((resOfficeCheckIn.status === 200 || resOfficeCheckIn.status === 201) && resOfficeCheckIn.body.attendance,
      'TC-HTTP-09: POST /api/attendance/checkin thành công trong văn phòng qua Supertest pipeline');

    // Case 4.3: Check-in WFH ngoài văn phòng -> 200 OK và lưu đúng check_in_type="wfh"
    const resWfhCheckIn = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: 20.95, lng: 105.75, type: 'wfh', note: 'Làm việc từ xa WFH' });
    assert(resWfhCheckIn.status === 200 && resWfhCheckIn.body.attendance.check_in_type === 'wfh',
      'TC-HTTP-10: POST /api/attendance/checkin WFH lưu đúng check_in_type="wfh" và tính đủ công');

    // Case 4.4: Check-in tọa độ 0, 0 -> Xử lý số hợp lệ
    const resZeroCoord = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: 0, lng: 0, type: 'wfh' });
    assert(resZeroCoord.status === 200,
      'TC-HTTP-11: POST /api/attendance/checkin với tọa độ 0,0 được xử lý số hợp lệ');

    // Case 4.5: Check-in lat/lng null -> 400 Bad Request
    const resNullCoord = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: null, lng: null, type: 'office' });
    assert(resNullCoord.status === 400 && resNullCoord.body.gps_required === true,
      'TC-HTTP-12: POST /api/attendance/checkin với lat/lng null bị chặn 400 và yêu cầu GPS');

    // Case 4.6: Check-in lat/lng chuỗi rỗng -> 400 Bad Request
    const resEmptyCoord = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: '', lng: '', type: 'office' });
    assert(resEmptyCoord.status === 400 && resEmptyCoord.body.gps_required === true,
      'TC-HTTP-13: POST /api/attendance/checkin với lat/lng chuỗi rỗng bị chặn 400 và yêu cầu GPS');

    // Case 4.7: Check-in lat/lng khoảng trắng -> 400 Bad Request
    const resWhitespaceCoord = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: '   ', lng: '   ', type: 'office' });
    assert(resWhitespaceCoord.status === 400 && resWhitespaceCoord.body.gps_required === true,
      'TC-HTTP-14: POST /api/attendance/checkin với lat/lng khoảng trắng bị chặn 400');

    // Case 4.8: Check-in lat/lng chuỗi chữ không hợp lệ -> 400 Bad Request
    const resNaNCoord = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lat: 'invalid_lat', lng: 'invalid_lng', type: 'office' });
    assert(resNaNCoord.status === 400 && resNaNCoord.body.gps_required === true,
      'TC-HTTP-15: POST /api/attendance/checkin với lat/lng NaN bị chặn 400');

    // =========================================================================
    // 5. PROJECT CONTROLLER: Supertest kiểm thử nhận diện PM dự án (Codex Review)
    // =========================================================================
    const userNamEmp = {
      _id: '507f1f77bcf86cd799439099',
      employee_code: 'NS-099',
      full_name: 'Nguyễn Văn Nam',
      role: 'employee',
      email: 'nam_nv@company.com',
      is_active: true,
      toObject() { return { ...this }; }
    };
    const namEmpToken = generateTestToken(userNamEmp);

    const originalProjFind = Project.find;
    let capturedProjQuery = null;
    let capturedProjectSelect = null;
    let capturedProjectPopulates = [];

    Project.find = function(query) {
      capturedProjQuery = query;
      const queryChain = {
        select(fields) {
          capturedProjectSelect = fields;
          return queryChain;
        },
        populate(path, fields) {
          capturedProjectPopulates.push({ path, fields });
          return queryChain;
        },
        sort() {
          return queryChain;
        },
        limit() {
          return queryChain;
        },
        lean() {
          return Promise.resolve([
            { _id: 'proj_01', name: 'Dự án Của Nam NV', pm_id: '507f1f77bcf86cd799439099', pm_name: 'Nguyễn Văn Nam' }
          ]);
        },
        then(resolve, reject) {
          return Promise.resolve([
            { _id: 'proj_01', name: 'Dự án Của Nam NV', pm_id: '507f1f77bcf86cd799439099', pm_name: 'Nguyễn Văn Nam' }
          ]).then(resolve, reject);
        },
        catch(reject) {
          return Promise.resolve([
            { _id: 'proj_01', name: 'Dự án Của Nam NV', pm_id: '507f1f77bcf86cd799439099', pm_name: 'Nguyễn Văn Nam' }
          ]).catch(reject);
        }
      };
      return queryChain;
    };

    const resProjList = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${namEmpToken}`);
    assert(resProjList.status === 200, 'TC-HTTP-16.1: GET /api/projects trả về 200 OK');

    // Kiểm tra cấu trúc truy vấn MongoDB đã được sửa an toàn tuyệt đối
    const pmNameCond = capturedProjQuery?.$or?.find(c => c.$and);
    assert(pmNameCond !== undefined, 'TC-HTTP-16.2: Truy vấn $or có điều kiện $and bọc pm_name và pm_id null check');
    assert(pmNameCond.$and[0].$or[0].pm_id === null, 'TC-HTTP-16.3: Bắt buộc pm_id là null hoặc không tồn tại mới đối chiếu pm_name');

    capturedProjectSelect = null;
    capturedProjectPopulates = [];
    const resCompactProjects = await request(app)
      .get('/api/projects?compact=true')
      .set('Authorization', `Bearer ${namEmpToken}`);
    assert(resCompactProjects.status === 200 && capturedProjectSelect?.includes('avatar_url'),
      'TC-HTTP-16.4: GET /api/projects?compact=true chỉ chọn tập trường dự án cần cho Dashboard');
    assert(capturedProjectPopulates.every(item => !item.fields.includes('avatar_url') && !item.fields.includes('phone')),
      'TC-HTTP-16.5: Chế độ compact không tải avatar/điện thoại lặp lại của thành viên dự án');

    // =========================================================================
    // 6. TIMESHEET LOCK CONTROLLER: Supertest kiểm thử overrideCell (Codex Review)
    // =========================================================================
    const originalAuditLogCreate = AttendanceAuditLog.create;
    AttendanceAuditLog.create = function(data) {
      return Promise.resolve({ _id: 'audit_log_01', ...data });
    };

    // TC-HTTP-17: Từ chối Ký hiệu lạ "ABC" -> 400 Bad Request
    const resInvalidSymbol = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: 'ABC',
        reason: 'Sửa nhầm',
      });
    assert(resInvalidSymbol.status === 400 && resInvalidSymbol.body.error.includes('Ký hiệu công không hợp lệ'),
      'TC-HTTP-17: POST /api/timesheet-lock/override-cell từ chối ký hiệu lạ ABC với 400 Bad Request');

    // TC-HTTP-18: Kiểm tra giới hạn Giờ OT (0..16, bước 0.5)
    const resNegativeOt = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: 'x',
        ot_hours: -4,
        reason: 'OT âm',
      });
    assert(resNegativeOt.status === 400 && resNegativeOt.body.error.includes('Số giờ OT không hợp lệ'),
      'TC-HTTP-18.1: POST /api/timesheet-lock/override-cell từ chối OT âm với 400 Bad Request');

    const resOverflowOt = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: 'x',
        ot_hours: 24,
        reason: 'OT quá 16h',
      });
    assert(resOverflowOt.status === 400 && resOverflowOt.body.error.includes('Số giờ OT không hợp lệ'),
      'TC-HTTP-18.2: POST /api/timesheet-lock/override-cell từ chối OT > 16h với 400 Bad Request');

    const resFractionOt = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: 'x',
        ot_hours: 1.23,
        reason: 'OT không theo bước 0.5',
      });
    assert(resFractionOt.status === 400 && resFractionOt.body.error.includes('Số giờ OT không hợp lệ'),
      'TC-HTTP-18.3: POST /api/timesheet-lock/override-cell từ chối OT không phải bước 0.5 với 400 Bad Request');

    // Chấp nhận ký hiệu hợp lệ '0,75x' và OT hợp lệ 2.5h
    const resValidOverride = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: '0,75x',
        ot_hours: 2.5,
        reason: 'Làm việc 6h và tăng ca 2.5h',
      });
    assert(resValidOverride.status === 200,
      'TC-HTTP-18.4: POST /api/timesheet-lock/override-cell chấp nhận ký hiệu "0,75x" và OT "2.5h"');

    // TC-HTTP-18.5: Chủ nhật / Ngày chỉ tính OT với new_symbol="" -> work_units=0, total_hours=0, ot_hours=3.5
    const resSundayOtOnly = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-23', // Sunday
        new_symbol: '',
        ot_hours: 3.5,
        reason: 'Tăng ca Chủ nhật trực ca khẩn cấp',
      });
    assert(
      resSundayOtOnly.status === 200 &&
        resSundayOtOnly.body.attendance.date === '2026-08-23' &&
        resSundayOtOnly.body.attendance.work_units === 0 &&
        resSundayOtOnly.body.attendance.total_hours === 0 &&
        resSundayOtOnly.body.attendance.ot_hours === 3.5 &&
        resSundayOtOnly.body.attendance.check_in_time === null &&
        resSundayOtOnly.body.attendance.check_out_time === null &&
        resSundayOtOnly.body.attendance.late_minutes === 0 &&
        resSundayOtOnly.body.attendance.early_minutes === 0 &&
        resSundayOtOnly.body.attendance.status === 'absent',
      'TC-HTTP-18.5: POST /api/timesheet-lock/override-cell cho phép ngày chỉ tính OT (0 công thường, status=absent, +3.5h OT)'
    );

    // TC-HTTP-18.6: new_symbol bị thiếu (undefined) -> 400 Bad Request (không tự ý xóa công của user)
    const resMissingSymbol = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        reason: 'Thiếu new_symbol',
      });
    assert(
      resMissingSymbol.status === 400 && resMissingSymbol.body.error.includes('Ký hiệu công là bắt buộc'),
      'TC-HTTP-18.6: POST /api/timesheet-lock/override-cell từ chối request thiếu new_symbol với 400 Bad Request'
    );

    // TC-HTTP-18.7: new_symbol là null -> 400 Bad Request
    const resNullSymbol = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-20',
        new_symbol: null,
        reason: 'new_symbol là null',
      });
    assert(
      resNullSymbol.status === 400 && resNullSymbol.body.error.includes('Ký hiệu công là bắt buộc'),
      'TC-HTTP-18.7: POST /api/timesheet-lock/override-cell từ chối new_symbol=null với 400 Bad Request'
    );

    // TC-HTTP-18.8: Override bản ghi nghi vấn pending_review về rỗng (0 công) -> Giải quyết cảnh báo sang 'rejected', lưu reviewer note và snapshot forensic trong AuditLog
    const keyExisting = `${mockEmpUser._id.toString()}_2026-08-19`;
    const existingAttendanceDoc = new Attendance({
      user_id: mockEmpUser._id,
      date: '2026-08-19',
      check_in_time: new Date('2026-08-19T08:15:00.000Z'),
      check_out_time: new Date('2026-08-19T17:30:00.000Z'),
      check_in_type: 'office',
      check_in_lat: 21.0285,
      check_in_lng: 105.8542,
      is_late: true,
      late_minutes: 15,
      total_hours: 8,
      work_units: 1.0,
      status: 'present',
      notes: 'Đi làm bình thường',
      is_flagged: true,
      flag_reasons: ['MULTI_ACCOUNT_SAME_DEVICE', 'DEVICE_UNTRUSTED'],
      selfie_url: 'https://example.com/selfie-evidence.jpg',
      hardware_uuid: 'hw-uuid-12345-anti-fraud',
      verification_status: 'pending_review',
    });
    existingAttendanceDoc.save = async function() {
      await this.validate();
      mockSavedAttendanceMap.set(keyExisting, this);
      return this;
    };
    mockSavedAttendanceMap.set(keyExisting, existingAttendanceDoc);

    const resClearExisting = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: '',
        ot_hours: 2,
        reason: 'Hủy công ngày do gian lận, chuyển thành 2h OT',
      });

    assert(
      resClearExisting.status === 200 &&
        resClearExisting.body.attendance.check_in_time === null &&
        resClearExisting.body.attendance.check_out_time === null &&
        resClearExisting.body.attendance.is_late === false &&
        resClearExisting.body.attendance.late_minutes === 0 &&
        resClearExisting.body.attendance.work_units === 0 &&
        resClearExisting.body.attendance.total_hours === 0 &&
        resClearExisting.body.attendance.status === 'absent' &&
        resClearExisting.body.attendance.ot_hours === 2 &&
        resClearExisting.body.attendance.check_in_lat === 21.0285 &&
        resClearExisting.body.attendance.check_in_lng === 105.8542 &&
        resClearExisting.body.attendance.selfie_url === 'https://example.com/selfie-evidence.jpg' &&
        resClearExisting.body.attendance.hardware_uuid === 'hw-uuid-12345-anti-fraud' &&
        resClearExisting.body.attendance.is_flagged === false &&
        resClearExisting.body.attendance.verification_status === 'rejected' &&
        resClearExisting.body.attendance.reviewed_by !== null &&
        resClearExisting.body.attendance.reviewer_note.includes('Admin điều chỉnh ô công (0 công)') &&
        resClearExisting.body.audit_log?.snapshot_before?.check_in_time !== null &&
        resClearExisting.body.audit_log?.snapshot_before?.selfie_url === 'https://example.com/selfie-evidence.jpg',
      'TC-HTTP-18.8: POST /api/timesheet-lock/override-cell giải quyết pending_review sang rejected, bảo lưu 100% forensic evidence và lưu snapshot_before trong AuditLog'
    );

    // TC-HTTP-18.8b: Override bản ghi pending_review sang ký hiệu hợp lệ "x" -> Giải quyết cảnh báo sang 'approved' kèm reviewer note
    const keyApprovedFlag = `${mockEmpUser._id.toString()}_2026-08-17`;
    const flaggedApprovedDoc = new Attendance({
      user_id: mockEmpUser._id,
      date: '2026-08-17',
      check_in_time: new Date('2026-08-17T08:30:00.000Z'),
      check_out_time: new Date('2026-08-17T17:30:00.000Z'),
      check_in_type: 'office',
      is_late: false,
      late_minutes: 0,
      total_hours: 8,
      work_units: 1.0,
      status: 'present',
      is_flagged: true,
      flag_reasons: ['GPS_OUTSIDE_GEOFENCE'],
      selfie_url: 'https://example.com/selfie-outside.jpg',
      verification_status: 'pending_review',
    });
    flaggedApprovedDoc.save = async function() {
      await this.validate();
      mockSavedAttendanceMap.set(keyApprovedFlag, this);
      return this;
    };
    mockSavedAttendanceMap.set(keyApprovedFlag, flaggedApprovedDoc);

    const resApproveFlagged = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-17',
        new_symbol: 'x',
        reason: 'Xác nhận đi công tác ngoài văn phòng, duyệt 1 công',
      });

    assert(
      resApproveFlagged.status === 200 &&
        resApproveFlagged.body.attendance.is_flagged === false &&
        resApproveFlagged.body.attendance.verification_status === 'approved' &&
        resApproveFlagged.body.attendance.selfie_url === 'https://example.com/selfie-outside.jpg' &&
        resApproveFlagged.body.attendance.reviewer_note.includes('Admin điều chỉnh & phê duyệt công [x]'),
      'TC-HTTP-18.8b: POST /api/timesheet-lock/override-cell giải quyết pending_review sang approved khi Admin gán ký hiệu công hợp lệ'
    );

    // TC-HTTP-18.9: Nhánh cập nhật bản ghi hiện hữu gọi validate() và bắt chặt vi phạm schema enum
    const docWithInvalidEnum = new Attendance({
      user_id: mockEmpUser._id,
      date: '2026-08-18',
      check_in_type: 'office',
      status: 'present',
    });
    docWithInvalidEnum.save = async function() {
      await this.validate();
      return this;
    };
    docWithInvalidEnum.status = 'invalid_unknown_status_enum';
    let schemaValidationThrew = false;
    try {
      await docWithInvalidEnum.save();
    } catch (valErr) {
      schemaValidationThrew = valErr?.name === 'ValidationError';
    }
    assert(
      schemaValidationThrew === true,
      'TC-HTTP-18.9: Nhánh cập nhật bản ghi hiện hữu gọi validate() và bắt chặt vi phạm schema enum'
    );

    // -------------------------------------------------------------
    // 5. Supertest: GET /api/dashboard/today Thống kê đa trạng thái
    // -------------------------------------------------------------
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    // Tạo 1 bản ghi OT-only ngày hôm nay cho mockEmpUser
    const keyToday = `${mockEmpUser._id.toString()}_${todayStr}`;
    const todayDoc = new Attendance({
      user_id: mockEmpUser._id,
      date: todayStr,
      check_in_type: 'office',
      check_in_time: null,
      check_out_time: null,
      total_hours: 0,
      work_units: 0,
      ot_hours: 3,
      status: 'absent',
    });
    todayDoc.save = async function() {
      await this.validate();
      mockSavedAttendanceMap.set(keyToday, this);
      return this;
    };
    mockSavedAttendanceMap.set(keyToday, todayDoc);

    const resDash = await request(app)
      .get('/api/dashboard/today')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      resDash.status === 200 &&
        resDash.body.summary &&
        resDash.body.summary.checked_in + resDash.body.summary.checked_out + resDash.body.summary.leave + resDash.body.summary.holiday + resDash.body.summary.absent === resDash.body.summary.total,
      'TC-HTTP-19: GET /api/dashboard/today trả về đúng cấu trúc summary đa trạng thái và tổng các nhóm khớp 100% total'
    );

    // -------------------------------------------------------------
    // 6. Supertest: GET /api/attendance/flagged Thống kê độc lập với filter tab
    // -------------------------------------------------------------
    // Thêm 1 bản ghi pending_review ngày 2026-08-16
    const keyPendingFlag = `${mockEmpUser._id.toString()}_2026-08-16`;
    const pendingFlagDoc = new Attendance({
      user_id: mockEmpUser._id,
      date: '2026-08-16',
      check_in_time: new Date('2026-08-16T08:30:00.000Z'),
      check_in_type: 'office',
      is_flagged: true,
      flag_reasons: ['MULTI_ACCOUNT_SAME_DEVICE'],
      selfie_url: 'https://example.com/pending-selfie.jpg',
      verification_status: 'pending_review',
    });
    pendingFlagDoc.save = async function() {
      await this.validate();
      mockSavedAttendanceMap.set(keyPendingFlag, this);
      return this;
    };
    mockSavedAttendanceMap.set(keyPendingFlag, pendingFlagDoc);

    const resFlaggedPending = await request(app)
      .get('/api/attendance/flagged?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      resFlaggedPending.status === 200 &&
        Array.isArray(resFlaggedPending.body.flagged) &&
        resFlaggedPending.body.flagged.length === 1 &&
        resFlaggedPending.body.flagged[0].date === '2026-08-16' &&
        resFlaggedPending.body.counts.pending === 1 &&
        resFlaggedPending.body.counts.approved === 1 &&
        resFlaggedPending.body.counts.rejected === 1 &&
        resFlaggedPending.body.counts.total === 3 &&
        resFlaggedPending.body.counts.total > resFlaggedPending.body.flagged.length,
      'TC-HTTP-20: GET /api/attendance/flagged lọc đúng danh sách theo tab và trả về counts.total độc lập không phụ thuộc tab đang chọn'
    );

    // Leave rows must not become verification cases; real evidence stays visible.
    const attendanceBeforeFilterTests = new Map(mockSavedAttendanceMap);
    const userFindBeforeFilterTests = User.find;
    try {
      const addFilterFixture = (date, fields = {}) => {
        const doc = new Attendance({ user_id: mockEmpUser._id, date, check_in_type: 'office', ...fields });
        mockSavedAttendanceMap.set(`${doc.user_id}_${date}`, doc);
        return String(doc._id);
      };
      const normalIds = ['05', '06', '07', '08'].map(day => addFilterFixture(`2026-09-${day}`, {
        status: 'leave', work_units: 0, notes: 'Được duyệt một đơn nghỉ từ 05/09 đến 08/09',
      }));
      normalIds.push(addFilterFixture('2026-09-09', { check_in_time: new Date('2026-09-09T02:00:00Z') }));
      for (const [index, selfie_url] of ['', 'null', 'undefined'].entries()) {
        normalIds.push(addFilterFixture(`2026-09-${10 + index}`, { selfie_url }));
      }
      const photoId = addFilterFixture('2026-09-13', { selfie_url: 'https://example.com/auto-selfie.jpg' });
      const leaveFlagId = addFilterFixture('2026-09-14', {
        status: 'leave', is_flagged: true, verification_status: 'pending_review',
        flag_reasons: ['DEVICE_UNTRUSTED'],
      });
      const rejectedId = addFilterFixture('2026-09-15', {
        is_flagged: true, verification_status: 'rejected', flag_reasons: ['DEVICE_UNTRUSTED'],
      });
      const legacyDeviceId = addFilterFixture('2026-09-16', { flag_reason: 'Thiết bị cần kiểm tra' });
      const locationId = addFilterFixture('2026-09-17', {
        is_flagged: true, verification_status: 'pending_review', flag_reasons: ['SUSPICIOUS_LOCATION'],
      });
      const fetchCases = (query, token = adminToken) => request(app)
        .get(`/api/attendance/flagged${query ? `?${query}` : ''}`)
        .set('Authorization', `Bearer ${token}`);
      const ids = response => (response.body.flagged || []).map(row => String(row._id));
      const allCases = await fetchCases('status=all');
      const expectedEvidence = [photoId, leaveFlagId, rejectedId, legacyDeviceId, locationId];
      assert(allCases.status === 200 && allCases.body.counts.total === 8 && ids(allCases).length === 8 &&
        normalIds.every(id => !ids(allCases).includes(id)) && expectedEvidence.every(id => ids(allCases).includes(id)),
      'TC-HTTP-20.1: Tất cả loại ngày nghỉ và ca thường, giữ ca có bằng chứng kể cả ngày nghỉ');
      const defaultCases = await fetchCases('');
      assert(defaultCases.status === 200 && JSON.stringify(ids(defaultCases)) === JSON.stringify(ids(allCases)),
        'TC-HTTP-20.2: Không truyền tab cũng chỉ trả hồ sơ xác minh');
      const tabCounts = { pending: 'pending', approved: 'approved', rejected: 'rejected', photo: 'with_photo', device: 'with_device' };
      for (const [tab, countKey] of Object.entries(tabCounts)) {
        const result = await fetchCases(`status=${tab}`);
        assert(result.status === 200 && ids(result).length === allCases.body.counts[countKey] &&
          normalIds.every(id => !ids(result).includes(id)) &&
          JSON.stringify(result.body.counts) === JSON.stringify(allCases.body.counts),
        `TC-HTTP-20.3-${tab}: Danh sách khớp số đếm và số đếm độc lập với tab`);
        if (tab === 'pending') {
          assert(ids(result).includes(leaveFlagId) && ids(result).includes(locationId) &&
            !ids(result).includes(rejectedId) && !ids(result).includes(photoId),
          'TC-HTTP-20.4: Ca bị từ chối hoặc selfie tự động xác nhận không tính là chờ duyệt');
        }
        if (tab === 'photo' || tab === 'device') {
          const explicitFilter = await fetchCases(`filter=${tab}`);
          assert(JSON.stringify(ids(explicitFilter)) === JSON.stringify(ids(result)) &&
            (tab === 'photo' ? ids(result).includes(photoId) && !ids(result).includes(leaveFlagId) :
              ids(result).includes(legacyDeviceId) && !ids(result).includes(locationId)),
          `TC-HTTP-20.5-${tab}: Bộ lọc mới và tham số tương thích cũ cùng trả đúng loại bằng chứng`);
        }
      }
      const pendingDevices = await fetchCases('status=pending&filter=device');
      assert(pendingDevices.status === 200 && ids(pendingDevices).includes(leaveFlagId) &&
        !ids(pendingDevices).includes(rejectedId) && !ids(pendingDevices).includes(locationId),
      'TC-HTTP-20.6: Kết hợp chờ duyệt và thiết bị không ghi đè điều kiện lọc');
      const countsOnly = await fetchCases('counts_only=true&filter=device');
      assert(countsOnly.status === 200 && ids(countsOnly).length === 0 &&
        JSON.stringify(countsOnly.body.counts) === JSON.stringify(allCases.body.counts),
      'TC-HTTP-20.7: Chỉ tải số đếm vẫn thống nhất với toàn bộ danh sách');
      const outsideTeamId = addFilterFixture('2026-09-18', {
        user_id: userNamEmp._id, is_flagged: true, verification_status: 'pending_review',
      });
      User.find = () => ({ distinct: async () => [mockEmpUser._id] });
      const leaderCases = await fetchCases('status=all', leaderToken);
      assert(leaderCases.status === 200 && leaderCases.body.counts.total === 8 &&
        !ids(leaderCases).includes(outsideTeamId) && expectedEvidence.every(id => ids(leaderCases).includes(id)),
      'TC-HTTP-20.8: Leader chỉ nhận danh sách và số đếm của nhân sự trong phạm vi');
      const employeeCases = await fetchCases('status=all', employeeToken);
      assert(employeeCases.status === 403, 'TC-HTTP-20.9: Nhân viên không được truy cập danh sách cảnh báo');
    } finally {
      User.find = userFindBeforeFilterTests;
      mockSavedAttendanceMap.clear();
      attendanceBeforeFilterTests.forEach((doc, key) => mockSavedAttendanceMap.set(key, doc));
    }

    // -------------------------------------------------------------
    // 7. Supertest: POST /api/timesheet-lock/override-cell Atomic Rollback & Mongo Transactions
    // -------------------------------------------------------------

    // 7.1: Compensatory In-Memory Rollback (Hoàn nguyên 100% snapshot khi ghi audit log lỗi)
    const fullSnapshotBefore = {
      status: existingAttendanceDoc.status,
      total_hours: existingAttendanceDoc.total_hours,
      work_units: existingAttendanceDoc.work_units,
      ot_hours: existingAttendanceDoc.ot_hours,
      is_late: existingAttendanceDoc.is_late,
      late_minutes: existingAttendanceDoc.late_minutes,
      is_early_leave: existingAttendanceDoc.is_early_leave,
      early_minutes: existingAttendanceDoc.early_minutes,
      check_in_time: existingAttendanceDoc.check_in_time,
      check_out_time: existingAttendanceDoc.check_out_time,
      check_in_lat: existingAttendanceDoc.check_in_lat,
      check_in_lng: existingAttendanceDoc.check_in_lng,
      selfie_url: existingAttendanceDoc.selfie_url,
      hardware_uuid: existingAttendanceDoc.hardware_uuid,
      is_flagged: existingAttendanceDoc.is_flagged,
      verification_status: existingAttendanceDoc.verification_status,
      reviewer_note: existingAttendanceDoc.reviewer_note,
    };

    const savedAuditCreate = AttendanceAuditLog.create;
    AttendanceAuditLog.create = async function() {
      throw new Error('SIMULATED_DB_AUDIT_LOG_FAILURE');
    };

    const resFailedAudit = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác gây lỗi audit log để test compensatory rollback',
      });

    assert(
      resFailedAudit.status === 500 &&
        resFailedAudit.body.error.includes('đã được khôi phục trạng thái ban đầu') &&
        existingAttendanceDoc.status === fullSnapshotBefore.status &&
        existingAttendanceDoc.total_hours === fullSnapshotBefore.total_hours &&
        existingAttendanceDoc.work_units === fullSnapshotBefore.work_units &&
        existingAttendanceDoc.ot_hours === fullSnapshotBefore.ot_hours &&
        existingAttendanceDoc.is_late === fullSnapshotBefore.is_late &&
        existingAttendanceDoc.late_minutes === fullSnapshotBefore.late_minutes &&
        existingAttendanceDoc.is_early_leave === fullSnapshotBefore.is_early_leave &&
        existingAttendanceDoc.early_minutes === fullSnapshotBefore.early_minutes &&
        existingAttendanceDoc.check_in_time === fullSnapshotBefore.check_in_time &&
        existingAttendanceDoc.check_out_time === fullSnapshotBefore.check_out_time &&
        existingAttendanceDoc.check_in_lat === fullSnapshotBefore.check_in_lat &&
        existingAttendanceDoc.check_in_lng === fullSnapshotBefore.check_in_lng &&
        existingAttendanceDoc.selfie_url === fullSnapshotBefore.selfie_url &&
        existingAttendanceDoc.hardware_uuid === fullSnapshotBefore.hardware_uuid &&
        existingAttendanceDoc.is_flagged === fullSnapshotBefore.is_flagged &&
        existingAttendanceDoc.verification_status === fullSnapshotBefore.verification_status &&
        existingAttendanceDoc.reviewer_note === fullSnapshotBefore.reviewer_note,
      'TC-HTTP-21.1: Ghi Audit Log thất bại -> Kích hoạt Compensatory Rollback, bản ghi Attendance được hoàn nguyên 100% snapshot'
    );

    // 7.2: Compensatory Rollback thất bại -> Phát cảnh báo toàn vẹn dữ liệu nghiêm trọng (integrity_warning: true)
    const savedDocSave = existingAttendanceDoc.save;
    existingAttendanceDoc.save = async function() {
      throw new Error('SIMULATED_DISK_IO_CORRUPTION');
    };

    const resFatalRollback = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác gây lỗi kép cả audit log lẫn rollback',
      });

    assert(
      resFatalRollback.status === 500 &&
        resFatalRollback.body.integrity_warning === true &&
        resFatalRollback.body.error.includes('Lỗi nghiêm trọng: Quá trình cập nhật thất bại và không thể hoàn nguyên'),
      'TC-HTTP-21.2: Rollback thất bại -> Trả về cảnh báo toàn vẹn dữ liệu nghiêm trọng (integrity_warning: true) và không khẳng định sai là đã phục hồi'
    );

    existingAttendanceDoc.save = savedDocSave;
    AttendanceAuditLog.create = savedAuditCreate;

    // 7.3: Mongoose Transaction Lifecycle & Session Passing (Commit & Abort Branches)
    const sessionCalls = {
      startTransaction: 0,
      commitTransaction: 0,
      abortTransaction: 0,
      endSession: 0,
    };
    const fakeSession = {
      startTransaction() { sessionCalls.startTransaction++; },
      commitTransaction() { sessionCalls.commitTransaction++; },
      abortTransaction() { sessionCalls.abortTransaction++; },
      endSession() { sessionCalls.endSession++; },
    };

    let sessionPassedToFindOne = null;
    let sessionPassedToSave = null;
    let sessionPassedToAudit = null;

    const savedAttFindOne = Attendance.findOne;
    Attendance.findOne = function(query) {
      const q = savedAttFindOne(query);
      const origSession = q.session;
      q.session = function(sess) {
        sessionPassedToFindOne = sess;
        return origSession ? origSession.call(q, sess) : q;
      };
      return q;
    };

    const savedPrototypeSave = Attendance.prototype.save;
    const savedInstanceSave = existingAttendanceDoc.save;
    const saveWithSessionTracking = async function(opts) {
      if (opts?.session) sessionPassedToSave = opts.session;
      await this.validate();
      const key = `${(this.user_id || '').toString()}_${this.date || 'today'}`;
      mockSavedAttendanceMap.set(key, this);
      return this;
    };
    Attendance.prototype.save = saveWithSessionTracking;
    existingAttendanceDoc.save = saveWithSessionTracking;

    const savedAuditCreateTracking = AttendanceAuditLog.create;
    AttendanceAuditLog.create = async function(data, opts) {
      if (opts?.session) sessionPassedToAudit = opts.session;
      return savedAuditCreateTracking(data, opts);
    };

    // Bật chế độ Mongoose Transaction
    mongoose.connection = mongoose.connection || {};
    mongoose.connection.readyState = 1;
    mongoose.startSession = async function() {
      return fakeSession;
    };

    // Case 21.3a: Giao dịch thành công -> startTransaction, truyền session vào findOne, save & audit, commit & endSession
    const resTxSuccess = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác chạy trong MongoDB transaction',
      });

    assert(
      resTxSuccess.status === 200 &&
        sessionCalls.startTransaction === 1 &&
        sessionCalls.commitTransaction === 1 &&
        sessionCalls.endSession === 1 &&
        sessionCalls.abortTransaction === 0 &&
        sessionPassedToFindOne === fakeSession &&
        sessionPassedToSave === fakeSession &&
        sessionPassedToAudit === fakeSession,
      'TC-HTTP-21.3: Mongo Transaction thành công -> Khởi tạo session, truyền cùng session vào Attendance.findOne, Attendance.save & AuditLog, commitTransaction & endSession đúng vòng đời'
    );

    // Case 21.3b: Lỗi trong transaction -> abortTransaction & endSession
    sessionCalls.startTransaction = 0;
    sessionCalls.commitTransaction = 0;
    sessionCalls.abortTransaction = 0;
    sessionCalls.endSession = 0;

    AttendanceAuditLog.create = async function() {
      throw new Error('SIMULATED_TRANSACTION_AUDIT_FAILURE');
    };

    const resTxAbort = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác gây abort transaction',
      });

    assert(
      resTxAbort.status === 500 &&
        sessionCalls.startTransaction === 1 &&
        sessionCalls.abortTransaction === 1 &&
        sessionCalls.endSession === 1 &&
        sessionCalls.commitTransaction === 0,
      'TC-HTTP-21.4: Lỗi trong Mongo Transaction -> abortTransaction & endSession được kích hoạt lập tức để rollback atomicity trên Atlas'
    );

    // Case 21.5: commitTransaction thành công nhưng endSession ném lỗi -> Trả về HTTP 200 thành công, không gọi abort hoặc báo sai lỗi rollback
    AttendanceAuditLog.create = savedAuditCreateTracking;
    sessionCalls.startTransaction = 0;
    sessionCalls.commitTransaction = 0;
    sessionCalls.abortTransaction = 0;
    sessionCalls.endSession = 0;

    fakeSession.endSession = function() {
      sessionCalls.endSession++;
      throw new Error('SIMULATED_SOCKET_CLOSE_CLEANUP_ERROR');
    };

    const resCommitWithEndSessionError = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác commit thành công nhưng endSession gặp lỗi đóng socket',
      });

    assert(
      resCommitWithEndSessionError.status === 200 &&
        sessionCalls.commitTransaction === 1 &&
        sessionCalls.endSession === 1 &&
        sessionCalls.abortTransaction === 0,
      'TC-HTTP-21.5: commitTransaction thành công nhưng endSession lỗi -> Dữ liệu được bảo toàn an toàn, trả về HTTP 200 và không gọi abort trên transaction đã commit'
    );

    // Case 21.6: startTransaction ném lỗi khi khởi tạo session -> Đóng session ngay lập tức (không rò rỉ session) và hạ cấp an toàn sang non-transaction mode
    sessionCalls.startTransaction = 0;
    sessionCalls.commitTransaction = 0;
    sessionCalls.abortTransaction = 0;
    sessionCalls.endSession = 0;

    fakeSession.startTransaction = function() {
      sessionCalls.startTransaction++;
      throw new Error('SIMULATED_START_TRANSACTION_REPLICA_NOT_READY');
    };
    fakeSession.endSession = function() {
      sessionCalls.endSession++;
    };

    const resStartTxFailed = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi startTransaction gặp lỗi',
      });

    assert(
      resStartTxFailed.status === 500 &&
        sessionCalls.startTransaction === 1 &&
        sessionCalls.endSession === 1 &&
        sessionCalls.commitTransaction === 0,
      'TC-HTTP-21.6: startTransaction ném lỗi -> session.endSession() được gọi ngay lập tức và từ chối ghi ngoài transaction (Fail-Closed)'
    );

    // Case 21.7: UnknownTransactionCommitResult -> Hệ thống thử lại commitTransaction thành công
    sessionCalls.startTransaction = 0;
    sessionCalls.commitTransaction = 0;
    sessionCalls.abortTransaction = 0;
    sessionCalls.endSession = 0;

    fakeSession.startTransaction = function() {
      sessionCalls.startTransaction++;
    };

    let commitAttempt = 0;
    fakeSession.commitTransaction = async function() {
      sessionCalls.commitTransaction++;
      commitAttempt++;
      if (commitAttempt === 1) {
        const unknownErr = new Error('Transient network error during commit');
        unknownErr.hasErrorLabel = label => label === 'UnknownTransactionCommitResult';
        throw unknownErr;
      }
    };

    const resRetryCommitSuccess = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác kiểm thử retry commit',
      });

    assert(
      resRetryCommitSuccess.status === 200 &&
        sessionCalls.commitTransaction === 2 &&
        sessionCalls.endSession === 1 &&
        sessionCalls.abortTransaction === 0,
      'TC-HTTP-21.7: Lỗi UnknownTransactionCommitResult -> Kích hoạt retry commitTransaction tự động và hoàn tất ghi nhận thành công'
    );

    // Case 21.8: MongoDB Recommended Callback Transaction API (session.withTransaction)
    let withTxCalled = 0;
    const fakeCallbackSession = {
      async withTransaction(fn) {
        withTxCalled++;
        return await fn();
      },
      async endSession() {
        sessionCalls.endSession++;
      }
    };
    mongoose.startSession = async function() {
      return fakeCallbackSession;
    };
    sessionCalls.endSession = 0;

    const resCallbackTx = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác chạy qua MongoDB withTransaction Callback API',
      });

    assert(
      resCallbackTx.status === 200 &&
        withTxCalled === 1 &&
        sessionCalls.endSession === 1,
      'TC-HTTP-21.8: MongoDB Callback Transaction API (session.withTransaction) chạy thành công trọn vẹn và giải phóng session trong finally'
    );

    // Case 21.9: Standalone deployment topology detection -> Tự động nhận diện 'Single' và hạ cấp sang Compensatory Rollback mà không mở session
    let standaloneStartSessionCalled = 0;
    mongoose.connection.client = {
      topology: {
        description: { type: 'Single' }
      }
    };
    mongoose.startSession = async function() {
      standaloneStartSessionCalled++;
      return fakeCallbackSession;
    };

    const resStandalone = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác chạy trên Standalone topology',
      });

    assert(
      resStandalone.status === 200 &&
        standaloneStartSessionCalled === 0,
      'TC-HTTP-21.9: Topology Standalone (Single) được nhận diện chính xác -> Bỏ qua transaction driver và thực thi an toàn với Compensatory Rollback'
    );

    // Case 21.10: Fail-closed policy trên Topology ReplicaSet / Atlas -> Nếu startSession lỗi, từ chối mutation và trả lỗi 500
    mongoose.connection.client = {
      topology: {
        description: { type: 'ReplicaSetWithPrimary' }
      }
    };
    mongoose.startSession = async function() {
      throw new Error('SIMULATED_REPLICA_SET_SESSION_FAILURE');
    };

    const resFailClosed = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi ReplicaSet session khởi tạo lỗi',
      });

    assert(
      resFailClosed.status === 500 &&
        resFailClosed.body.error.includes('Lỗi thiết lập giao dịch') &&
        resFailClosed.body.integrity_warning === false,
      'TC-HTTP-21.10: Fail-closed policy trên ReplicaSet/Atlas -> startSession lỗi thì từ chối ghi ngoài transaction và trả lỗi 500 an toàn'
    );

    // Case 21.11: Atlas explicit + withTransaction ném lỗi -> Từ chối ghi nhận, không replay ngoài transaction
    let nonSessionSaveAttempts = 0;
    const trackingInstanceSave = existingAttendanceDoc.save;
    existingAttendanceDoc.save = async function(opts) {
      if (!opts?.session) nonSessionSaveAttempts++;
      return trackingInstanceSave.call(this, opts);
    };

    fakeCallbackSession.withTransaction = async function() {
      throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
    };
    mongoose.startSession = async function() {
      return fakeCallbackSession;
    };

    const resWithTxError = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi withTransaction ném lỗi trên Atlas',
      });

    assert(
      resWithTxError.status === 500 &&
        nonSessionSaveAttempts === 0,
      'TC-HTTP-21.11: Atlas explicit + withTransaction ném lỗi -> Từ chối ghi, tuyệt đối không replay mutation ngoài session'
    );

    // Case 21.12: Topology Unknown + startSession lỗi trong production -> Fail-closed
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mongoose.connection.client = {
      topology: {
        description: { type: 'Unknown' }
      }
    };
    mongoose.startSession = async function() {
      throw new Error('SIMULATED_PRODUCTION_START_SESSION_ERROR');
    };

    const resUnknownProdFailClosed = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi topology Unknown trong production',
      });

    assert(
      resUnknownProdFailClosed.status === 500 &&
        resUnknownProdFailClosed.body.error.includes('Lỗi thiết lập giao dịch'),
      'TC-HTTP-21.12: Topology Unknown trong production -> Bắt buộc transaction và fail-closed khi startSession gặp sự cố'
    );

    // Case 21.13: readyState = 0 (disconnect/reconnecting) trên transaction-required topology -> Fail-closed
    mongoose.connection.readyState = 0;
    const resReadyStateZero = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi DB readyState = 0',
      });

    assert(
      resReadyStateZero.status === 500 &&
        resReadyStateZero.body.error.includes('Lỗi kết nối cơ sở dữ liệu'),
      'TC-HTTP-21.13: readyState = 0 trên topology bắt buộc transaction -> Fail-closed, từ chối ghi và trả HTTP 500'
    );
    mongoose.connection.readyState = 1;

    // Case 21.14: Thiếu mongoose.startSession trên transaction-required topology -> Fail-closed
    const tempStartSessionStub = mongoose.startSession;
    mongoose.startSession = null;
    const resMissingStartSession = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi thiếu mongoose.startSession',
      });

    assert(
      resMissingStartSession.status === 500 &&
        (resMissingStartSession.body.error.includes('Lỗi kết nối cơ sở dữ liệu') || resMissingStartSession.body.error.includes('Lỗi thiết lập giao dịch')),
      'TC-HTTP-21.14: Thiếu mongoose.startSession trên topology bắt buộc transaction -> Fail-closed, từ chối ghi và trả HTTP 500'
    );
    mongoose.startSession = tempStartSessionStub;

    // Case 21.15: mongoose.startSession trả về null trên transaction-required topology -> Fail-closed
    mongoose.connection.readyState = 1;
    mongoose.startSession = async function() {
      return null;
    };
    const resNullSession = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Thao tác khi startSession trả null',
      });

    assert(
      resNullSession.status === 500 &&
        resNullSession.body.error.includes('null session'),
      'TC-HTTP-21.15: startSession() trả về null trên topology bắt buộc transaction -> Fail-closed, từ chối ghi và trả HTTP 500'
    );

    process.env.NODE_ENV = originalNodeEnv;

    // Khôi phục MongoClient và stubs
    mongoose.connection.client = originalConnectionClient;
    existingAttendanceDoc.save = savedInstanceSave;
    Attendance.findOne = savedAttFindOne;
    Attendance.prototype.save = savedPrototypeSave;
    AttendanceAuditLog.create = savedAuditCreateTracking;
    if (originalMongooseStartSession) {
      mongoose.startSession = originalMongooseStartSession;
    } else {
      delete mongoose.startSession;
    }
    mongoose.connection.readyState = originalConnectionReadyState || 0;

    // -------------------------------------------------------------
    // 8. Supertest: GET /api/timesheet-lock/audit-logs DTO projection, pagination & snapshot detail
    // -------------------------------------------------------------
    if (mockAuditLogs.length === 0) {
      const sampleAuditDoc = new AttendanceAuditLog({
        attendance_id: existingAttendanceDoc._id,
        user_id: mockEmpUser._id,
        user_name: 'Dev IT 1',
        date: '2026-08-19',
        old_symbol: 'x',
        new_symbol: 'Không công (0 công)',
        reason: 'Hủy công ngày do gian lận, chuyển thành 2h OT',
        modified_by: mockAdminUser._id,
        modified_by_name: 'Admin Tổng',
        snapshot_before: { check_in_time: '2026-08-19T08:15:00.000Z', selfie_url: 'https://example.com/selfie.jpg' },
        snapshot_after: { check_in_time: null, total_hours: 0 },
      });
      mockAuditLogs.push(sampleAuditDoc);
    }

    const resAuditList = await request(app)
      .get('/api/timesheet-lock/audit-logs?month=8&year=2026&page=1&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      resAuditList.status === 200 &&
        resAuditList.body.logs &&
        Array.isArray(resAuditList.body.logs) &&
        resAuditList.body.logs.length > 0 &&
        resAuditList.body.pagination &&
        resAuditList.body.pagination.page === 1 &&
        resAuditList.body.pagination.limit === 50 &&
        resAuditList.body.pagination.total >= 1 &&
        resAuditList.body.pagination.totalPages >= 1 &&
        resAuditList.body.logs[0].user_name &&
        resAuditList.body.logs[0].reason &&
        resAuditList.body.logs[0].snapshot_before === undefined,
      'TC-HTTP-22.1: GET /api/timesheet-lock/audit-logs trả về DTO tóm tắt kèm pagination metadata ({ logs, pagination }), loại trừ snapshot_before/after'
    );

    const firstAuditId = mockAuditLogs[0]._id;
    const resAuditDetail = await request(app)
      .get(`/api/timesheet-lock/audit-logs/${firstAuditId}/snapshot`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      resAuditDetail.status === 200 &&
        resAuditDetail.body.snapshot_before &&
        resAuditDetail.body.snapshot_before.check_in_time !== null,
      'TC-HTTP-22.2: GET /api/timesheet-lock/audit-logs/:id/snapshot trả về chi tiết forensic snapshot đầy đủ theo yêu cầu'
    );

    // -------------------------------------------------------------
    // 9. Supertest: Late rules, WFH/site exemptions, override sync & TimesheetLock HTTP enforcement
    // -------------------------------------------------------------

    // TC-HTTP-23.1: POST /api/attendance/checkin trên tháng/nhân viên bị khóa -> Trả về 403 Forbidden và KHÔNG tạo attendance
    TimesheetLock.findOne = async function(filter) {
      if (filter && filter.is_locked) {
        return {
          _id: new mongoose.Types.ObjectId(),
          month: filter.month,
          year: filter.year,
          user_id: filter.$or?.some(c => c.user_id === null) ? null : mockEmpUser._id,
          is_locked: true,
        };
      }
      return null;
    };

    let checkinCreateCalled = false;
    Attendance.create = async function() {
      checkinCreateCalled = true;
      throw new Error('UNEXPECTED_MUTATION_ON_LOCKED_TIMESHEET');
    };

    const resCheckinLocked = await request(app)
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        lat: 10.7769,
        lng: 106.7009,
        type: 'office',
      });

    assert(
      resCheckinLocked.status === 403 &&
        resCheckinLocked.body.error.includes('đã bị') &&
        checkinCreateCalled === false,
      'TC-HTTP-23.1: POST /api/attendance/checkin bị chặn 403 Forbidden khi tháng đã chốt khóa, 0 tác động database'
    );

    // TC-HTTP-23.2: POST /api/timesheet-lock/override-cell trên tháng bị khóa -> Trả về 403 Forbidden
    const resOverrideCellLocked = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Sửa công tháng đã khóa',
      });

    assert(
      resOverrideCellLocked.status === 403 &&
        resOverrideCellLocked.body.error.includes('đã bị'),
      'TC-HTTP-23.2: POST /api/timesheet-lock/override-cell bị chặn 403 Forbidden khi tháng đã chốt khóa'
    );

    // Mở khóa TimesheetLock cho các test tiếp theo
    TimesheetLock.findOne = async function() {
      return null;
    };

    // TC-HTTP-23.3: POST /api/attendance/checkin với clock injection cố định 09:45 AM (> 09:30)
    // Chứng minh: ca office bị tính 0.75 công, nhưng ca WFH/công tác được miễn trừ và giữ đủ 1.0 công
    const RealDate = global.Date;
    const fixedClockTime = new Date('2026-08-31T09:45:00+07:00');
    class MockClockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixedClockTime.getTime());
        } else {
          super(...args);
        }
      }
      static now() {
        return fixedClockTime.getTime();
      }
    }
    global.Date = MockClockDate;

    try {
      Attendance.findOne = async function() { return null; };
      Attendance.create = async function(data) {
        return new Attendance(data);
      };

      // 1. Kiểm tra ca office lúc 09:45 -> Bị giảm công xuống 0.75x
      const resOfficeLate = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          lat: 21.0285,
          lng: 105.8542,
          type: 'office',
        });

      assert(
        resOfficeLate.status === 201 &&
          resOfficeLate.body.attendance.work_units === 0.75 &&
          resOfficeLate.body.attendance.is_late === true,
        'TC-HTTP-23.3a: Check-in văn phòng lúc 09:45 AM (> 09:30) bị tính 0.75 công (work_units=0.75, is_late=true)'
      );

      // 2. Kiểm tra ca WFH lúc 09:45 -> Vẫn giữ nguyên đủ 1.0 công (miễn trừ WFH)
      const resWfhCheckin = await request(app)
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          lat: 10.7769,
          lng: 106.7009,
          type: 'wfh',
        });

      assert(
        resWfhCheckin.status === 201 &&
          resWfhCheckin.body.attendance.work_units === 1.0 &&
          resWfhCheckin.body.attendance.check_in_type === 'wfh',
        'TC-HTTP-23.3b: POST /api/attendance/checkin loại hình WFH lúc 09:45 AM luôn duy trì đủ 1.0 công (không bị trừ 0.75 công)'
      );
    } finally {
      global.Date = RealDate;
    }

    // TC-HTTP-23.4: PUT /api/attendance/override/:id cập nhật giờ check-in từ 09:35 về 09:20 -> work_units tự động đồng bộ từ 0.75 lên 1.0
    const mockLateAttDoc = new Attendance({
      _id: new mongoose.Types.ObjectId(),
      user_id: mockEmpUser._id,
      date: '2026-08-31',
      check_in_time: new Date('2026-08-31T09:35:00+07:00'),
      check_in_type: 'office',
      work_units: 0.75,
      is_late: true,
      late_minutes: 35,
      status: 'present',
    });
    mockLateAttDoc.save = async function() { return this; };
    Attendance.findById = async function() { return mockLateAttDoc; };

    const resOverrideTime = await request(app)
      .put(`/api/attendance/override/${mockLateAttDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        check_in_time: '09:20',
      });

    assert(
      resOverrideTime.status === 200 &&
        resOverrideTime.body.attendance.work_units === 1.0 &&
        resOverrideTime.body.attendance.late_minutes === 20,
      'TC-HTTP-23.4: PUT /api/attendance/override/:id sửa giờ từ 09:35 về 09:20 -> work_units tự động đồng bộ lại thành 1.0'
    );

    // TC-HTTP-23.5: PUT /api/attendance/override/:id khi Admin đã override ký hiệu công rõ ràng [0,75x] -> Bảo toàn work_units=0.75 không bị ghi đè
    const mockExplicitOverrideDoc = new Attendance({
      _id: new mongoose.Types.ObjectId(),
      user_id: mockEmpUser._id,
      date: '2026-08-31',
      check_in_time: new Date('2026-08-31T09:00:00+07:00'),
      check_in_type: 'office',
      work_units: 0.75,
      notes: 'Ký hiệu: [0,75x] | Admin điều chỉnh công 0.75',
      status: 'present',
    });
    mockExplicitOverrideDoc.save = async function() { return this; };
    Attendance.findById = async function() { return mockExplicitOverrideDoc; };

    const resOverrideExplicit = await request(app)
      .put(`/api/attendance/override/${mockExplicitOverrideDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        check_in_time: '09:00',
      });

    assert(
      resOverrideExplicit.status === 200 &&
        resOverrideExplicit.body.attendance.work_units === 0.75,
      'TC-HTTP-23.5: PUT /api/attendance/override/:id có ký hiệu override rõ ràng [0,75x] -> Bảo toàn work_units=0.75'
    );

    // TC-HTTP-23.6: POST /api/attendance/checkout bị chặn 403 Forbidden khi tháng đã chốt khóa
    TimesheetLock.findOne = async function(filter) {
      if (filter && filter.is_locked) {
        return {
          _id: new mongoose.Types.ObjectId(),
          month: filter.month,
          year: filter.year,
          user_id: null,
          is_locked: true,
        };
      }
      return null;
    };

    const resCheckoutLocked = await request(app)
      .post('/api/attendance/checkout')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        lat: 10.7769,
        lng: 106.7009,
      });

    assert(
      resCheckoutLocked.status === 403 &&
        resCheckoutLocked.body.error.includes('đã bị'),
      'TC-HTTP-23.6: POST /api/attendance/checkout bị chặn 403 Forbidden khi tháng đã chốt khóa'
    );

    // TC-HTTP-23.7: PUT /api/attendance/override/:id bị chặn 403 Forbidden khi tháng đã chốt khóa
    const resOverrideLocked = await request(app)
      .put(`/api/attendance/override/${mockLateAttDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        check_in_time: '09:00',
      });

    assert(
      resOverrideLocked.status === 403 &&
        resOverrideLocked.body.error.includes('đã bị'),
      'TC-HTTP-23.7: PUT /api/attendance/override/:id bị chặn 403 Forbidden khi tháng đã chốt khóa'
    );

    // TC-HTTP-23.8: DELETE /api/attendance/:id bị chặn 403 Forbidden khi tháng đã chốt khóa
    const resDeleteLocked = await request(app)
      .delete(`/api/attendance/${mockLateAttDoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert(
      resDeleteLocked.status === 403 &&
        resDeleteLocked.body.error.includes('đã bị'),
      'TC-HTTP-23.8: DELETE /api/attendance/:id bị chặn 403 Forbidden khi tháng đã chốt khóa'
    );

    // TC-HTTP-23.9: POST /api/timesheet-lock/override-cell chạy pre-init updateOne và guard findOneAndUpdate (upsert: false), chặn 403 khi khóa toàn cục
    let interceptedPreInitCalls = [];
    let interceptedGlobalGuardUpdate = null;
    let interceptedGlobalGuardOptions = null;
    TimesheetLock.updateOne = async (filter, update, options) => {
      interceptedPreInitCalls.push({ filter, update, options });
      return { acknowledged: true };
    };
    TimesheetLock.findOne = async () => null;
    TimesheetLock.findOneAndUpdate = async (filter, update, options) => {
      if (filter.user_id === null) {
        interceptedGlobalGuardUpdate = update;
        interceptedGlobalGuardOptions = options;
        return null; // Mô phỏng document đã bị khóa (predicate không match -> null)
      }
      return { is_locked: false };
    };

    const resOverrideConflict = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Sửa công đồng thời',
      });

    assert(
      resOverrideConflict.status === 403 &&
        resOverrideConflict.body.error.includes('chốt khóa') &&
        interceptedPreInitCalls.length >= 2 &&
        interceptedPreInitCalls[0].options?.upsert === true &&
        interceptedGlobalGuardOptions?.upsert === false &&
        interceptedGlobalGuardUpdate?.$inc?.guard_version === 1 &&
        interceptedGlobalGuardUpdate?.$set?.last_verified_at,
      'TC-HTTP-23.9: Pre-init updateOne idempotent (upsert: true) ngoài transaction & Guard findOneAndUpdate (upsert: false) chặn 403 Forbidden'
    );

    // TC-HTTP-23.10: POST /api/timesheet-lock/override-cell chặn 403 khi Write-Intent Guard phát hiện khóa riêng của nhân viên có xung đột
    let interceptedUserGuardUpdate = null;
    let interceptedUserGuardOptions = null;
    TimesheetLock.findOneAndUpdate = async (filter, update, options) => {
      if (filter.user_id === null) {
        return { is_locked: false };
      }
      if (String(filter.user_id) === String(mockEmpUser._id)) {
        interceptedUserGuardUpdate = update;
        interceptedUserGuardOptions = options;
        return null; // Khóa riêng của nhân viên đã bị khóa
      }
      return { is_locked: false };
    };

    const resUserLockConflict = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Sửa công nhân viên bị khóa',
      });

    assert(
      resUserLockConflict.status === 403 &&
        resUserLockConflict.body.error.includes('khóa') &&
        interceptedUserGuardOptions?.upsert === false &&
        interceptedUserGuardUpdate?.$inc?.guard_version === 1,
      'TC-HTTP-23.10: Write-Intent Guard trên TimesheetLock (User-Level, upsert: false) chặn 403 Forbidden khi có xung đột'
    );

    // TC-HTTP-23.11: Pre-init updateOne gặp lỗi DB (khác 11000) -> Fail-closed trả về HTTP 500, không mở transaction
    TimesheetLock.updateOne = async () => {
      const err = new Error('Database connection lost during pre-init');
      err.code = 500;
      throw err;
    };

    const resPreInitFail = await request(app)
      .post('/api/timesheet-lock/override-cell')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        user_id: mockEmpUser._id,
        date: '2026-08-19',
        new_symbol: 'x',
        reason: 'Sửa công khi DB pre-init lỗi',
      });

    assert(
      resPreInitFail.status === 500 &&
        resPreInitFail.body.error.includes('Fail-Closed'),
      'TC-HTTP-23.11: Pre-init updateOne gặp lỗi DB (khác 11000) -> Fail-closed trả về HTTP 500 an toàn'
    );

    // TC-HTTP-23.12: Topology yêu cầu transaction truyền session thật vào findOneAndUpdate options
    TimesheetLock.updateOne = async () => ({ acknowledged: true });
    let passedSessionInGuard = null;
    const mockSession = {
      withTransaction: async (cb) => cb(mockSession),
      endSession: async () => {},
    };
    const origStartSession = mongoose.startSession;
    const origReadyState = mongoose.connection ? mongoose.connection.readyState : 0;
    const origClient = mongoose.connection ? mongoose.connection.client : undefined;

    try {
      mongoose.startSession = async () => mockSession;
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

      TimesheetLock.findOneAndUpdate = async (filter, update, options) => {
        if (filter.user_id === null) {
          passedSessionInGuard = options?.session;
        }
        return { is_locked: false };
      };

      const resSessionPassed = await request(app)
        .post('/api/timesheet-lock/override-cell')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: mockEmpUser._id,
          date: '2026-08-19',
          new_symbol: 'x',
          reason: 'Sửa công với session transaction',
        });

      assert(
        resSessionPassed.status === 200 &&
          passedSessionInGuard === mockSession,
        'TC-HTTP-23.12: In-transaction findOneAndUpdate nhận đúng session từ withTransaction trên replica-set topology'
      );
    } finally {
      if (origStartSession) mongoose.startSession = origStartSession;
      else delete mongoose.startSession;
      if (mongoose.connection) {
        mongoose.connection.readyState = origReadyState;
        mongoose.connection.client = origClient;
      }
    }

  } finally {
    User.find = originalUserFind;
    User.findById = originalFindById;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
    SystemSetting.findOne = originalSettingFindOne;
    OfficeLocation.find = originalLocationFind;
    Attendance.findOne = originalAttFindOne;
    Attendance.find = originalAttFind;
    Attendance.create = originalAttCreate;
    Attendance.prototype.save = originalAttSave;
    Attendance.countDocuments = originalAttCountDocuments;
    DeviceRegistry.find = originalDevRegFind;
    DeviceRegistry.findOneAndUpdate = originalDevRegFindOneAndUpdate;
    DeviceSession.findOne = originalDevSessFindOne;
    DeviceSession.prototype.save = originalDevSessSave;
    Project.find = originalProjFind;
    AttendanceAuditLog.create = originalAuditLogCreate;
    AttendanceAuditLog.find = originalAuditLogFind;
    AttendanceAuditLog.findById = originalAuditLogFindById;
    AttendanceAuditLog.countDocuments = originalAuditLogCountDocuments;
    TimesheetLock.findOne = originalLockFindOne;
    TimesheetLock.findOneAndUpdate = originalLockFindOneAndUpdate;
    TimesheetLock.updateOne = originalLockUpdateOne;
    Holiday.findOne = originalHolidayFindOne;
    if (originalMongooseStartSession) {
      mongoose.startSession = originalMongooseStartSession;
    } else {
      delete mongoose.startSession;
    }
    if (mongoose.connection) {
      mongoose.connection.readyState = originalConnectionReadyState || 0;
      mongoose.connection.client = originalConnectionClient;
    }
  }
}

module.exports = runControllerIntegrationTests;
