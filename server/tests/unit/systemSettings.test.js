// ==============================================
// tests/unit/systemSettings.test.js
// Kiểm thử Cấu hình Hệ thống & Ca Làm việc (System Settings)
// ==============================================

function validateSystemSettings(settings) {
  const errors = [];

  const { work_start_time, work_end_time, lunch_break_start, lunch_break_end, minor_late_mins, medium_late_mins } = settings;

  if (work_start_time && work_end_time) {
    if (work_start_time >= work_end_time) {
      errors.push('Giờ bắt đầu ca làm việc phải trước giờ kết thúc ca.');
    }
  }

  if (lunch_break_start && lunch_break_end) {
    if (lunch_break_start >= lunch_break_end) {
      errors.push('Giờ bắt đầu nghỉ trưa phải trước giờ kết thúc nghỉ trưa.');
    }
  }

  if (minor_late_mins !== undefined && medium_late_mins !== undefined) {
    if (Number(minor_late_mins) <= 0 || Number(medium_late_mins) <= Number(minor_late_mins)) {
      errors.push('Ngưỡng muộn vừa phải lớn hơn ngưỡng muộn nhẹ và lớn hơn 0.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function runSystemSettingsTests(assert) {
  console.log('\n⚙️ [TEST SUITE: SYSTEM SETTINGS VALIDATION]');

  // TC-SET-01: Cấu hình ca làm việc chuẩn hợp lệ
  const validConfig = {
    work_start_time: '08:30',
    work_end_time: '17:30',
    lunch_break_start: '12:00',
    lunch_break_end: '13:00',
    minor_late_mins: 10,
    medium_late_mins: 30,
  };
  const res1 = validateSystemSettings(validConfig);
  assert(res1.isValid === true && res1.errors.length === 0,
    'TC-SET-01: Cấu hình ca làm việc & ngưỡng đi muộn chuẩn hợp lệ');

  // TC-SET-02: Bắt lỗi khi giờ bắt đầu ca muộn hơn giờ kết thúc
  const invalidShift = { ...validConfig, work_start_time: '18:00', work_end_time: '17:30' };
  const res2 = validateSystemSettings(invalidShift);
  assert(res2.isValid === false && res2.errors[0].includes('trước giờ kết thúc'),
    'TC-SET-02: Bắt lỗi khi giờ bắt đầu ca làm việc >= giờ kết thúc ca');

  // TC-SET-03: Bắt lỗi khi ngưỡng muộn nhẹ lớn hơn hoặc bằng ngưỡng muộn vừa
  const invalidThreshold = { ...validConfig, minor_late_mins: 40, medium_late_mins: 30 };
  const res3 = validateSystemSettings(invalidThreshold);
  assert(res3.isValid === false && res3.errors[0].includes('Ngưỡng muộn vừa phải lớn hơn'),
    'TC-SET-03: Bắt lỗi khi ngưỡng muộn nhẹ (40p) >= ngưỡng muộn vừa (30p)');
}

module.exports = runSystemSettingsTests;
