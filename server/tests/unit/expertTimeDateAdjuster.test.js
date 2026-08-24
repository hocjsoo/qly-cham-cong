// ==============================================
// tests/unit/expertTimeDateAdjuster.test.js
// Bộ Kiểm Thử Chuyên Gia: Bộ Điều Chỉnh Ngày & Giờ Nhanh (Time & Date Adjusters)
// Zero-Impact Isolated Test Engine
// ==============================================

// Helper tăng/giảm giờ dạng HH:mm
const adjustTimeString = (timeStr, deltaMinutes) => {
  if (!timeStr) timeStr = '08:30';
  const parts = timeStr.split(':').map(Number);
  let totalMins = (parts[0] || 0) * 60 + (parts[1] || 0) + deltaMinutes;
  if (totalMins < 0) totalMins = 0;
  if (totalMins > 23 * 60 + 59) totalMins = 23 * 60 + 59;
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

// Helper chuyển đổi ngày với độ dời offsetDays
const shiftDateString = (dateStr, offsetDays) => {
  const [y, m, d] = (dateStr || '2026-08-24').split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  const newY = dt.getFullYear();
  const newM = String(dt.getMonth() + 1).padStart(2, '0');
  const newD = String(dt.getDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
};

// Helper tính toán trực tiếp tổng giờ làm & giờ OT
const computeLiveSummary = (inTime, outTime, workEndTime = '18:30') => {
  if (!inTime || !outTime) return null;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMins = inH * 60 + inM;
  const outMins = outH * 60 + outM;
  if (outMins <= inMins) return { totalHours: 0, otHours: 0 };
  const diffMins = outMins - inMins;
  const totalHours = parseFloat((diffMins / 60).toFixed(1));

  const [endH, endM] = (workEndTime || '18:30').split(':').map(Number);
  const endMins = endH * 60 + endM;
  let otHours = 0;
  if (outMins > endMins) {
    otHours = parseFloat(((outMins - endMins) / 60).toFixed(1));
  }
  return { totalHours, otHours };
};

function runExpertTimeDateAdjusterTests(assert) {
  console.log('\n⏱️ [TEST SUITE: EXPERT TIME & DATE PICKER & LIVE CALCULATION]');

  // TC-EXP-TIME-01: Tăng giờ nhanh (+15 phút & +30 phút)
  const t1 = adjustTimeString('08:30', 15);
  assert(t1 === '08:45', 'TC-EXP-TIME-01.1: 08:30 + 15p -> 08:45');

  const t2 = adjustTimeString('08:45', 15);
  assert(t2 === '09:00', 'TC-EXP-TIME-01.2: 08:45 + 15p -> 09:00 (chuyển giờ tròn)');

  const t3 = adjustTimeString('17:30', 30);
  assert(t3 === '18:00', 'TC-EXP-TIME-01.3: 17:30 + 30p -> 18:00');

  // TC-EXP-TIME-02: Giảm giờ nhanh (-15 phút & -30 phút)
  const t4 = adjustTimeString('09:00', -15);
  assert(t4 === '08:45', 'TC-EXP-TIME-02.1: 09:00 - 15p -> 08:45');

  const t5 = adjustTimeString('08:15', -30);
  assert(t5 === '07:45', 'TC-EXP-TIME-02.2: 08:15 - 30p -> 07:45');

  // TC-EXP-TIME-03: Kiểm tra giới hạn biên dưới & biên trên (00:00 & 23:59 Clamping)
  const tMin = adjustTimeString('00:05', -15);
  assert(tMin === '00:00', 'TC-EXP-TIME-03.1: 00:05 - 15p -> Chặn an toàn ở biên dưới 00:00 (không bị âm)');

  const tMax = adjustTimeString('23:50', 20);
  assert(tMax === '23:59', 'TC-EXP-TIME-03.2: 23:50 + 20p -> Chặn an toàn ở biên trên 23:59');

  // TC-EXP-TIME-04: Bộ chuyển ngày thông minh (Date Shifter)
  const dNext = shiftDateString('2026-08-24', 1);
  assert(dNext === '2026-08-25', 'TC-EXP-TIME-04.1: 2026-08-24 + 1 ngày -> 2026-08-25');

  const dPrev = shiftDateString('2026-08-24', -1);
  assert(dPrev === '2026-08-23', 'TC-EXP-TIME-04.2: 2026-08-24 - 1 ngày -> 2026-08-23');

  const dMonthEnd = shiftDateString('2026-08-31', 1);
  assert(dMonthEnd === '2026-09-01', 'TC-EXP-TIME-04.3: 2026-08-31 + 1 ngày -> 2026-09-01 (Chuyển tháng chính xác)');

  // TC-EXP-TIME-05: Tính toán Live Summary (Tổng giờ làm & Giờ OT)
  const s1 = computeLiveSummary('08:30', '17:30', '18:30');
  assert(s1.totalHours === 9.0 && s1.otHours === 0,
    'TC-EXP-TIME-05.1: Ca 08:30 -> 17:30 = 9.0h làm việc, 0h OT');

  const s2 = computeLiveSummary('08:30', '20:00', '18:30');
  assert(s2.totalHours === 11.5 && s2.otHours === 1.5,
    'TC-EXP-TIME-05.2: Ca tăng ca 08:30 -> 20:00 = 11.5h làm việc, 1.5h OT (sau 18:30)');

  const s3 = computeLiveSummary('18:00', '17:00', '18:30');
  assert(s3.totalHours === 0 && s3.otHours === 0,
    'TC-EXP-TIME-05.3: Giờ ra nhỏ hơn giờ vào -> Xử lý an toàn trả về 0h');
}

module.exports = runExpertTimeDateAdjusterTests;
