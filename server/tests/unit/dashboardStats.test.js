// ==============================================
// tests/unit/dashboardStats.test.js
// Kiểm thử Thuật toán Tổng hợp Thống kê Dashboard (Realtime Stats)
// ==============================================

function calculateDashboardSummary(users, todayAttendances) {
  const attMap = new Map();
  todayAttendances.forEach(a => attMap.set(a.user_id.toString(), a));

  const staff = users.map(u => {
    const att = attMap.get(u._id.toString());
    let today_status = 'absent';
    if (att) {
      if (att.check_in_time) {
        today_status = att.check_out_time ? 'checked_out' : 'checked_in';
      } else if (att.status === 'leave' || att.status === 'holiday') {
        today_status = att.status;
      } else if (att.status === 'present' && ((att.work_units ?? 0) > 0 || (att.total_hours ?? 0) > 0)) {
        today_status = 'checked_in';
      } else {
        today_status = 'absent';
      }
    }

    return {
      user_id: u._id,
      full_name: u.full_name,
      today_status,
      total_hours: att?.total_hours ?? 0,
      work_units: att ? (att.work_units ?? (att.status === 'present' ? 1.0 : 0)) : 0,
      is_late: att?.is_late || false,
      late_tier: att?.late_tier || 'on_time',
      check_in_type: att?.check_in_type || null,
      status: att?.status || 'absent',
    };
  });

  const checked_in = staff.filter(s => s.today_status === 'checked_in').length;
  const checked_out = staff.filter(s => s.today_status === 'checked_out').length;
  const leave = staff.filter(s => s.today_status === 'leave').length;
  const holiday = staff.filter(s => s.today_status === 'holiday').length;
  const absent = staff.filter(s => s.today_status === 'absent').length;
  const present_total = staff.filter(s => ['checked_in', 'checked_out'].includes(s.today_status)).length;
  const late_count = staff.filter(s => s.is_late).length;

  return {
    total: staff.length,
    checked_in,
    checked_out,
    leave,
    holiday,
    absent,
    present_total,
    late_count,
    on_time_count: present_total - late_count,
    staff
  };
}

function runDashboardStatsTests(assert) {
  console.log('\n📈 [TEST SUITE: DASHBOARD REALTIME STATS]');

  const mockUsers = [
    { _id: 'u1', full_name: 'Nhân viên 1' },
    { _id: 'u2', full_name: 'Nhân viên 2' },
    { _id: 'u3', full_name: 'Nhân viên 3' },
    { _id: 'u4', full_name: 'Nhân viên 4' },
    { _id: 'u5', full_name: 'Nhân viên 5' },
    { _id: 'u6', full_name: 'Nhân viên 6' },
    { _id: 'u7', full_name: 'Nhân viên 7' },
  ];

  const mockTodayAtts = [
    { user_id: 'u1', check_in_time: '08:15', check_out_time: null, is_late: false, late_tier: 'on_time', status: 'present', work_units: 1.0, total_hours: 4 }, // Đang làm việc
    { user_id: 'u2', check_in_time: '08:20', check_out_time: '17:30', total_hours: 8, work_units: 1.0, is_late: false, status: 'present' }, // Đã về
    { user_id: 'u3', check_in_time: '09:00', check_out_time: null, is_late: true, late_tier: 'late_medium', status: 'present', work_units: 0.75, total_hours: 3.5 }, // Đi muộn, đang làm
    // u4: Không có bản ghi (Vắng mặt)
    { user_id: 'u5', check_in_time: null, check_out_time: null, status: 'leave', work_units: 0, total_hours: 0 }, // Nghỉ phép
    { user_id: 'u6', check_in_time: null, check_out_time: null, status: 'holiday', work_units: 1.0, total_hours: 8 }, // Nghỉ lễ
    { user_id: 'u7', check_in_time: null, check_out_time: null, status: 'absent', work_units: 0, total_hours: 0, ot_hours: 3.5 }, // OT-only Chủ nhật (Không tính công ngày)
  ];

  const stats = calculateDashboardSummary(mockUsers, mockTodayAtts);

  // TC-DASH-01: Tổng số nhân sự
  assert(stats.total === 7, 'TC-DASH-01: Tổng số nhân sự = 7');

  // TC-DASH-02: Số nhân sự đang làm việc (checked_in)
  assert(stats.checked_in === 2, 'TC-DASH-02: Số nhân sự đang làm việc tại cty = 2 (u1, u3)');

  // TC-DASH-03: Số nhân sự đã check-out
  assert(stats.checked_out === 1, 'TC-DASH-03: Số nhân sự đã về = 1 (u2)');

  // TC-DASH-04: Số nhân sự nghỉ phép và nghỉ lễ
  assert(stats.leave === 1 && stats.holiday === 1, 'TC-DASH-04: Số nhân sự nghỉ phép = 1 (u5), nghỉ lễ = 1 (u6)');

  // TC-DASH-05: Số nhân sự vắng mặt (bao gồm chưa chấm công và OT-only ngày nghỉ)
  assert(stats.absent === 2, 'TC-DASH-05: Số nhân sự vắng mặt hôm nay = 2 (u4 không có bản ghi, u7 OT-only status absent)');

  // TC-DASH-06: Tổng số người có mặt & số người đi muộn
  assert(stats.present_total === 3 && stats.late_count === 1 && stats.on_time_count === 2,
    'TC-DASH-06: Tổng có mặt = 3, Đi muộn = 1, Đúng giờ = 2 (Không tính OT-only hay nghỉ phép vào present_total)');

  // TC-DASH-07: Khớp tổng các nhóm trạng thái
  assert(stats.checked_in + stats.checked_out + stats.leave + stats.holiday + stats.absent === stats.total,
    'TC-DASH-07: Tổng các nhóm trạng thái (checked_in + checked_out + leave + holiday + absent) khớp chính xác 100% với total nhân sự');

  // TC-DASH-08: Bảo toàn work_units = 0 cho OT-only
  const u7Staff = stats.staff.find(s => s.user_id === 'u7');
  assert(u7Staff && u7Staff.work_units === 0 && u7Staff.today_status === 'absent',
    'TC-DASH-08: Nhân viên OT-only giữ nguyên work_units = 0 (không bị toán tử OR ép thành 1.0 công)');
}

module.exports = runDashboardStatsTests;
