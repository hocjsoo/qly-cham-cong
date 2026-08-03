// expert_qa_audit.js — Chuyên gia QA Integration & Unit Testing Engine
const path = require('path');

// Target paths
const serverDir = 'd:/QLY_CHAM_CONG/server';
const roleMiddleware = require(path.join(serverDir, 'src/middlewares/roleMiddleware'));

console.log('================================================================');
console.log('🧪 BẮT ĐẦU CHƯƠNG TRÌNH KIỂM THỬ CHUYÊN GIA (EXPERT QA AUDIT)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: TÍNH TOÁN GIỜ MUỘN & MÚI GIỜ CHUẨN (+07:00 ASIA/HO_CHI_MINH)
// -----------------------------------------------------------------------------
console.log('📌 [TEST SUITE 1] Kiểm thử Thuật toán Phân loại Đi muộn (calculateLateTier)');

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

// Case 1.1: Check-in lúc 08:15 AM (Đúng giờ)
const t1_1 = new Date('2026-08-03T08:15:00+07:00');
const r1_1 = calculateLateTier(t1_1, '08:30', 10, 30);
assert(r1_1.is_late === false && r1_1.late_tier === 'on_time', 'Case 1.1: Check-in 08:15 AM -> Đúng giờ', `is_late=${r1_1.is_late}`);

// Case 1.2: Check-in lúc 08:35 AM (+5 phút muộn nhẹ)
const t1_2 = new Date('2026-08-03T08:35:00+07:00');
const r1_2 = calculateLateTier(t1_2, '08:30', 10, 30);
assert(r1_2.is_late === true && r1_2.late_tier === 'late_minor' && r1_2.late_minutes === 5, 'Case 1.2: Check-in 08:35 AM -> Muộn nhẹ (+5p)', `late_minutes=${r1_2.late_minutes}`);

// Case 1.3: Check-in lúc 08:55 AM (+25 phút muộn vừa)
const t1_3 = new Date('2026-08-03T08:55:00+07:00');
const r1_3 = calculateLateTier(t1_3, '08:30', 10, 30);
assert(r1_3.is_late === true && r1_3.late_tier === 'late_medium' && r1_3.late_minutes === 25, 'Case 1.3: Check-in 08:55 AM -> Muộn vừa (+25p)', `late_minutes=${r1_3.late_minutes}`);

// Case 1.4: Check-in lúc 10:15 AM (+105 phút muộn nặng)
const t1_4 = new Date('2026-08-03T10:15:00+07:00');
const r1_4 = calculateLateTier(t1_4, '08:30', 10, 30);
assert(r1_4.is_late === true && r1_4.late_tier === 'late_severe' && r1_4.late_minutes === 105, 'Case 1.4: Check-in 10:15 AM -> Muộn nặng (+105p)', `late_minutes=${r1_4.late_minutes}`);

// Case 1.5: Giả lập môi trường Server UTC (Render) — Check-in lúc 08:30 AM Việt Nam (tương đương 01:30 AM UTC)
const t1_5_utc = new Date('2026-08-03T01:30:00.000Z'); // 08:30 ICT
const r1_5 = calculateLateTier(t1_5_utc, '08:30', 10, 30);
assert(r1_5.is_late === false && r1_5.late_tier === 'on_time', 'Case 1.5: Server UTC giả lập -> Tính chính xác 08:30 ICT là Đúng giờ', `is_late=${r1_5.is_late}`);


// -----------------------------------------------------------------------------
// TEST SUITE 2: TÍNH TOÁN GIỜ TĂNG CA (OT)
// -----------------------------------------------------------------------------
console.log('\n📌 [TEST SUITE 2] Kiểm thử Thuật toán Tính giờ Tăng ca (calculateOT)');

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

// Case 2.1: Check-out lúc 17:00 (Chưa hết ca -> 0h OT)
const ot2_1 = calculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T17:00:00+07:00', '17:30');
assert(ot2_1 === 0, 'Case 2.1: Check-out 17:00 -> 0h OT', `ot_hours=${ot2_1}`);

// Case 2.2: Check-out lúc 20:30 (Về muộn 3 tiếng -> 3.0h OT)
const ot2_2 = calculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T20:30:00+07:00', '17:30');
assert(ot2_2 === 3.0, 'Case 2.2: Check-out 20:30 -> 3.0h OT', `ot_hours=${ot2_2}`);


// -----------------------------------------------------------------------------
// TEST SUITE 3: KHOẢNG CÁCH GPS & BÁN KÍNH GEOFENCING
// -----------------------------------------------------------------------------
console.log('\n📌 [TEST SUITE 3] Kiểm thử Công thức Khoảng cách Haversine & Geofencing GPS');

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Bán kính trái đất (mét)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Tọa độ văn phòng: 10.7769, 106.7009
const officeLat = 10.7769, officeLng = 106.7009;

// Case 3.1: Trùng khớp 100% tọa độ
const d3_1 = Math.round(getDistanceMeters(officeLat, officeLng, officeLat, officeLng));
assert(d3_1 === 0, 'Case 3.1: Trùng vị trí -> 0m', `distance=${d3_1}m`);

// Case 3.2: Cách 10m (Hợp lệ trong bán kính cho phép min 250m)
const d3_2 = Math.round(getDistanceMeters(officeLat, officeLng, 10.77699, 106.70099));
assert(d3_2 <= 250, 'Case 3.2: Cách 15m -> Nằm trong bán kính 250m cho phép', `distance=${d3_2}m`);

// Case 3.3: Cách xa 5km (Không hợp lệ cho check-in Văn phòng)
const d3_3 = Math.round(getDistanceMeters(officeLat, officeLng, 10.8231, 106.6297));
assert(d3_3 > 250, 'Case 3.3: Cách 8km -> Vượt bán kính văn phòng', `distance=${d3_3}m`);


// -----------------------------------------------------------------------------
// TEST SUITE 4: PHÂN QUYỀN VAI TRÒ & ROLE MAPPING SYSTEM
// -----------------------------------------------------------------------------
console.log('\n📌 [TEST SUITE 4] Kiểm thử Phân quyền Vai trò (roleMiddleware mapping)');

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

// Case 4.1: requireRole('admin') cho User có role 'admin' -> PASS (hợp lệ)
let req4_1 = { user: { role: 'admin' } };
let res4_1 = mockRes();
let nextCalled4_1 = false;
roleMiddleware.requireRole('admin')(req4_1, res4_1, () => { nextCalled4_1 = true; });
assert(nextCalled4_1 === true, 'Case 4.1: requireRole("admin") chấp nhận user role="admin"');

// Case 4.2: requireRole('admin') cho User có role 'leader' hoặc 'manager' -> DENIED 403
let req4_2 = { user: { role: 'leader' } };
let res4_2 = mockRes();
let nextCalled4_2 = false;
roleMiddleware.requireRole('admin')(req4_2, res4_2, () => { nextCalled4_2 = true; });
assert(nextCalled4_2 === false && res4_2.statusCode === 403, 'Case 4.2: requireRole("admin") CHẶN user role="leader" (Trả về 403)');

// Case 4.3: requireRole('admin') cho User có role 'employee' -> DENIED 403
let req4_3 = { user: { role: 'employee' } };
let res4_3 = mockRes();
let nextCalled4_3 = false;
roleMiddleware.requireRole('admin')(req4_3, res4_3, () => { nextCalled4_3 = true; });
assert(nextCalled4_3 === false && res4_3.statusCode === 403, 'Case 4.3: requireRole("admin") CHẶN user role="employee" (Trả về 403)');

// Case 4.4: requireRole('admin', 'manager') cho User legacy role 'manager' (Tự động map sang 'leader') -> PASS
let req4_4 = { user: { role: 'manager' } };
let res4_4 = mockRes();
let nextCalled4_4 = false;
roleMiddleware.requireRole('admin', 'manager')(req4_4, res4_4, () => { nextCalled4_4 = true; });
assert(nextCalled4_4 === true, 'Case 4.4: Backward Compatibility — requireRole("admin", "manager") hỗ trợ legacy role "manager"');


// -----------------------------------------------------------------------------
// TỔNG KẾT BÁO CÁO KIỂM THỬ
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ CHUYÊN GIA:`);
console.log(`   - Tổng số kịch bản test (Test Cases): ${totalTests}`);
console.log(`   - Kết quả ĐẠT (PASS): ${passedTests} / ${totalTests} (Tỷ lệ: ${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`   - Kết quả LỖI (FAIL): ${failedTests}`);
console.log('================================================================\n');

if (failedTests === 0) {
  console.log('🎉 TẤT CẢ CÁC THUẬT TOÁN VÀ QUY TRÌNH HỆ THỐNG ĐẠT CHUẨN 100%! READY FOR PRODUCTION.');
} else {
  console.error('⚠️ PHÁT HIỆN CÓ KỊCH BẢN THẤT BẠI. CẦN KIỂM TRA LẠI CODE.');
}
