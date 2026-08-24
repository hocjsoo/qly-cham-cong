// ==============================================
// tests/integration/controllerIntegration.test.js
// Integration Testing for Real Express App, Routes, Middleware Pipeline & Supertest
// ==============================================

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/User');

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
    const found = [mockAdminUser, mockLeaderUser, mockEmpUser].find(u => u._id.toString() === id.toString()) || mockAdminUser;
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
    assert(itEmp.cccd === undefined && itEmp.bank_account === undefined && itEmp.parking_location === undefined,
      'TC-HTTP-03.3: DTO bảo vệ loại bỏ hoàn toàn CCCD, Ngân hàng, Xe của thành viên team trước Leader');
    assert(saleEmp.full_name && saleEmp.email && saleEmp.dob === undefined && saleEmp.cccd === undefined,
      'TC-HTTP-03.4: Thành viên phòng ban khác (Sale) tự động chuyển sang Public Directory DTO');

    // Case 1.4: Employee gọi GET /api/users -> Toàn bộ danh sách là Public Directory DTO
    const resEmp = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert(resEmp.status === 200, 'TC-HTTP-04.1: Employee gọi GET /api/users trả về 200 OK');
    assert(resEmp.body[0].full_name && resEmp.body[0].email && resEmp.body[0].dob === undefined && resEmp.body[0].cccd === undefined,
      'TC-HTTP-04.2: Employee chỉ nhận thông tin danh bạ công khai tối thiểu, ẩn 100% dữ liệu nhạy cảm');

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

  } finally {
    User.find = originalUserFind;
    User.findById = originalFindById;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
}

module.exports = runControllerIntegrationTests;
