// ==============================================
// tests/integration/controllerIntegration.test.js
// Integration Testing for Real Express App, Routes, Middleware Pipeline & Supertest
// ==============================================

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.DATABASE_URL;

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

  User.find = function() {
    return {
      select() {
        return {
          populate() {
            return {
              populate() {
                return {
                  populate() {
                    return {
                      sort() {
                        return Promise.resolve(sampleDbUsers);
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
  };

  User.findById = function(id) {
    const found = [mockAdminUser, mockLeaderUser, mockEmpUser, userNamEmp].find(u => u._id.toString() === id.toString()) || mockAdminUser;
    return {
      select() {
        return Promise.resolve({
          ...found,
          toObject() { return { ...found }; }
        });
      }
    };
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

  let mockSavedAttendance = null;
  Attendance.findOne = function(query) {
    if (mockSavedAttendance && query?.user_id?.toString() === mockSavedAttendance.user_id?.toString()) {
      return Promise.resolve(mockSavedAttendance);
    }
    return Promise.resolve(null);
  };

  Attendance.find = function() {
    return {
      populate() {
        return Promise.resolve([]);
      }
    };
  };

  Attendance.create = function(data) {
    mockSavedAttendance = {
      ...data,
      save: function() { return Promise.resolve(this); },
      toObject: function() { return { ...this }; }
    };
    return Promise.resolve(mockSavedAttendance);
  };

  Attendance.prototype.save = function() {
    mockSavedAttendance = this;
    return Promise.resolve(this);
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

    Project.find = function(query) {
      capturedProjQuery = query;
      return {
        populate: function() {
          return {
            populate: function() {
              return {
                sort: function() {
                  return Promise.resolve([
                    { _id: 'proj_01', name: 'Dự án Của Nam NV', pm_id: '507f1f77bcf86cd799439099', pm_name: 'Nguyễn Văn Nam' }
                  ]);
                }
              };
            }
          };
        }
      };
    };

    const resProjList = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${namEmpToken}`);
    assert(resProjList.status === 200, 'TC-HTTP-16.1: GET /api/projects trả về 200 OK');

    // Kiểm tra cấu trúc truy vấn MongoDB đã được sửa an toàn tuyệt đối
    const pmNameCond = capturedProjQuery?.$or?.find(c => c.$and);
    assert(pmNameCond !== undefined, 'TC-HTTP-16.2: Truy vấn $or có điều kiện $and bọc pm_name và pm_id null check');
    assert(pmNameCond.$and[0].$or[0].pm_id === null, 'TC-HTTP-16.3: Bắt buộc pm_id là null hoặc không tồn tại mới đối chiếu pm_name');

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
    DeviceRegistry.find = originalDevRegFind;
    DeviceRegistry.findOneAndUpdate = originalDevRegFindOneAndUpdate;
    DeviceSession.findOne = originalDevSessFindOne;
    DeviceSession.prototype.save = originalDevSessSave;
    Project.find = originalProjFind;
    AttendanceAuditLog.create = originalAuditLogCreate;
  }
}

module.exports = runControllerIntegrationTests;
