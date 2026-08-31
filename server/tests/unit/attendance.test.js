// ==============================================
// tests/unit/attendance.test.js
// Kiểm thử Thuật toán Chấm công, Trễ giờ & Giờ Tăng ca (OT)
// Chuẩn múi giờ Việt Nam +07:00 (Asia/Ho_Chi_Minh)
// ==============================================

const { calculateLateTier, calculateOT } = require('../../src/controllers/attendanceController');

function runAttendanceTests(assert) {
  console.log('\n⏰ [TEST SUITE: ATTENDANCE RULES, LATE TIERS & OT (MỐC 09:30:00)]');

  // TC-ATT-01: Check-in trước giờ ca (08:45 với ca 09:00) -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r1 = calculateLateTier('2026-08-31T08:45:00+07:00', '09:00', 30, 60);
  assert(r1.is_late === false && r1.late_tier === 'on_time' && r1.late_minutes === 0 && r1.work_units === 1.0 && r1.credit_symbol === 'x',
    'TC-ATT-01: Check-in 08:45 AM -> Đúng giờ (on_time, late_minutes=0, work_units=1.0, ký hiệu x)');

  // TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r2 = calculateLateTier('2026-08-31T09:00:00+07:00', '09:00', 30, 60);
  assert(r2.is_late === false && r2.late_tier === 'on_time' && r2.late_minutes === 0 && r2.work_units === 1.0 && r2.credit_symbol === 'x',
    'TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (on_time, work_units=1.0, ký hiệu x)');

  // TC-ATT-03: Check-in 09:01 -> Muộn 1p nhưng <= 09:30:00 -> Tính 1 công (x, work_units=1.0, late_minutes=1)
  const r3 = calculateLateTier('2026-08-31T09:01:00+07:00', '09:00', 30, 60);
  assert(r3.is_late === true && r3.late_tier === 'late_minor' && r3.late_minutes === 1 && r3.work_units === 1.0 && r3.credit_symbol === 'x',
    'TC-ATT-03: Check-in 09:01 AM -> Muộn 1p, tính 1 công (x, work_units=1.0, late_minutes=1)');

  // TC-ATT-04: Mốc bắt buộc 1: 09:26 với cấu hình minor_late_mins=10 (legacy seed) -> Vẫn đủ 1 công (x, work_units=1.0, late_minutes=26)
  const r4 = calculateLateTier('2026-08-31T09:26:00+07:00', '09:00', 10, 60);
  assert(r4.is_late === true && r4.late_minutes === 26 && r4.work_units === 1.0 && r4.credit_symbol === 'x',
    'TC-ATT-04: Check-in 09:26 AM (ngay cả khi minor_late_mins=10) -> Ký hiệu "x", work_units=1.0, late_minutes=26');

  // TC-ATT-05: Mốc bắt buộc 2: Đúng 09:30:00 (với minor_late_mins=10) -> x, work_units=1.0, late_minutes=30
  const r5 = calculateLateTier('2026-08-31T09:30:00+07:00', '09:00', 10, 60);
  assert(r5.is_late === true && r5.late_minutes === 30 && r5.work_units === 1.0 && r5.credit_symbol === 'x',
    'TC-ATT-05: Check-in đúng 09:30:00 -> Ký hiệu "x", work_units=1.0, late_minutes=30');

  // TC-ATT-06: Mốc bắt buộc 3: 09:30:01 (sau 09:30:00 đúng 1 giây) -> 0,75x, work_units=0.75
  const r6 = calculateLateTier('2026-08-31T09:30:01+07:00', '09:00', 30, 60);
  assert(r6.is_late === true && r6.work_units === 0.75 && r6.credit_symbol === '0,75x' && r6.late_minutes === 30,
    'TC-ATT-06: Check-in 09:30:01 -> Tự động tính 0,75x, work_units=0.75');

  // TC-ATT-07: Mốc bắt buộc 4: 09:31 -> 0,75x, work_units=0.75, late_minutes=31
  const r7 = calculateLateTier('2026-08-31T09:31:00+07:00', '09:00', 30, 60);
  assert(r7.is_late === true && r7.work_units === 0.75 && r7.credit_symbol === '0,75x' && r7.late_minutes === 31,
    'TC-ATT-07: Check-in 09:31 AM -> Tự động tính 0,75x, work_units=0.75, late_minutes=31');

  // TC-ATT-08: Check-in muộn nặng (10:15) -> 0,75x, work_units=0.75, late_minutes=75, late_severe
  const r8 = calculateLateTier('2026-08-31T10:15:00+07:00', '09:00', 30, 60);
  assert(r8.is_late === true && r8.late_tier === 'late_severe' && r8.late_minutes === 75 && r8.work_units === 0.75 && r8.credit_symbol === '0,75x',
    'TC-ATT-08: Check-in 10:15 AM -> Muộn nặng (+75p), 0,75x, work_units=0.75');

  // TC-ATT-09: Chuyển đổi chuẩn xác từ UTC Server sang Giờ Việt Nam (+07:00)
  // 09:26:00 VN (+07:00) = 02:26:00.000Z
  const rUtc1 = calculateLateTier('2026-08-31T02:26:00.000Z', '09:00', 30, 60);
  assert(rUtc1.is_late === true && rUtc1.late_minutes === 26 && rUtc1.work_units === 1.0 && rUtc1.credit_symbol === 'x',
    'TC-ATT-09.1: UTC 02:26:00Z -> 09:26 VN -> Ký hiệu "x", work_units=1.0, late_minutes=26');

  // 09:30:01 VN (+07:00) = 02:30:01.000Z
  const rUtc2 = calculateLateTier('2026-08-31T02:30:01.000Z', '09:00', 30, 60);
  assert(rUtc2.is_late === true && rUtc2.work_units === 0.75 && rUtc2.credit_symbol === '0,75x',
    'TC-ATT-09.2: UTC 02:30:01Z -> 09:30:01 VN -> Ký hiệu "0,75x", work_units=0.75');

  // TC-ATT-10: Xử lý an toàn đầu vào null / undefined / chuỗi rác
  const rNull = calculateLateTier(null, '09:00', 30, 60);
  assert(rNull.is_late === false && rNull.work_units === 0 && rNull.credit_symbol === '',
    'TC-ATT-10.1: Check-in null -> Xử lý an toàn (is_late=false, work_units=0)');

  const rInvalid = calculateLateTier('invalid-date-string', '09:00', 30, 60);
  assert(rInvalid.is_late === false && rInvalid.work_units === 0 && rInvalid.credit_symbol === '',
    'TC-ATT-10.2: Check-in chuỗi không hợp lệ -> Xử lý an toàn không crash');

  // TC-ATT-11: Tính OT - Check-out trước kết ca (18:15 với ca 18:30) -> 0h OT
  const ot1 = calculateOT('2026-08-31T09:00:00+07:00', '2026-08-31T18:15:00+07:00', '18:30');
  assert(ot1 === 0, 'TC-ATT-11: Check-out 18:15 -> 0.0h OT (Chưa hết ca 18:30)');

  // TC-ATT-12: Tính OT - Check-out lúc 20:00 (Sau 18:30 1.5 tiếng) -> 1.5h OT
  const ot2 = calculateOT('2026-08-31T09:00:00+07:00', '2026-08-31T20:00:00+07:00', '18:30');
  assert(ot2 === 1.5, 'TC-ATT-12: Check-out 20:00 -> Đúng 1.5h OT');

  // TC-ATT-13: Tính OT - Xử lý an toàn checkOut < checkIn hoặc null
  const ot3 = calculateOT('2026-08-31T18:00:00+07:00', '2026-08-31T09:00:00+07:00', '18:30');
  const ot4 = calculateOT(null, null, '18:30');
  assert(ot3 === 0 && ot4 === 0, 'TC-ATT-13: Check-out không hợp lệ hoặc null -> Trả về 0h an toàn');
}

module.exports = runAttendanceTests;
