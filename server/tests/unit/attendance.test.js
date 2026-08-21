// ==============================================
// tests/unit/attendance.test.js
// Kiểm thử Thuật toán Chấm công, Trễ giờ & Giờ Tăng ca (OT)
// Chuẩn múi giờ Việt Nam +07:00 (Asia/Ho_Chi_Minh)
// ==============================================

// Helper tính phân loại đi muộn theo quy định
function calculateLateTier(checkInDate, workStartStr = '08:30', minorMins = 10, mediumMins = 30) {
  const dateStr = new Date(checkInDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const timePart = (workStartStr && workStartStr.includes(':')) ? workStartStr.trim() : '08:30';
  const [startH, startM] = timePart.split(':').map(s => String(s).padStart(2, '0'));

  const targetDate = new Date(`${dateStr}T${startH}:${startM}:00+07:00`);
  const checkIn = new Date(checkInDate);
  const diffMs = checkIn.getTime() - targetDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins <= 0) {
    return { is_late: false, late_minutes: 0, late_tier: 'on_time', label: `Đúng giờ (≤ ${workStartStr})` };
  } else if (diffMins <= minorMins) {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_minor', label: `Muộn nhẹ (+${diffMins}p)` };
  } else if (diffMins <= mediumMins) {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_medium', label: `Muộn vừa (+${diffMins}p)` };
  } else {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_severe', label: `Muộn nặng (+${diffMins}p)` };
  }
}

// Helper tính OT chuẩn theo múi giờ +07:00
function calculateOT(checkInDate, checkOutDate, workEndTime = '17:30') {
  if (!checkInDate || !checkOutDate) return 0;
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const dateStr = checkOut.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const timePart = (workEndTime && workEndTime.includes(':')) ? workEndTime.trim() : '17:30';
  const [endH, endM] = timePart.split(':').map(s => String(s).padStart(2, '0'));

  const otThreshold = new Date(`${dateStr}T${endH}:${endM}:00+07:00`);

  if (checkOut > otThreshold) {
    const otStartMs = Math.max(checkIn.getTime(), otThreshold.getTime());
    const otMs = checkOut.getTime() - otStartMs;
    const otHours = parseFloat((otMs / (1000 * 60 * 60)).toFixed(1));
    return Math.max(0, otHours);
  }
  return 0;
}

function runAttendanceTests(assert) {
  console.log('\n⏰ [TEST SUITE: ATTENDANCE RULES, LATE TIERS & OT]');

  // TC-ATT-01: Check-in trước giờ quy định (08:15 với ca 08:30) -> Đúng giờ
  const r1 = calculateLateTier('2026-08-03T08:15:00+07:00', '08:30', 10, 30);
  assert(r1.is_late === false && r1.late_tier === 'on_time' && r1.late_minutes === 0,
    'TC-ATT-01: Check-in 08:15 AM -> Đúng giờ (on_time, late_minutes=0)');

  // TC-ATT-02: Check-in đúng giờ chẵn (08:30 với ca 08:30) -> Đúng giờ
  const r2 = calculateLateTier('2026-08-03T08:30:00+07:00', '08:30', 10, 30);
  assert(r2.is_late === false && r2.late_tier === 'on_time',
    'TC-ATT-02: Check-in chính xác 08:30:00 AM -> Đúng giờ (on_time)');

  // TC-ATT-03: Check-in muộn nhẹ (+6 phút lúc 08:36) -> late_minor
  const r3 = calculateLateTier('2026-08-03T08:36:00+07:00', '08:30', 10, 30);
  assert(r3.is_late === true && r3.late_tier === 'late_minor' && r3.late_minutes === 6,
    'TC-ATT-03: Check-in 08:36 AM -> Muộn nhẹ (+6p, late_minor)');

  // TC-ATT-04: Check-in muộn vừa (+20 phút lúc 08:50) -> late_medium
  const r4 = calculateLateTier('2026-08-03T08:50:00+07:00', '08:30', 10, 30);
  assert(r4.is_late === true && r4.late_tier === 'late_medium' && r4.late_minutes === 20,
    'TC-ATT-04: Check-in 08:50 AM -> Muộn vừa (+20p, late_medium)');

  // TC-ATT-05: Check-in muộn nặng (+75 phút lúc 09:45) -> late_severe
  const r5 = calculateLateTier('2026-08-03T09:45:00+07:00', '08:30', 10, 30);
  assert(r5.is_late === true && r5.late_tier === 'late_severe' && r5.late_minutes === 75,
    'TC-ATT-05: Check-in 09:45 AM -> Muộn nặng (+75p, late_severe)');

  // TC-ATT-06: Khả năng tương thích múi giờ UTC Server (Render/Vercel)
  // 08:30 AM Giờ VN = 01:30 AM UTC
  const utcDateStr = '2026-08-03T01:30:00.000Z';
  const r6 = calculateLateTier(utcDateStr, '08:30', 10, 30);
  assert(r6.is_late === false && r6.late_tier === 'on_time',
    'TC-ATT-06: Chuyển đổi chuẩn xác từ UTC Server sang Giờ Việt Nam (+07:00)');

  // TC-ATT-07: Tính OT - Check-out trước kết ca (17:15) -> 0h OT
  const ot1 = calculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T17:15:00+07:00', '17:30');
  assert(ot1 === 0, 'TC-ATT-07: Check-out 17:15 -> 0.0h OT (Chưa hết ca 17:30)');

  // TC-ATT-08: Tính OT - Check-out lúc 19:00 (Sau 17:30 1.5 tiếng) -> 1.5h OT
  const ot2 = calculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T19:00:00+07:00', '17:30');
  assert(ot2 === 1.5, 'TC-ATT-08: Check-out 19:00 -> Đúng 1.5h OT');

  // TC-ATT-09: Tính OT - Check-out lúc 21:30 (Sau 17:30 4 tiếng) -> 4.0h OT
  const ot3 = calculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T21:30:00+07:00', '17:30');
  assert(ot3 === 4.0, 'TC-ATT-09: Check-out 21:30 -> Đúng 4.0h OT');

  // TC-ATT-10: Xử lý ngoại lệ đầu vào không hợp lệ (checkOut trước checkIn hoặc null)
  const ot4 = calculateOT('2026-08-03T17:00:00+07:00', '2026-08-03T08:00:00+07:00', '17:30');
  const ot5 = calculateOT(null, null, '17:30');
  assert(ot4 === 0 && ot5 === 0, 'TC-ATT-10: Xử lý an toàn khi thời gian không hợp lệ hoặc null -> Trả về 0h');
}

module.exports = runAttendanceTests;
