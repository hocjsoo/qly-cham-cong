// ==============================================
// tests/unit/timesheetLock.test.js
// Kiểm thử Ma trận Công, Ký hiệu Bảng công Mẫu ET_Staff 2026
// & Cơ chế Khóa Bảng công (Timesheet Lock)
// ==============================================

const SYMBOL_TO_STATUS_MAP = {
  'x': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,75x': { total_hours: 6, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,5x': { total_hours: 4, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  'CT1': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác trong nước (CT1)' },
  'CT2': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác nước ngoài (CT2)' },
  'WFH': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'wfh', status: 'present', notes: 'Work from home (WFH)' },
  'P': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ phép năm (P)' },
  'O': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ ốm (O)' },
  'KL': { total_hours: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Nghỉ không lương (KL)' },
  'K': { total_hours: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Khác (K)' },
};

function generateHeaderDays(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const headerDays = [];
  const weekdayVN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weekdayStr = weekdayVN[dateObj.getDay()];

    headerDays.push({
      day: d,
      dayStr: String(d).padStart(2, '0'),
      weekday: weekdayStr,
      dateStr,
      isSunday: dateObj.getDay() === 0,
      isSaturday: dateObj.getDay() === 6,
    });
  }
  return headerDays;
}

function checkTimesheetLock(locks, userId, month, year) {
  const globalLock = locks.find(l => l.user_id === null && l.month === month && l.year === year && l.is_locked);
  if (globalLock) return { isLocked: true, reason: 'Bảng công tháng này đã được Ban giám đốc chốt khóa toàn bộ.' };

  const userLock = locks.find(l => l.user_id === userId && l.month === month && l.year === year && l.is_locked);
  if (userLock) return { isLocked: true, reason: 'Bảng công của nhân viên này đã bị khóa riêng lẻ.' };

  return { isLocked: false };
}

function runTimesheetTests(assert) {
  console.log('\n📊 [TEST SUITE: TIMESHEET MATRIX & LOCK SYSTEM]');

  // TC-TIME-01: Kiểm tra Ánh xạ ký hiệu chuẩn ET_Staff 2026
  assert(SYMBOL_TO_STATUS_MAP['x'].total_hours === 8 && SYMBOL_TO_STATUS_MAP['x'].status === 'present',
    'TC-TIME-01.1: Ký hiệu "x" -> 8h, status=present');

  assert(SYMBOL_TO_STATUS_MAP['0,5x'].total_hours === 4 && SYMBOL_TO_STATUS_MAP['0,5x'].status === 'present',
    'TC-TIME-01.2: Ký hiệu "0,5x" -> 4h nửa ngày công');

  assert(SYMBOL_TO_STATUS_MAP['CT1'].check_in_type === 'site' && SYMBOL_TO_STATUS_MAP['CT1'].total_hours === 8,
    'TC-TIME-01.3: Ký hiệu "CT1" -> Công tác trong nước (site, 8h)');

  assert(SYMBOL_TO_STATUS_MAP['WFH'].check_in_type === 'wfh' && SYMBOL_TO_STATUS_MAP['WFH'].total_hours === 8,
    'TC-TIME-01.4: Ký hiệu "WFH" -> Làm việc tại nhà (wfh, 8h)');

  assert(SYMBOL_TO_STATUS_MAP['P'].status === 'leave' && SYMBOL_TO_STATUS_MAP['P'].total_hours === 8,
    'TC-TIME-01.5: Ký hiệu "P" -> Nghỉ phép năm có lương (8h công)');

  assert(SYMBOL_TO_STATUS_MAP['KL'].status === 'absent' && SYMBOL_TO_STATUS_MAP['KL'].total_hours === 0,
    'TC-TIME-01.6: Ký hiệu "KL" -> Nghỉ không lương (0h công)');

  // TC-TIME-02: Kiểm tra sinh Ma trận ngày theo tháng & năm
  const headerAug2026 = generateHeaderDays(8, 2026);
  assert(headerAug2026.length === 31, 'TC-TIME-02.1: Tháng 8/2026 có đúng 31 ngày');
  assert(headerAug2026[0].dateStr === '2026-08-01' && headerAug2026[0].weekday === 'T7',
    'TC-TIME-02.2: Ngày 01/08/2026 rơi vào Thứ Bảy (T7)');

  const headerFeb2024Leap = generateHeaderDays(2, 2024);
  assert(headerFeb2024Leap.length === 29, 'TC-TIME-02.3: Năm nhuận 2024 Tháng 2 có đúng 29 ngày');

  // TC-TIME-03: Cơ chế Khóa Bảng công Toàn cục (Global Lock)
  const mockLocks = [
    { user_id: null, month: 7, year: 2026, is_locked: true },
    { user_id: 'user_123', month: 8, year: 2026, is_locked: true },
  ];

  const lockCheck1 = checkTimesheetLock(mockLocks, 'user_999', 7, 2026);
  assert(lockCheck1.isLocked === true, 'TC-TIME-03.1: Chặn ghi đè khi Tháng 7/2026 bị Khóa Toàn cục');

  // TC-TIME-04: Khóa bảng công riêng lẻ cho 1 nhân viên
  const lockCheck2 = checkTimesheetLock(mockLocks, 'user_123', 8, 2026);
  assert(lockCheck2.isLocked === true, 'TC-TIME-04.1: Chặn sửa công nhân viên user_123 khi đã bị khóa riêng');

  const lockCheck3 = checkTimesheetLock(mockLocks, 'user_456', 8, 2026);
  assert(lockCheck3.isLocked === false, 'TC-TIME-04.2: Cho phép sửa công nhân viên user_456 khi chưa bị khóa');
}

module.exports = runTimesheetTests;
