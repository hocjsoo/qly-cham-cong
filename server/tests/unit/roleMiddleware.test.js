// ==============================================
// tests/unit/roleMiddleware.test.js
// Kiểm thử Hệ thống Phân quyền Role-Based Access Control (RBAC)
// & Khả năng Tương thích Ngược (Legacy Roles Mapping)
// ==============================================

const path = require('path');
const requireRole = require(path.join(__dirname, '../../src/middlewares/roleMiddleware'));

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

function runRoleTests(assert) {
  console.log('\n🛡️ [TEST SUITE: RBAC & ROLE MAPPING SYSTEM]');

  // TC-RBAC-01: requireRole('admin') cho User có role 'admin' -> PASS (next được gọi)
  const req1 = { user: { role: 'admin' } };
  const res1 = createMockRes();
  let nextCalled1 = false;
  requireRole('admin')(req1, res1, () => { nextCalled1 = true; });
  assert(nextCalled1 === true && res1.statusCode === 200,
    'TC-RBAC-01: requireRole("admin") cho phép User role="admin"');

  // TC-RBAC-02: requireRole('admin') cho User có role 'leader' -> Bị từ chối 403
  const req2 = { user: { role: 'leader' } };
  const res2 = createMockRes();
  let nextCalled2 = false;
  requireRole('admin')(req2, res2, () => { nextCalled2 = true; });
  assert(nextCalled2 === false && res2.statusCode === 403,
    'TC-RBAC-02: requireRole("admin") chặn User role="leader" (Trả về HTTP 403)');

  // TC-RBAC-03: requireRole('admin') cho User có role 'employee' -> Bị từ chối 403
  const req3 = { user: { role: 'employee' } };
  const res3 = createMockRes();
  let nextCalled3 = false;
  requireRole('admin')(req3, res3, () => { nextCalled3 = true; });
  assert(nextCalled3 === false && res3.statusCode === 403,
    'TC-RBAC-03: requireRole("admin") chặn User role="employee" (Trả về HTTP 403)');

  // TC-RBAC-04: Tương thích legacy role 'manager' khi route yêu cầu 'leader'
  const req4 = { user: { role: 'manager' } };
  const res4 = createMockRes();
  let nextCalled4 = false;
  requireRole('leader')(req4, res4, () => { nextCalled4 = true; });
  assert(nextCalled4 === true,
    'TC-RBAC-04: requireRole("leader") tự động nhận diện legacy role "manager"');

  // TC-RBAC-05: Tương thích role mới 'leader' khi route yêu cầu 'manager'
  const req5 = { user: { role: 'leader' } };
  const res5 = createMockRes();
  let nextCalled5 = false;
  requireRole('admin', 'manager')(req5, res5, () => { nextCalled5 = true; });
  assert(nextCalled5 === true,
    'TC-RBAC-05: requireRole("admin", "manager") tự động nhận diện role mới "leader"');

  // TC-RBAC-06: Tương thích legacy role 'staff' khi route yêu cầu 'employee'
  const req6 = { user: { role: 'staff' } };
  const res6 = createMockRes();
  let nextCalled6 = false;
  requireRole('employee')(req6, res6, () => { nextCalled6 = true; });
  assert(nextCalled6 === true,
    'TC-RBAC-06: requireRole("employee") tự động nhận diện legacy role "staff"');

  // TC-RBAC-07: Chặn request chưa xác thực (req.user is undefined) -> 401 Unauthorized
  const req7 = {};
  const res7 = createMockRes();
  let nextCalled7 = false;
  requireRole('admin')(req7, res7, () => { nextCalled7 = true; });
  assert(nextCalled7 === false && res7.statusCode === 401,
    'TC-RBAC-07: Chặn request chưa xác thực khi req.user không tồn tại (Trả về HTTP 401)');
}

module.exports = runRoleTests;
