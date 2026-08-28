const fs = require('fs');
const path = require('path');
const {
  isLeaderRole,
  isEmployeeRole,
  getDepartmentIds,
  buildLeaderUserScope,
  combineUserFilters,
} = require('../../src/utils/roleScope');

function runAuthorizationScopeTests(assert) {
  console.log('\n🔐 [TEST SUITE: AUTHORIZATION DATA SCOPES]');

  assert(
    isLeaderRole('leader') && isLeaderRole('manager') && !isLeaderRole('employee'),
    'TC-SCOPE-01: Nhận diện thống nhất role Leader và Manager legacy'
  );
  assert(
    isEmployeeRole('employee') && isEmployeeRole('staff') && !isEmployeeRole('admin'),
    'TC-SCOPE-02: Nhận diện thống nhất role Employee và Staff legacy'
  );

  const leader = {
    _id: 'leader-1',
    role: 'leader',
    department_id: { _id: 'dept-1' },
    department_ids: [{ _id: 'dept-1' }, 'dept-2'],
  };
  const scope = buildLeaderUserScope(leader, { includeSelf: true });
  const serializedScope = JSON.stringify(scope);
  assert(
    getDepartmentIds(leader).join(',') === 'dept-1,dept-2' &&
      serializedScope.includes('manager_id') &&
      serializedScope.includes('department_ids') &&
      serializedScope.includes('department_id') &&
      serializedScope.includes('leader-1') &&
      scope.role.$ne === 'admin',
    'TC-SCOPE-03: Scope Leader gồm quản lý trực tiếp, phòng ban, bản thân và loại trừ Admin'
  );

  const combined = combineUserFilters(
    { is_active: { $ne: false } },
    { $or: [{ department_id: 'dept-1' }] },
    { _id: 'user-1' }
  );
  assert(
    Array.isArray(combined.$and) && combined.$and.length === 3,
    'TC-SCOPE-04: Bộ lọc bổ sung dùng $and, không ghi đè $or phạm vi Leader'
  );

  const expenseRoutes = fs.readFileSync(path.resolve(__dirname, '../../src/routes/expense.routes.js'), 'utf8');
  const expenseController = fs.readFileSync(path.resolve(__dirname, '../../src/controllers/expenseController.js'), 'utf8');
  const authRoutes = fs.readFileSync(path.resolve(__dirname, '../../src/routes/auth.routes.js'), 'utf8');
  const projectController = fs.readFileSync(path.resolve(__dirname, '../../src/controllers/projectController.js'), 'utf8');
  assert(
    expenseRoutes.includes("router.put('/:id/pay', requireRole('admin'), markAsPaid)") &&
      authRoutes.includes("router.post('/register', authMiddleware, requireRole('admin'), register)") &&
      !projectController.includes('Project.insertMany'),
    'TC-SCOPE-05: Hoàn ứng/đăng ký tài khoản chỉ Admin và GET dự án không tự ghi dữ liệu'
  );

  assert(
    expenseController.includes("if (!isAdmin && expense.approval_status !== 'pending')") &&
      expenseController.includes("if (expense.payment_status === 'paid')") &&
      expenseController.includes("if (payment_status === 'paid' && expense.approval_status !== 'approved')"),
    'TC-SCOPE-06: Khóa sửa/xóa khoản chi đã duyệt và chỉ hoàn ứng sau phê duyệt'
  );
}

module.exports = runAuthorizationScopeTests;
