// ==============================================
// tests/unit/holidayMatrix.test.js
// Kiểm thử Ngày Nghỉ Lễ & Tính toán Ngày Công Chuẩn trong Tháng
// ==============================================

function getHolidayDatesList(holidays) {
  const dates = [];
  holidays.forEach(h => {
    const start = new Date(h.date);
    const end = new Date(h.end_date || h.date);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      dates.push(dt.toISOString().slice(0, 10));
    }
  });
  return [...new Set(dates)];
}

function calculateStandardWorkingDays(month, year, holidayDates = [], excludeSaturday = false) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = CN, 6 = T7
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);
    const isHoliday = holidayDates.includes(dateStr);

    if (isSunday) continue;
    if (excludeSaturday && isSaturday) continue;
    if (isHoliday) continue;

    workingDays++;
  }
  return workingDays;
}

function runHolidayTests(assert) {
  console.log('\n🎉 [TEST SUITE: HOLIDAY & STANDARD WORK DAYS MATRIX]');

  const mockHolidays = [
    { name: 'Nghỉ Lễ Quốc Khánh', date: '2026-09-01', end_date: '2026-09-02', is_paid: true },
    { name: 'Tết Dương Lịch', date: '2026-01-01', end_date: '2026-01-01', is_paid: true },
  ];

  // TC-HOLI-01: Mở rộng danh sách ngày nghỉ lễ liên tiếp (01/09 -> 02/09)
  const holidayDates = getHolidayDatesList(mockHolidays);
  assert(holidayDates.includes('2026-09-01') && holidayDates.includes('2026-09-02'),
    'TC-HOLI-01: Mở rộng đầy đủ dải ngày nghỉ lễ từ 01/09 đến 02/09');

  // TC-HOLI-02: Tính số ngày công chuẩn của Tháng 8/2026 (31 ngày, có 5 CN, 0 ngày lễ) -> 26 ngày công
  const workDaysAug2026 = calculateStandardWorkingDays(8, 2026, [], false);
  assert(workDaysAug2026 === 26, 'TC-HOLI-02: Tháng 8/2026 có 31 ngày - 5 Chủ nhật = 26 ngày làm việc');

  // TC-HOLI-03: Tính số ngày công chuẩn Tháng 9/2026 (30 ngày, 4 CN, 2 ngày lễ trong tuần) -> 24 ngày công
  const workDaysSep2026 = calculateStandardWorkingDays(9, 2026, ['2026-09-01', '2026-09-02'], false);
  assert(workDaysSep2026 === 24, 'TC-HOLI-03: Tháng 9/2026 trừ 4 Chủ nhật & 2 ngày Lễ Quốc khánh = 24 ngày làm việc');
}

module.exports = runHolidayTests;
