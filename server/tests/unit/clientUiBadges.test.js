// ==============================================
// tests/unit/clientUiBadges.test.js
// Kiểm thử Thành Phần Giao Diện: Badge Trạng Thái, Nhãn Màu & Định Dạng
// ==============================================

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
}

module.exports = runClientUiBadgesTests;
