// ==============================================
// tests/unit/clientNavAccess.test.js
// Kiểm thử Menu Điều Hướng & Bộ Lọc Quyền Route Guard Giao diện
// ==============================================

const NAV_ITEMS = [
  { path: '/checkin', label: 'Chấm công', roles: ['admin', 'leader', 'manager', 'employee', 'staff'] },
  { path: '/history', label: 'Lịch sử', roles: ['admin', 'leader', 'manager', 'employee', 'staff'] },
  { path: '/requests', label: 'Đơn từ', roles: ['admin', 'leader', 'manager', 'employee', 'staff'] },
  { path: '/profile', label: 'Cá nhân', roles: ['admin', 'leader', 'manager', 'employee', 'staff'] },
  { path: '/dashboard', label: 'Dashboard', roles: ['admin', 'leader', 'manager'] },
  { path: '/staff', label: 'Nhân sự', roles: ['admin', 'leader', 'manager'] },
  { path: '/projects', label: 'Dự án', roles: ['admin', 'leader', 'manager', 'employee', 'staff'] },
  { path: '/reports', label: 'Báo cáo', roles: ['admin'] },
  { path: '/timesheet-lock', label: 'Chốt công', roles: ['admin'] },
  { path: '/users', label: 'Tài khoản', roles: ['admin'] },
  { path: '/settings', label: 'Cài đặt', roles: ['admin'] },
];

function getVisibleNavItems(userRole) {
  if (!userRole) return [];
  return NAV_ITEMS.filter(item => item.roles.includes(userRole));
}

function canAccessRoute(userRole, targetPath) {
  if (!userRole) return false;
  const item = NAV_ITEMS.find(n => n.path === targetPath);
  if (!item) return true; // Public route or other page
  return item.roles.includes(userRole);
}

function runClientNavAccessTests(assert) {
  console.log('\n🧭 [TEST SUITE: FRONTEND NAVIGATION & ROUTE GUARDS]');

  // TC-UI-NAV-01: Menu hiển thị cho Nhân viên (Employee)
  const empMenu = getVisibleNavItems('employee');
  const empPaths = empMenu.map(m => m.path);
  assert(empPaths.includes('/checkin') && empPaths.includes('/history') && empPaths.includes('/requests') && empPaths.includes('/profile'),
    'TC-UI-NAV-01.1: Nhân viên thấy đúng các mục menu cơ bản (Chấm công, Lịch sử, Đơn từ, Profile)');
  assert(!empPaths.includes('/settings') && !empPaths.includes('/users') && !empPaths.includes('/dashboard') && !empPaths.includes('/reports'),
    'TC-UI-NAV-01.2: Nhân viên không thấy menu Quản trị (Settings, Users, Dashboard, Reports)');

  // TC-UI-NAV-02: Menu hiển thị cho Trưởng phòng (Leader)
  const leadMenu = getVisibleNavItems('leader');
  const leadPaths = leadMenu.map(m => m.path);
  assert(leadPaths.includes('/dashboard') && leadPaths.includes('/staff') && leadPaths.includes('/projects'),
    'TC-UI-NAV-02.1: Trưởng phòng (Leader) thấy Dashboard, Nhân sự, Dự án');
  assert(!leadPaths.includes('/settings') && !leadPaths.includes('/users') && !leadPaths.includes('/reports') && !leadPaths.includes('/timesheet-lock'),
    'TC-UI-NAV-02.2: Trưởng phòng không thấy menu Cài đặt, Báo cáo và Chốt công (Admin only)');

  // TC-UI-NAV-03: Menu hiển thị cho Quản trị viên (Admin)
  const adminMenu = getVisibleNavItems('admin');
  assert(adminMenu.length === NAV_ITEMS.length,
    'TC-UI-NAV-03: Admin thấy đầy đủ toàn bộ 100% các menu trong hệ thống (kèm Báo cáo & Chốt công)');

  // TC-UI-NAV-04: Route Guard — Chặn nhân viên và leader truy cập trực tiếp URL Quản trị
  assert(canAccessRoute('employee', '/settings') === false,
    'TC-UI-NAV-04.1: Chặn Employee truy cập trực tiếp URL /settings');
  assert(canAccessRoute('employee', '/reports') === false,
    'TC-UI-NAV-04.2: Chặn Employee truy cập trực tiếp URL /reports');
  assert(canAccessRoute('leader', '/reports') === false,
    'TC-UI-NAV-04.3: Chặn Leader truy cập trực tiếp URL /reports');
  assert(canAccessRoute('admin', '/reports') === true,
    'TC-UI-NAV-04.4: Cho phép Admin truy cập URL /reports');
}

module.exports = runClientNavAccessTests;
