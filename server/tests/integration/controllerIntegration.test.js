// ==============================================
// tests/integration/controllerIntegration.test.js
// Integration Testing for Real Express Controllers & Security Boundaries
// ==============================================

const userController = require('../../src/controllers/userController');
const authController = require('../../src/controllers/authController');
const attendanceController = require('../../src/controllers/attendanceController');
const User = require('../../src/models/User');

// Helper to create mock Express Req / Res
function createMockHttp(reqOptions = {}) {
  const req = {
    user: reqOptions.user || { _id: 'u_admin', role: 'admin', full_name: 'Admin Tổng' },
    query: reqOptions.query || {},
    body: reqOptions.body || {},
    params: reqOptions.params || {},
    ...reqOptions,
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };

  return { req, res };
}

async function runControllerIntegrationTests(assert) {
  console.log('\n🎯 [TEST SUITE: REAL CONTROLLER INTEGRATION & RBAC PIPELINE]');

  // Mock User.find() for userController testing
  const originalUserFind = User.find;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;

  const sampleDbUsers = [
    {
      _id: 'u_lead_it',
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
      _id: 'u_emp_it',
      employee_code: 'NS-002',
      full_name: 'Dev IT 1',
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
      _id: 'u_emp_sale',
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

  User.find = function(filter) {
    return {
      select(fields) {
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

  try {
    // -------------------------------------------------------------
    // 1. Controller Integration: userController.getAllUsers
    // -------------------------------------------------------------

    // Case 1.1: Admin gọi getAllUsers -> Nhận full dữ liệu quản trị
    const { req: reqAdmin, res: resAdmin } = createMockHttp({
      user: { _id: 'u_admin', role: 'admin' }
    });
    await userController.getAllUsers(reqAdmin, resAdmin);
    assert(resAdmin.statusCode === 200, 'TC-CTRL-01.1: Admin gọi getAllUsers trả về 200 OK');
    assert(resAdmin.data.length === 3, 'TC-CTRL-01.2: Admin nhận đủ 3 nhân sự');
    assert(resAdmin.data[1].dob === '1995-05-05' && resAdmin.data[1].cccd === '987654321098',
      'TC-CTRL-01.3: Admin có toàn quyền truy xuất các trường quản trị (DOB, CCCD, Bank)');

    // Case 1.2: Leader IT gọi getAllUsers -> Nhận full dữ liệu phòng IT, nhưng phòng Sale bị Sanitize
    const { req: reqLeader, res: resLeader } = createMockHttp({
      user: { _id: 'u_lead_it', role: 'leader', department_ids: ['dept_it'] }
    });
    await userController.getAllUsers(reqLeader, resLeader);
    assert(resLeader.statusCode === 200, 'TC-CTRL-02.1: Leader gọi getAllUsers trả về 200 OK');
    const itMemberFromLeader = resLeader.data.find(u => u._id === 'u_emp_it');
    const saleMemberFromLeader = resLeader.data.find(u => u._id === 'u_emp_sale');

    assert(itMemberFromLeader.dob === '1995-05-05',
      'TC-CTRL-02.2: Leader xem được trường quản lý của nhân viên phòng ban mình');
    assert(saleMemberFromLeader.dob === undefined && saleMemberFromLeader.cccd === undefined && saleMemberFromLeader.bank_account === undefined,
      'TC-CTRL-02.3: Nhân viên phòng khác (Sale) tự động bị che giấu toàn bộ trường HR nhạy cảm trước Leader IT');

    // Case 1.3: Employee gọi getAllUsers -> Tất cả nhân sự đều chuyển sang Whitelist DTO
    const { req: reqEmp, res: resEmp } = createMockHttp({
      user: { _id: 'u_emp_it', role: 'employee' }
    });
    await userController.getAllUsers(reqEmp, resEmp);
    assert(resEmp.statusCode === 200, 'TC-CTRL-03.1: Employee gọi getAllUsers trả về 200 OK');
    const anyUserFromEmp = resEmp.data[0];
    assert(anyUserFromEmp.full_name && anyUserFromEmp.email && anyUserFromEmp.position,
      'TC-CTRL-03.2: Employee nhận được thông tin danh bạ công việc tối thiểu');
    assert(anyUserFromEmp.dob === undefined && anyUserFromEmp.cccd === undefined && anyUserFromEmp.parking_location === undefined,
      'TC-CTRL-03.3: Employee hoàn toàn không thấy thông tin riêng tư của bất kỳ ai');

    // -------------------------------------------------------------
    // 2. Controller Integration: authController.updateProfile
    // -------------------------------------------------------------
    let savedUpdateData = null;
    User.findByIdAndUpdate = function(id, updateData, options) {
      savedUpdateData = updateData;
      const baseObj = sampleDbUsers[0];
      return {
        select() {
          return {
            populate() {
              return Promise.resolve({
                ...baseObj,
                ...updateData,
                toObject() { return { ...baseObj, ...updateData }; }
              });
            }
          };
        }
      };
    };

    // Case 2.1: Leader cập nhật họ tên & số điện thoại
    const { req: reqProfLeader, res: resProfLeader } = createMockHttp({
      user: { _id: 'u_lead_it', role: 'leader' },
      body: { full_name: 'Trưởng Phòng IT Mới', phone: '0988776655' }
    });
    await authController.updateProfile(reqProfLeader, resProfLeader);
    assert(resProfLeader.statusCode === 200, 'TC-CTRL-04.1: Leader cập nhật profile trả về 200 OK');
    assert(savedUpdateData.full_name === 'Trưởng Phòng IT Mới' && savedUpdateData.phone === '0988776655',
      'TC-CTRL-04.2: Họ tên và SĐT được lưu chuẩn xác vào database');

    // Case 2.2: Non-Admin gửi kèm trường xe -> Controller bỏ qua trường xe và thông báo lịch sự
    savedUpdateData = null;
    const { req: reqProfHack, res: resProfHack } = createMockHttp({
      user: { _id: 'u_emp_it', role: 'employee' },
      body: { full_name: 'Dev IT', parking_location: 'Gửi VIP Miễn Phí' }
    });
    await authController.updateProfile(reqProfHack, resProfHack);
    assert(resProfHack.statusCode === 200, 'TC-CTRL-05.1: Request cập nhật của Employee không bị crash');
    assert(savedUpdateData.parking_location === undefined,
      'TC-CTRL-05.2: Backend từ chối ghi đè trường parking_location từ Non-Admin vào DB');
    assert(resProfHack.data.message.includes('Đơn đổi xe'),
      'TC-CTRL-05.3: Response thông báo rõ ràng cho user cần nộp Đơn đổi xe');

    // -------------------------------------------------------------
    // 3. Controller Integration: attendanceController.overrideAttendance
    // -------------------------------------------------------------
    const { req: reqAttendLeader, res: resAttendLeader } = createMockHttp({
      user: { _id: 'u_lead_it', role: 'leader' },
      params: { id: 'att_123' }
    });
    await attendanceController.overrideAttendance(reqAttendLeader, resAttendLeader);
    assert(resAttendLeader.statusCode === 403,
      'TC-CTRL-06: Leader gọi trực tiếp overrideAttendance controller bị chặn 403 Forbidden');

  } finally {
    User.find = originalUserFind;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
}

module.exports = runControllerIntegrationTests;
