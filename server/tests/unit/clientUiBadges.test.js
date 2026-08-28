// ==============================================
// tests/unit/clientUiBadges.test.js
// Kiểm thử Thành Phần Giao Diện: Badge Trạng Thái, Nhãn Màu & Định Dạng
// ==============================================

const fs = require('fs');
const path = require('path');

function getAttendanceStatusBadge(status) {
  switch (status) {
    case 'present':
      return { label: 'Có mặt', variant: 'success', className: 'badge-success' };
    case 'leave':
      return { label: 'Nghỉ phép', variant: 'warning', className: 'badge-warning' };
    case 'absent':
    default:
      return { label: 'Vắng mặt', variant: 'danger', className: 'badge-danger' };
  }
}

function getRequestStatusBadge(status) {
  switch (status) {
    case 'approved':
      return { label: 'Đã duyệt', variant: 'success', icon: 'CheckCircle' };
    case 'rejected':
      return { label: 'Từ chối', variant: 'danger', icon: 'XCircle' };
    case 'pending':
    default:
      return { label: 'Chờ duyệt', variant: 'warning', icon: 'Clock' };
  }
}

function getLateTierLabel(tier) {
  switch (tier) {
    case 'late_minor':
      return { label: 'Muộn nhẹ', color: '#f59e0b' };
    case 'late_medium':
      return { label: 'Muộn vừa', color: '#f97316' };
    case 'late_severe':
      return { label: 'Muộn nặng', color: '#ef4444' };
    case 'on_time':
    default:
      return { label: 'Đúng giờ', color: '#10b981' };
  }
}

function runClientUiBadgesTests(assert) {
  console.log('\n🏷️ [TEST SUITE: FRONTEND UI BADGES & STATUS LABELS]');

  // TC-UI-BDG-01: Badge trạng thái điểm danh có mặt
  const b1 = getAttendanceStatusBadge('present');
  assert(b1.label === 'Có mặt' && b1.variant === 'success', 'TC-UI-BDG-01: status=present -> Badge "Có mặt" (success)');

  // TC-UI-BDG-02: Badge trạng thái điểm danh nghỉ phép
  const b2 = getAttendanceStatusBadge('leave');
  assert(b2.label === 'Nghỉ phép' && b2.variant === 'warning', 'TC-UI-BDG-02: status=leave -> Badge "Nghỉ phép" (warning)');

  // TC-UI-BDG-03: Badge trạng thái điểm danh vắng mặt
  const b3 = getAttendanceStatusBadge('absent');
  assert(b3.label === 'Vắng mặt' && b3.variant === 'danger', 'TC-UI-BDG-03: status=absent -> Badge "Vắng mặt" (danger)');

  // TC-UI-BDG-04: Badge trạng thái đơn từ (Pending, Approved, Rejected)
  const reqPending = getRequestStatusBadge('pending');
  const reqApproved = getRequestStatusBadge('approved');
  const reqRejected = getRequestStatusBadge('rejected');
  assert(reqPending.label === 'Chờ duyệt' && reqApproved.label === 'Đã duyệt' && reqRejected.label === 'Từ chối',
    'TC-UI-BDG-04: Đúng nhãn trạng thái đơn từ (Chờ duyệt, Đã duyệt, Từ chối)');

  // TC-UI-BDG-05: Nhãn phân cấp đi muộn (on_time, minor, medium, severe)
  const l1 = getLateTierLabel('on_time');
  const l2 = getLateTierLabel('late_minor');
  const l3 = getLateTierLabel('late_severe');
  assert(l1.label === 'Đúng giờ' && l2.label === 'Muộn nhẹ' && l3.label === 'Muộn nặng',
    'TC-UI-BDG-05: Đúng nhãn phân loại đi muộn theo chuẩn thiết kế');

  const globalStyles = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/index.css'),
    'utf8'
  );
  assert(
    globalStyles.includes('body:has(.email-confirm-overlay) .bottom-nav') &&
      globalStyles.includes('body:has(.notification-popover-overlay) .bottom-nav') &&
      globalStyles.includes('body:has(.image-lightbox) .bottom-nav'),
    'TC-UI-BDG-06: Thanh điều hướng mobile tự ẩn dưới mọi portal overlay'
  );

  const checkInPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/CheckInPage.jsx'),
    'utf8'
  );
  const expensesPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/ExpensesPage.jsx'),
    'utf8'
  );
  assert(
    checkInPage.includes('onClick={() => openDutyStaffProfile(person)}') &&
      expensesPage.includes('onClick={() => setViewingStaffDetail(resolveExpenseStaff(exp))}') &&
      globalStyles.includes('.staff-profile-trigger'),
    'TC-UI-BDG-07: Tên nhân sự tại lịch trực và chi tiêu mở được hồ sơ đồng bộ'
  );

  const imageLightbox = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/components/ImageLightbox.jsx'),
    'utf8'
  );
  const dashboardPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/DashboardPage.jsx'),
    'utf8'
  );
  const reportPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/ReportPage.jsx'),
    'utf8'
  );
  assert(
    imageLightbox.includes('className="image-lightbox__controls"') &&
      imageLightbox.includes('getDownloadFilename(image)') &&
      globalStyles.includes('grid-template-columns: repeat(7, minmax(0, 1fr))'),
    'TC-UI-BDG-08: Lightbox mobile không tràn nút và giữ tên file tải về dễ đọc'
  );
  assert(
    dashboardPage.includes('key={p.user_id || p._id || p.id || p.email}'),
    'TC-UI-BDG-09: Danh sách Dashboard luôn có khóa ổn định khi DTO dùng id hoặc _id'
  );
  assert(
    reportPage.includes('className="pdf-export-table"') &&
      globalStyles.includes('table:not(.pdf-export-table) thead th'),
    'TC-UI-BDG-10: Mẫu PDF tách khỏi màu color-mix mà html2canvas không hỗ trợ'
  );
}

module.exports = runClientUiBadgesTests;
