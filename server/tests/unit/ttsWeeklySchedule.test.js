const { __test } = require('../../src/controllers/ttsScheduleController');
const { isInactiveEmploymentStatus, getActiveEmploymentFilter } = require('../../src/utils/employmentStatus');

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
  assert(__test.isScheduleAdmin({ role: 'admin' }) && !__test.isScheduleAdmin({ role: 'leader', can_manage_tts_schedule: true }),
    'TC-TTS-05: Chỉ Admin được sửa lịch đăng ký, nội dung và trạng thái khóa');
  assert(__test.canManageDuties({ role: 'employee', can_manage_tts_schedule: true }),
    'TC-TTS-06: Nhân sự được cấp quyền riêng có thể phân công trực nhật');
  assert(!__test.canManageDuties({ role: 'employee', can_manage_tts_schedule: false }),
    'TC-TTS-07: Nhân viên thường chỉ có quyền xem');
  assert(__test.canManageDuties({ role: 'leader', can_manage_tts_schedule: true }),
    'TC-TTS-08: Leader chỉ được phân công trực nhật khi Admin cấp quyền riêng');
  const attendanceFields = ['check_in_time', 'check_out_time', 'total_hours', 'ot_hours', 'status'];
  assert(attendanceFields.every(field => !Object.prototype.hasOwnProperty.call(slots[0], field)),
    'TC-TTS-09: Dữ liệu đăng ký TTS không chứa trường chấm công');
  assert(['Da nghi viec', 'Nghỉ việc', 'Nghi om', 'Nghi thai san', 'Khac'].every(isInactiveEmploymentStatus),
    'TC-TTS-10: Nhận diện đủ trạng thái nhân sự đã nghỉ bằng cả tiếng Việt có dấu và không dấu');
  const activeFilter = getActiveEmploymentFilter({ employee_type: 'TTS' });
  assert(activeFilter.employee_type === 'TTS' && activeFilter.is_active.$ne === false && activeFilter.employment_status.$nin.includes('Da nghi viec'),
    'TC-TTS-11: Truy vấn Lịch TTS loại nhân sự đã nghỉ ngay từ database');
  const rotationHistory = __test.buildDutyRotationHistory([
    { duties: [{ date: '2026-08-10', office_cleaning_user_ids: ['u1', 'u2'], restroom_cleaning_user_ids: [] }] },
    { duties: [{ date: '2026-08-17', office_cleaning_user_ids: ['u1'], restroom_cleaning_user_ids: ['u3'] }] },
  ]);
  assert(rotationHistory.get('u1')?.assignment_count === 2 && rotationHistory.get('u1')?.last_duty_date === '2026-08-17',
    'TC-TTS-12: Tổng hợp đúng số lượt và ngày trực gần nhất từ các tuần trước');
  assert(!rotationHistory.has('u4'),
    'TC-TTS-13: Người chưa từng trực không bị tạo lịch sử giả và được ưu tiên luân phiên');
}

module.exports = runTtsWeeklyScheduleTests;
