const { __test } = require('../../src/controllers/ttsScheduleController');

function runTtsWeeklyScheduleTests(assert) {
  console.log('\n📅 [TEST SUITE: TTS WEEKLY AVAILABILITY & DUTY ROSTER]');
  const meta = __test.buildWeekMeta('2026-08-31');
  assert(meta?.week_end === '2026-09-05' && meta.allowed_dates.length === 6,
    'TC-TTS-01: Sinh đúng tuần TTS từ Thứ 2 đến Thứ 7');
  assert(meta?.registration_deadline.toISOString() === '2026-08-30T16:59:59.999Z',
    'TC-TTS-02: Hạn đăng ký là 23:59 Chủ nhật theo múi giờ Việt Nam');
  assert(__test.buildWeekMeta('2026-09-01') === null,
    'TC-TTS-03: Từ chối week_start không phải Thứ 2');

  const slots = __test.sanitizeSlots([
    { date: '2026-08-31', morning: true, afternoon: false },
    { date: '2026-09-06', morning: true, afternoon: true },
    { date: '2026-09-01', morning: 'true', afternoon: true },
  ], meta.allowed_dates);
  assert(slots.length === 6 && slots[0].morning === true && slots[1].morning === false && slots[1].afternoon === true,
    'TC-TTS-04: Chuẩn hóa checkbox Boolean và loại ngày ngoài tuần');
  assert(__test.isScheduleManager({ role: 'admin' }) && __test.isScheduleManager({ role: 'leader' }),
    'TC-TTS-05: Admin và Leader được quản lý lịch TTS');
  assert(__test.isScheduleManager({ role: 'employee', can_manage_tts_schedule: true }),
    'TC-TTS-06: Nhân sự được cấp quyền riêng có thể phân công');
  assert(!__test.isScheduleManager({ role: 'employee', can_manage_tts_schedule: false }),
    'TC-TTS-07: Nhân viên thường chỉ có quyền xem');
  const attendanceFields = ['check_in_time', 'check_out_time', 'total_hours', 'ot_hours', 'status'];
  assert(attendanceFields.every(field => !Object.prototype.hasOwnProperty.call(slots[0], field)),
    'TC-TTS-08: Dữ liệu đăng ký TTS không chứa trường chấm công');
}

module.exports = runTtsWeeklyScheduleTests;
