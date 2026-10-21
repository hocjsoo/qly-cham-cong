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
const { calculateWorkedWorkUnits } = require('../../src/utils/attendanceCalculations');

function runAttendanceTests(assert) {
  console.log('\n⏰ [TEST SUITE: ATTENDANCE RULES, GIỜ LÀM THỰC TẾ & OT (MUỘN KHÔNG TRỪ NẾU ĐỦ 8H)]');

  // TC-ATT-01: Check-in trước giờ ca (08:45 với ca 09:00) -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r1 = calculateLateTier('2026-08-31T08:45:00+07:00', '09:00', 30, 60);
  assert(r1.is_late === false && r1.late_tier === 'on_time' && r1.late_minutes === 0 && r1.work_units === 1.0 && r1.credit_symbol === 'x',
    'TC-ATT-01: Check-in 08:45 AM -> Đúng giờ (on_time, late_minutes=0, work_units=1.0, ký hiệu x)');

  // TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (x, work_units=1.0, late_minutes=0)
  const r2 = calculateLateTier('2026-08-31T09:00:00+07:00', '09:00', 30, 60);
  assert(r2.is_late === false && r2.late_tier === 'on_time' && r2.late_minutes === 0 && r2.work_units === 1.0 && r2.credit_symbol === 'x',
    'TC-ATT-02: Check-in đúng 09:00:00 -> Đúng giờ (on_time, work_units=1.0, ký hiệu x)');

  // [21/10/2026] Đi muộn KHÔNG trừ công lúc check-in (tạm tính 1.0) — công chốt khi check-out
  // theo giờ làm thực tế: "muộn mà tăng ca đủ giờ thì không bị trừ".
  // TC-ATT-03: Check-in 09:01 -> Muộn 1p, tạm tính đủ 1.0 công
  const r3 = calculateLateTier('2026-08-31T09:01:00+07:00', '09:00', 30, 60);
  assert(r3.is_late === true && r3.late_tier === 'late_minor' && r3.late_minutes === 1 && r3.work_units === 1.0 && r3.credit_symbol === 'x',
    'TC-ATT-03: Check-in 09:01 -> Muộn 1p, tạm tính 1.0 công (không trừ ngay)');

  // TC-ATT-04: 09:26 với minor_late_mins=10 -> nhãn muộn vừa, vẫn 1.0 công
  const r4 = calculateLateTier('2026-08-31T09:26:00+07:00', '09:00', 10, 60);
  assert(r4.is_late === true && r4.late_minutes === 26 && r4.work_units === 1.0 && r4.credit_symbol === 'x',
    'TC-ATT-04: Check-in 09:26 -> Muộn 26p, tạm tính 1.0 công');

  // TC-ATT-05: Đúng 09:30:00 -> 1.0 công
  const r5 = calculateLateTier('2026-08-31T09:30:00+07:00', '09:00', 10, 60);
  assert(r5.is_late === true && r5.late_minutes === 30 && r5.work_units === 1.0,
    'TC-ATT-05: Check-in 09:30:00 -> Muộn 30p, tạm tính 1.0 công');

  // TC-ATT-06: 09:30:01 -> vẫn 1.0 công (không còn mốc 0.75)
  const r6 = calculateLateTier('2026-08-31T09:30:01+07:00', '09:00', 30, 60);
  assert(r6.is_late === true && r6.work_units === 1.0 && r6.late_minutes === 30,
    'TC-ATT-06: Check-in 09:30:01 -> Không còn mốc 0.75, tạm tính 1.0 công');

  // TC-ATT-07: 09:31 -> 1.0 công
  const r7 = calculateLateTier('2026-08-31T09:31:00+07:00', '09:00', 30, 60);
  assert(r7.is_late === true && r7.work_units === 1.0 && r7.late_minutes === 31,
    'TC-ATT-07: Check-in 09:31 -> Tạm tính 1.0 công');

  // TC-ATT-08: muộn nặng 10:15 -> nhãn late_severe, vẫn tạm tính 1.0
  const r8 = calculateLateTier('2026-08-31T10:15:00+07:00', '09:00', 30, 60);
  assert(r8.is_late === true && r8.late_tier === 'late_severe' && r8.late_minutes === 75 && r8.work_units === 1.0,
    'TC-ATT-08: Check-in 10:15 -> Muộn 75p, nhãn late_severe, tạm tính 1.0 công');

  // TC-ATT-08.1..08.3 [NEW 21/10/2026]: Chốt công theo GIỜ LÀM THỰC TẾ (đã trừ nghỉ trưa 1h)
  const unit = (inT, outT, std = 480) => calculateWorkedWorkUnits(
    `2026-10-21T${inT}:00+07:00`, `2026-10-21T${outT}:00+07:00`,
    { standardMinutes: std, lunchStart: '12:00', lunchEnd: '13:00' }
  ).workUnits;

  assert(unit('09:00', '18:30') === 1.0,
    'TC-ATT-08.1: Đúng giờ, về 18:30 (8h30 - 1h trưa = 8h30) -> đủ 1.0 công');
  assert(unit('10:00', '19:30') === 1.0,
    'TC-ATT-08.2: MUỘN 1h nhưng TĂNG CA đủ giờ (về 19:30) -> KHÔNG bị trừ, 1.0 công');
  assert(unit('10:00', '18:30') === 0.9375,
    'TC-ATT-08.3: Muộn 1h, không làm bù -> 7h30/8h = 0.9375 công');
  assert(unit('09:00', '17:00') === 0.875,
    'TC-ATT-08.4: Về sớm 1h -> 7h/8h = 0.875 công');
  assert(unit('09:00', '12:00') === 0.375,
    'TC-ATT-08.5: Làm nửa buổi sáng (3h, trùng giờ trưa 0p) -> 0.375 công');
  assert(unit('11:00', '18:30') === 0.8125,
    'TC-ATT-08.6: Vào 11:00 (muộn 2h) về 18:30 -> 6h30/8h = 0.8125 công');

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
  assert(rUtc1.is_late === true && rUtc1.late_minutes === 26 && rUtc1.work_units === 1.0 && rUtc1.credit_symbol === 'x',
    'TC-ATT-09.1: UTC 02:26:00Z -> 09:26 VN -> Muộn 26p, tạm tính 1.0 công');

  // 09:30:01 VN (+07:00) = 02:30:01.000Z
  const rUtc2 = calculateLateTier('2026-08-31T02:30:01.000Z', '09:00', 30, 60);
  assert(rUtc2.is_late === true && rUtc2.work_units === 1.0 && rUtc2.credit_symbol === 'x',
    'TC-ATT-09.2: UTC 02:30:01Z -> 09:30:01 VN -> Muộn 30p, tạm tính 1.0 công');

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
