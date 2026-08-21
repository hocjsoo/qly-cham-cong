// ==============================================
// tests/unit/correctionWorkflow.test.js
// Kiểm thử Quy trình Đính chính Giờ chấm công (Attendance Corrections)
// ==============================================

function applyCorrectionApproval(originalAtt, correction, reviewerId, note) {
  const newIn = correction.proposed_check_in || (originalAtt ? originalAtt.check_in_time : null);
  const newOut = correction.proposed_check_out || (originalAtt ? originalAtt.check_out_time : null);

  let totalHours = 0;
  if (newIn && newOut) {
    totalHours = parseFloat(((new Date(newOut) - new Date(newIn)) / (1000 * 60 * 60)).toFixed(1));
  }

  const updatedAtt = {
    ...(originalAtt || { user_id: correction.user_id, date: correction.date, check_in_type: 'office' }),
    check_in_time: newIn,
    check_out_time: newOut,
    total_hours: Math.max(0, totalHours),
    notes: `Đã đính chính giờ (${note || 'Duyệt đính chính'})`,
  };

  const updatedCorrection = {
    ...correction,
    status: 'approved',
    reviewed_by: reviewerId,
    reviewed_at: new Date(),
    reviewer_note: note || 'Đã chấp nhận đính chính'
  };

  const auditLog = {
    user_id: reviewerId,
    target_user_id: correction.user_id,
    action: 'CORRECTION_APPROVED',
    date: correction.date,
    old_hours: originalAtt ? originalAtt.total_hours : 0,
    new_hours: updatedAtt.total_hours,
  };

  return { updatedAtt, updatedCorrection, auditLog };
}

function runCorrectionTests(assert) {
  console.log('\n📝 [TEST SUITE: ATTENDANCE CORRECTION & AUDIT TRAIL]');

  // TC-CORR-01: Nhân viên gửi đơn đính chính giờ quên check-out
  const mockCorrection = {
    _id: 'corr_01',
    user_id: 'u_emp1',
    date: '2026-08-15',
    field: 'check_out_time',
    proposed_check_in: '2026-08-15T08:30:00+07:00',
    proposed_check_out: '2026-08-15T17:30:00+07:00',
    reason: 'Quên check-out khi ra về',
    status: 'pending'
  };

  const originalAtt = {
    _id: 'att_01',
    user_id: 'u_emp1',
    date: '2026-08-15',
    check_in_time: '2026-08-15T08:30:00+07:00',
    check_out_time: null,
    total_hours: 0,
  };

  // TC-CORR-02: Duyệt đính chính -> Tính lại tổng giờ làm việc = 9.0h (08:30 -> 17:30)
  const result = applyCorrectionApproval(originalAtt, mockCorrection, 'u_admin', 'Đã xác nhận với trưởng bộ phận');
  assert(result.updatedCorrection.status === 'approved',
    'TC-CORR-02.1: Trạng thái đính chính chuyển thành approved');
  assert(result.updatedAtt.total_hours === 9.0 && result.updatedAtt.check_out_time === '2026-08-15T17:30:00+07:00',
    'TC-CORR-02.2: Cập nhật giờ check-out và tự động tính lại tổng giờ công = 9.0h');

  // TC-CORR-03: Ghi nhận nhật ký thay đổi AuditLog
  assert(result.auditLog.action === 'CORRECTION_APPROVED' && result.auditLog.new_hours === 9.0 && result.auditLog.old_hours === 0,
    'TC-CORR-03: Tự động ghi nhật ký hệ thống (AuditLog) truy vết việc sửa công');
}

module.exports = runCorrectionTests;
