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
      today_status = att.check_out_time ? 'checked_out' : 'checked_in';
    }

    return {
      user_id: u._id,
      full_name: u.full_name,
      today_status,
      total_hours: att?.total_hours || 0,
      is_late: att?.is_late || false,
      late_tier: att?.late_tier || 'on_time',
      check_in_type: att?.check_in_type || null,
    };
  });

  const checked_in = staff.filter(s => s.today_status === 'checked_in').length;
  const checked_out = staff.filter(s => s.today_status === 'checked_out').length;
  const absent = staff.filter(s => s.today_status === 'absent').length;
  const present_total = staff.filter(s => s.today_status !== 'absent').length;
  const late_count = staff.filter(s => s.is_late).length;

  return {
    total: staff.length,
    checked_in,
    checked_out,
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
  ];

  const mockTodayAtts = [
    { user_id: 'u1', check_in_time: '08:15', check_out_time: null, is_late: false, late_tier: 'on_time' }, // Đang làm việc
    { user_id: 'u2', check_in_time: '08:20', check_out_time: '17:30', total_hours: 8, is_late: false },    // Đã về
    { user_id: 'u3', check_in_time: '09:00', check_out_time: null, is_late: true, late_tier: 'late_medium' }, // Đi muộn, đang làm
    // u4: Không có bản ghi (Vắng mặt)
  ];

  const stats = calculateDashboardSummary(mockUsers, mockTodayAtts);

  // TC-DASH-01: Tổng số nhân sự
  assert(stats.total === 4, 'TC-DASH-01: Tổng số nhân sự = 4');

  // TC-DASH-02: Số nhân sự đang làm việc (checked_in)
  assert(stats.checked_in === 2, 'TC-DASH-02: Số nhân sự đang làm việc tại cty = 2 (u1, u3)');

  // TC-DASH-03: Số nhân sự đã check-out
  assert(stats.checked_out === 1, 'TC-DASH-03: Số nhân sự đã về = 1 (u2)');

  // TC-DASH-04: Số nhân sự vắng mặt
  assert(stats.absent === 1, 'TC-DASH-04: Số nhân sự vắng mặt hôm nay = 1 (u4)');

  // TC-DASH-05: Tổng số người có mặt & số người đi muộn
  assert(stats.present_total === 3 && stats.late_count === 1 && stats.on_time_count === 2,
    'TC-DASH-05: Tổng có mặt = 3, Đi muộn = 1, Đúng giờ = 2');
}

module.exports = runDashboardStatsTests;
