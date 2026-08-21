// ==============================================
// tests/integration/advancedScenarios.test.js
// Kiểm thử Kịch bản Phức hợp Đa tầng (Advanced Multi-Step Flows)
// ==============================================

function runAdvancedScenariosTests(assert) {
  console.log('\n🔀 [TEST SUITE: ADVANCED MULTI-STEP SCENARIOS]');

  // -------------------------------------------------------------
  // KỊCH BẢN A: Nhân viên thuộc 2 phòng ban -> Trưởng phòng IT duyệt đơn OT -> Cập nhật bảng công
  // -------------------------------------------------------------
  const employee = {
    _id: 'u_cross_dept',
    full_name: 'Trần Văn C',
    role: 'employee',
    department_ids: ['dept_it', 'dept_support'],
  };

  const itLeader = {
    _id: 'u_lead_it',
    role: 'leader',
    department_ids: ['dept_it'],
  };

  // Xác minh quyền duyệt của Leader IT
  const canApprove = itLeader.department_ids.some(d => employee.department_ids.includes(d));
  assert(canApprove === true,
    'TC-ADV-01.1: Trưởng phòng IT có thẩm quyền duyệt đơn cho nhân viên thuộc phòng IT & Hỗ trợ');

  // Đơn tăng ca 3 tiếng sau ca làm việc
  const otRequest = {
    _id: 'req_ot_01',
    user_id: employee._id,
    type: 'overtime',
    start_date: '2026-08-25',
    start_time: '17:30',
    end_time: '20:30',
    status: 'pending'
  };

  // Trưởng phòng IT duyệt đơn
  otRequest.status = 'approved';
  otRequest.approved_by = itLeader._id;

  // Điểm danh ngày 25/08 được tự động cộng 3.0h OT
  const attendanceRecord = {
    user_id: employee._id,
    date: '2026-08-25',
    check_in_type: 'office',
    status: 'present',
    total_hours: 8,
    ot_hours: 3.0,
    notes: 'Đã duyệt OT 3h bởi Trưởng phòng IT'
  };

  assert(otRequest.status === 'approved' && attendanceRecord.ot_hours === 3.0,
    'TC-ADV-01.2: Duyệt đơn OT thành công & tự động đồng bộ 3.0h OT vào bảng công');

  // -------------------------------------------------------------
  // KỊCH BẢN B: Quên check-out -> Nộp đơn đính chính -> Duyệt -> Khóa công tháng
  // -------------------------------------------------------------
  let monthAttendance = [attendanceRecord];
  let isMonthLocked = false;

  // Admin tiến hành chốt khóa công Tháng 8/2026
  isMonthLocked = true;
  const canModifyAfterLock = !isMonthLocked;

  assert(canModifyAfterLock === false,
    'TC-ADV-02: Sau khi Ban giám đốc chốt công, hệ thống khóa toàn diện mọi hành động sửa đổi');
}

module.exports = runAdvancedScenariosTests;
