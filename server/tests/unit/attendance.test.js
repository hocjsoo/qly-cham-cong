// ==============================================
// tests/unit/attendance.test.js
// Kiểm thử Thuật toán Chấm công, Trễ giờ & Giờ Tăng ca (OT)
// Chuẩn múi giờ Việt Nam +07:00 (Asia/Ho_Chi_Minh)
// ==============================================

const {
  calculateLateTier,
  hasExplicitSymbolOverride,
  calculateOT,
  calculateRawTotalHours,
  calculateAttendanceMetrics,
} = require('../../src/controllers/attendanceController');

function runAttendanceTests(assert) {
  console.log('\n⏰ [TEST SUITE: ATTENDANCE RULES, PRO-RATA WORK UNITS & OT (CÔNG = 1 - PHÚT THIẾU/480)]');

  // TC-ATT-01: Check-in trước giờ ca (08:45 với ca 09:00) -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r1 = calculateLateTier('2026-08-31T08:45:00+07:00', '09:00', 30, 60);
  assert(r1.is_late === false && r1.late_tier === 'on_time' && r1.late_minutes === 0 && r1.work_units === 1.0 && r1.credit_symbol === 'x',
    'TC-ATT-01: Check-in 08:45 AM -> Đúng giờ (on_time, late_minutes=0, work_units=1.0, ký hiệu x)');

  // TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r2 = calculateLateTier('2026-08-31T09:00:00+07:00', '09:00', 30, 60);
  assert(r2.is_late === false && r2.late_tier === 'on_time' && r2.late_minutes === 0 && r2.work_units === 1.0 && r2.credit_symbol === 'x',
    'TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (on_time, work_units=1.0, ký hiệu x)');

  // [NEW 20/10/2026] Công trừ theo phút thiếu: công = 1 - phút muộn / 480. Mốc 09:30 chỉ còn là nhãn.
  // TC-ATT-03: Check-in 09:01 -> Muộn 1p -> 0,9975 công (work_units=0.9975, late_minutes=1)
  const r3 = calculateLateTier('2026-08-31T09:01:00+07:00', '09:00', 30, 60);
  assert(r3.is_late === true && r3.late_tier === 'late_minor' && r3.late_minutes === 1 && r3.work_units === 0.9979 && r3.credit_symbol === '0,9979x',
    'TC-ATT-03: Check-in 09:01 AM -> Muộn 1p, trừ theo phút thiếu (work_units=0.9979, ký hiệu 0,9979x)');

  // TC-ATT-04: 09:26 với minor_late_mins=10 (legacy seed) -> 0,9458 công, late_minutes=26
  const r4 = calculateLateTier('2026-08-31T09:26:00+07:00', '09:00', 10, 60);
  assert(r4.is_late === true && r4.late_minutes === 26 && r4.work_units === 0.9458 && r4.credit_symbol === '0,9458x',
    'TC-ATT-04: Check-in 09:26 AM -> Muộn 26p, trừ 26/480 công (work_units=0.9458, ký hiệu 0,9458x)');

  // TC-ATT-05: Đúng 09:30:00 (minor_late_mins=10) -> 0,9375 công, late_minutes=30
  const r5 = calculateLateTier('2026-08-31T09:30:00+07:00', '09:00', 10, 60);
  assert(r5.is_late === true && r5.late_minutes === 30 && r5.work_units === 0.9375 && r5.credit_symbol === '0,9375x',
    'TC-ATT-05: Check-in 09:30:00 -> Muộn 30p, trừ 1/16 công (work_units=0.9375, ký hiệu 0,9375x)');

  // TC-ATT-06: 09:30:01 -> floor 30p -> 0,9375x, work_units=0.9375
  const r6 = calculateLateTier('2026-08-31T09:30:01+07:00', '09:00', 30, 60);
  assert(r6.is_late === true && r6.work_units === 0.9375 && r6.credit_symbol === '0,9375x' && r6.late_minutes === 30,
    'TC-ATT-06: Check-in 09:30:01 -> Muộn 30p, trừ theo phút thiếu (work_units=0.9375, ký hiệu 0,9375x)');

  // TC-ATT-07: 09:31 -> 0,9354 công, late_minutes=31
  const r7 = calculateLateTier('2026-08-31T09:31:00+07:00', '09:00', 30, 60);
  assert(r7.is_late === true && r7.work_units === 0.9354 && r7.credit_symbol === '0,9354x' && r7.late_minutes === 31,
    'TC-ATT-07: Check-in 09:31 AM -> Muộn 31p, trừ theo phút thiếu (work_units=0.9354, ký hiệu 0,9354x)');

  // TC-ATT-08: Check-in muộn nặng (10:15 = 75p) -> 0,8438 công, late_severe
  const r8 = calculateLateTier('2026-08-31T10:15:00+07:00', '09:00', 30, 60);
  assert(r8.is_late === true && r8.late_tier === 'late_severe' && r8.late_minutes === 75 && r8.work_units === 0.8438 && r8.credit_symbol === '0,8438x',
    'TC-ATT-08: Check-in 10:15 AM -> Muộn 75p, trừ theo phút thiếu (work_units=0.8438, ký hiệu 0,8438x)');

  // TC-ATT-08.1 [NEW]: Muộn đúng 1 tiếng = trừ 1/8 công (yêu cầu khách Trường Nd 20/10/2026)
  const r8h1 = calculateLateTier('2026-08-31T10:00:00+07:00', '09:00', 30, 60);
  assert(r8h1.is_late === true && r8h1.work_units === 0.875 && r8h1.credit_symbol === '0,875x',
    'TC-ATT-08.1: Muộn 60p -> trừ 1/8 công (work_units=0.875, ký hiệu 0,875x)');

  // TC-ATT-08.2 [NEW]: Muộn hơn 8 tiếng -> trần 0 công (không âm)
  const r8h2 = calculateLateTier('2026-08-31T17:30:00+07:00', '09:00', 30, 60);
  assert(r8h2.is_late === true && r8h2.work_units === 0 && r8h2.credit_symbol === 'KL',
    'TC-ATT-08.2: Muộn 510p > 480p -> trần 0 công (work_units=0, ký hiệu KL)');

  // TC-ATT-08.3 [NEW]: Chuẩn ngày cấu hình 9.5h (570p): muộn 60p -> 0.8947
  const r8h3 = calculateLateTier('2026-08-31T10:00:00+07:00', '09:00', 30, 60, 570);
  assert(r8h3.is_late === true && r8h3.work_units === 0.8947 && r8h3.credit_symbol === '0,8947x',
    'TC-ATT-08.3: Chuẩn ngày 570p, muộn 60p -> 0,8947x');

  // TC-ATT-08.4 [NEW 20/10/2026]: Guard chống ghi đè ký hiệu Admin đã chốt (defect checkout clobber)
  assert(hasExplicitSymbolOverride('Ký hiệu: [0,875x] | Sửa: Admin') === true,
    'TC-ATT-08.4a: notes có [0,875x] (ký hiệu động) -> phát hiện đã override');
  assert(hasExplicitSymbolOverride('Ký hiệu: [1,5x] | Công hệ số') === true,
    'TC-ATT-08.4b: notes có [1,5x] -> phát hiện đã override');
  assert(hasExplicitSymbolOverride('Cách VP: 120m | IP: 1.2.3.4') === false,
    'TC-ATT-08.4c: notes thường -> không chặn tính công tự động');

  // TC-ATT-09: Chuyển đổi chuẩn xác từ UTC Server sang Giờ Việt Nam (+07:00)
  // 09:26:00 VN (+07:00) = 02:26:00.000Z
  const rUtc1 = calculateLateTier('2026-08-31T02:26:00.000Z', '09:00', 30, 60);
  assert(rUtc1.is_late === true && rUtc1.late_minutes === 26 && rUtc1.work_units === 0.9458 && rUtc1.credit_symbol === '0,9458x',
    'TC-ATT-09.1: UTC 02:26:00Z -> 09:26 VN -> Muộn 26p, trừ theo phút thiếu (work_units=0.9458)');

  // 09:30:01 VN (+07:00) = 02:30:01.000Z
  const rUtc2 = calculateLateTier('2026-08-31T02:30:01.000Z', '09:00', 30, 60);
  assert(rUtc2.is_late === true && rUtc2.work_units === 0.9375 && rUtc2.credit_symbol === '0,9375x',
    'TC-ATT-09.2: UTC 02:30:01Z -> 09:30:01 VN -> Muộn 30p, trừ theo phút thiếu (work_units=0.9375)');

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

  // TC-ATT-14: Đúng 18:30 chưa phát sinh OT; 20:54 chỉ tính phần sau 18:30 (= 2.4h)
  const otAtBoundary = calculateOT('2026-08-31T09:54:00+07:00', '2026-08-31T18:30:00+07:00', '18:30');
  const otAfterBoundary = calculateOT('2026-08-31T09:54:00+07:00', '2026-08-31T20:54:00+07:00', '18:30');
  assert(otAtBoundary === 0 && otAfterBoundary === 2.4,
    'TC-ATT-14: OT bắt đầu sau 18:30; checkout 20:54 chỉ tính 2.4h OT');

  // TC-ATT-15: Theo quyết định nghiệp vụ hiện tại, tổng giờ là khoảng thời gian thô và chưa trừ giờ nghỉ trưa
  const rawHours = calculateRawTotalHours('2026-08-31T09:54:00+07:00', '2026-08-31T20:54:00+07:00');
  assert(rawHours === 11,
    'TC-ATT-15: Tổng giờ 09:54 -> 20:54 là 11.0h (chưa trừ thời gian nghỉ trưa)');

  // TC-ATT-16: Về sớm dùng mốc nghiêm ngặt 18:30, không còn grace period 4 phút
  const early = calculateAttendanceMetrics('2026-08-31T09:00:00+07:00', '2026-08-31T18:29:00+07:00');
  const onTime = calculateAttendanceMetrics('2026-08-31T09:00:00+07:00', '2026-08-31T18:30:00+07:00');
  assert(early.isEarlyLeave === true && early.earlyMinutes === 1 && onTime.isEarlyLeave === false && onTime.earlyMinutes === 0,
    'TC-ATT-16: 18:29 là về sớm 1 phút; đúng 18:30 là đủ giờ và không có OT');
}

module.exports = runAttendanceTests;
