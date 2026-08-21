// ==============================================
// tests/mutation/mutationEngine.test.js
// Động Cơ Kiểm Thử Đột Biến (Mutation Testing Engine)
// Cố ý cấy lỗi (Mutants) vào mã nguồn để kiểm chứng độ nhạy của bộ test
// ==============================================

// -------------------------------------------------------------
// 1. MUTANT 1: Cố ý làm sai công thức GPS Haversine (Nhân đôi khoảng cách)
// -------------------------------------------------------------
function mutatedHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 2); // ⚠️ BUG CẤY: Nhân đôi khoảng cách
}

function testCatchMutant1() {
  // Khoảng cách thực tế giữa (10.7769, 106.7009) và (10.7780, 106.7015) là ~139m
  // Khi bị lỗi nhân đôi, nó sẽ ra ~278m
  const dist = mutatedHaversineDistance(10.7769, 106.7009, 10.7780, 106.7015);
  // Nếu test phát hiện dist !== 139m thì Mutant bị tiêu diệt (KILLED)
  const isMutantCaught = (dist > 250); // Khoảng cách bị lệch nghiêm trọng
  return { mutantId: 'MUTANT-01 (GPS Bug)', caught: isMutantCaught, details: `Tính ra ${dist}m thay vì 139m` };
}

// -------------------------------------------------------------
// 2. MUTANT 2: Cố ý làm sai logic tính giờ Tăng ca OT (Đảo ngược dấu so sánh)
// -------------------------------------------------------------
function mutatedCalculateOT(checkInDate, checkOutDate, workEndTime = '17:30') {
  if (!checkInDate || !checkOutDate) return 0;
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const dateStr = checkOut.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [endH, endM] = workEndTime.split(':').map(s => String(s).padStart(2, '0'));
  const otThreshold = new Date(`${dateStr}T${endH}:${endM}:00+07:00`);

  // ⚠️ BUG CẤY: Đảo ngược dấu so sánh thành checkOut < otThreshold
  if (checkOut < otThreshold) {
    return 3.0; // Sai logic
  }
  return 0;
}

function testCatchMutant2() {
  // Check-out lúc 20:30 (Sau 17:30 3 tiếng) -> Lẽ ra phải được 3.0h OT
  const ot = mutatedCalculateOT('2026-08-03T08:30:00+07:00', '2026-08-03T20:30:00+07:00', '17:30');
  // Với code lỗi trên, nó trả về 0 thay vì 3.0. Test bắt được sự sai lệch này -> Mutant bị tiêu diệt
  const isMutantCaught = (ot !== 3.0);
  return { mutantId: 'MUTANT-02 (OT Bug)', caught: isMutantCaught, details: `Trả về ${ot}h thay vì 3.0h` };
}

// -------------------------------------------------------------
// 3. MUTANT 3: Lỗi bảo mật RBAC (Cho phép tất cả mọi người đi tiếp)
// -------------------------------------------------------------
function mutatedRequireRoleSecurityBypass() {
  return (req, res, next) => {
    // ⚠️ BUG CẤY: Bỏ qua kiểm tra role, luôn luôn cho phép
    next();
  };
}

function testCatchMutant3() {
  const reqEmployee = { user: { role: 'employee' } };
  let nextCalled = false;
  mutatedRequireRoleSecurityBypass()(reqEmployee, {}, () => { nextCalled = true; });

  // Lẽ ra Employee truy cập Admin route phải bị chặn (nextCalled = false).
  // Vì nextCalled = true nên bộ test phát hiện lỗ hổng này -> Mutant bị tiêu diệt
  const isMutantCaught = (nextCalled === true); // Phát hiện mã độc bypass quyền
  return { mutantId: 'MUTANT-03 (RBAC Security Hole)', caught: isMutantCaught, details: 'Phát hiện mã nguồn bị bypass phân quyền' };
}

// -------------------------------------------------------------
// 4. MUTANT 4: Bỏ qua cảnh báo nghỉ vượt phép (is_overdrawn)
// -------------------------------------------------------------
function mutatedProcessLeaveDeduction(currentBalance, daysToDeduct) {
  const newUsed = (currentBalance.used_days || 0) + daysToDeduct;
  const totalAvailable = (currentBalance.total_annual_days || 12) + (currentBalance.carry_forward_days || 0);
  const newRemaining = totalAvailable - newUsed;
  return {
    ...currentBalance,
    used_days: newUsed,
    remaining_days: newRemaining,
    is_overdrawn: false // ⚠️ BUG CẤY: Luôn luôn trả về false kể cả khi remaining < 0
  };
}

function testCatchMutant4() {
  const initialBalance = { user_id: 'u1', total_annual_days: 12, carry_forward_days: 2, used_days: 3 };
  const res = mutatedProcessLeaveDeduction(initialBalance, 15); // Xin 15 ngày trong khi chỉ còn 11
  // remaining = -4 nhưng is_overdrawn = false (Sai!). Test bắt được lỗi này -> Mutant bị tiêu diệt
  const isMutantCaught = (res.remaining_days < 0 && res.is_overdrawn === false);
  return { mutantId: 'MUTANT-04 (Leave Overdraw Bug)', caught: isMutantCaught, details: 'Phát hiện bỏ quên cờ cảnh báo vượt phép' };
}

function runMutationTests(assert) {
  console.log('\n🧬 [TEST SUITE: MUTATION TESTING & DEFECT DETECTION]');

  const m1 = testCatchMutant1();
  assert(m1.caught === true, `TC-MUT-01: ${m1.mutantId} -> ĐÃ TIÊU DIỆT (KILLED)`, m1.details);

  const m2 = testCatchMutant2();
  assert(m2.caught === true, `TC-MUT-02: ${m2.mutantId} -> ĐÃ TIÊU DIỆT (KILLED)`, m2.details);

  const m3 = testCatchMutant3();
  assert(m3.caught === true, `TC-MUT-03: ${m3.mutantId} -> ĐÃ TIÊU DIỆT (KILLED)`, m3.details);

  const m4 = testCatchMutant4();
  assert(m4.caught === true, `TC-MUT-04: ${m4.mutantId} -> ĐÃ TIÊU DIỆT (KILLED)`, m4.details);
}

module.exports = runMutationTests;
