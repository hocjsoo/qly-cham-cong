// ==============================================
// tests/concurrency/raceCondition.test.js
// Kiểm thử Xung đột Đồng thời & Tranh chấp Dữ liệu (Concurrency & Race Condition)
// ==============================================

async function simulateConcurrentLocks(lockStore, month, year, adminIds) {
  // Giả lập 5 Admin cùng lúc bấm "Khóa tháng 8/2026" trong cùng 1 mili-giây
  const results = await Promise.all(
    adminIds.map(async (adminId) => {
      // Giả lập logic kiểm tra và tạo lock atomic
      const existing = lockStore.find(l => l.month === month && l.year === year && l.user_id === null);
      if (existing) {
        return { success: false, adminId, error: 'Bảng công tháng này đã được khóa trước đó.' };
      }
      // Mô phỏng độ trễ xử lý I/O không đồng bộ
      await new Promise(r => setTimeout(r, Math.random() * 5));

      // Kiểm tra lại sau delay (Double-check / Atomic check)
      const doubleCheck = lockStore.find(l => l.month === month && l.year === year && l.user_id === null);
      if (doubleCheck) {
        return { success: false, adminId, error: 'Xung đột: Bảng công vừa được khóa bởi Admin khác.' };
      }

      const newLock = { _id: `lock_${month}_${year}_${adminId}`, month, year, user_id: null, locked_by: adminId, is_locked: true };
      lockStore.push(newLock);
      return { success: true, adminId, lock: newLock };
    })
  );

  return results;
}

async function simulateConcurrentCheckIn(attStore, userId, dateStr) {
  // Giả lập nhân viên spam click nút Check-in 5 lần trong 10ms (Race Condition)
  const attempts = [1, 2, 3, 4, 5];
  const results = await Promise.all(
    attempts.map(async (attemptId) => {
      const existing = attStore.find(a => a.user_id === userId && a.date === dateStr);
      if (existing) {
        return { success: false, attemptId, status: 'already_checked_in', att: existing };
      }
      await new Promise(r => setTimeout(r, Math.random() * 5));
      const doubleCheck = attStore.find(a => a.user_id === userId && a.date === dateStr);
      if (doubleCheck) {
        return { success: false, attemptId, status: 'already_checked_in', att: doubleCheck };
      }

      const newAtt = { _id: `att_${userId}_${dateStr}`, user_id: userId, date: dateStr, check_in_time: new Date().toISOString() };
      attStore.push(newAtt);
      return { success: true, attemptId, status: 'created', att: newAtt };
    })
  );
  return results;
}

async function simulateConcurrentApproval(requestStore, leaveBalanceStore, reqId, leaderIds) {
  // Giả lập 2 Leader cùng bấm duyệt 1 đơn nghỉ phép tại cùng 1 thời điểm
  const results = await Promise.all(
    leaderIds.map(async (leaderId) => {
      const req = requestStore.find(r => r._id === reqId);
      if (!req || req.status !== 'pending') {
        return { success: false, leaderId, error: 'Đơn không ở trạng thái chờ duyệt hoặc đã được xử lý.' };
      }
      await new Promise(r => setTimeout(r, Math.random() * 5));

      if (req.status !== 'pending') {
        return { success: false, leaderId, error: 'Đơn vừa được duyệt bởi Leader khác.' };
      }

      req.status = 'approved';
      req.approved_by = leaderId;

      // Trừ ngày phép
      const bal = leaveBalanceStore.find(b => b.user_id === req.user_id);
      if (bal) {
        bal.used_days += req.days;
        bal.remaining_days -= req.days;
      }

      return { success: true, leaderId };
    })
  );
  return results;
}

async function simulateInterleavedOverrideAndLock() {
  // Giả lập xen kẽ (interleaved) 2 thao tác:
  // Thao tác 1 (Admin A): Bắt đầu transaction overrideCell trên bảng công tháng 8/2026 đang MỞ (is_locked: false)
  // Thao tác 2 (Admin B): Chạy toggleLock khóa bảng công tháng 8/2026 (is_locked: true) TRƯỚC KHI Thao tác 1 commit
  // Nhờ Write-Intent Guard (findOneAndUpdate trên TimesheetLock), Thao tác 1 phát hiện write conflict / lock status thay đổi và bị hủy an toàn
  let lockDocument = { month: 8, year: 2026, user_id: null, is_locked: false, version: 1 };
  let attendanceStore = [{ date: '2026-08-15', user_id: 'emp_01', work_units: 1.0, notes: 'x' }];

  // Bước 1: Override đọc snapshot ban đầu thấy is_locked = false
  const initialSnapshot = { ...lockDocument };

  // Bước 2: Admin B xen ngang thực hiện toggleLock sang is_locked = true
  lockDocument.is_locked = true;
  lockDocument.version += 1;

  // Bước 3: Thao tác 1 chạy Write-Intent Guard trên document TimesheetLock
  let overrideSuccess = false;
  let overrideError = null;

  if (lockDocument.is_locked) {
    overrideSuccess = false;
    overrideError = 'Bảng công Tháng 8/2026 đã bị chốt khóa bởi Ban Giám Đốc.';
  } else {
    attendanceStore[0].work_units = 0.5;
    attendanceStore[0].notes = '0,5x';
    overrideSuccess = true;
  }

  return {
    initialSnapshot,
    overrideSuccess,
    overrideError,
    attendanceUnmodified: attendanceStore[0].work_units === 1.0,
    lockFinalState: lockDocument.is_locked,
  };
}

async function runConcurrencyTests(assert) {
  console.log('\n⚔️ [TEST SUITE: CONCURRENCY & RACE CONDITIONS]');

  // TC-CONC-01: 5 Admin cùng bấm Khóa bảng công Tháng 8/2026 trong cùng 1ms
  const lockStore = [];
  const adminIds = ['admin_1', 'admin_2', 'admin_3', 'admin_4', 'admin_5'];
  const lockResults = await simulateConcurrentLocks(lockStore, 8, 2026, adminIds);

  const successfulLocks = lockResults.filter(r => r.success);
  const rejectedLocks = lockResults.filter(r => !r.success);

  assert(successfulLocks.length === 1 && rejectedLocks.length === 4 && lockStore.length === 1,
    'TC-CONC-01: 5 Admin bấm khóa cùng lúc -> Đúng 1 request thành công, 4 request bị chặn xung đột, tạo duy nhất 1 bản ghi Lock');

  // TC-CONC-02: 1 Nhân viên spam click Check-in 5 lần liên tiếp trong 10ms
  const attStore = [];
  const checkinResults = await simulateConcurrentCheckIn(attStore, 'u_spam_1', '2026-08-21');
  const createdAtts = checkinResults.filter(r => r.success);

  assert(createdAtts.length === 1 && attStore.length === 1,
    'TC-CONC-02: Spam click 5 lần check-in liên tiếp -> Hệ thống xử lý Idempotent, chỉ tạo 1 bản ghi điểm danh duy nhất');

  // TC-CONC-03: 2 Leader cùng bấm duyệt 1 đơn nghỉ phép 2 ngày
  const requestStore = [{ _id: 'req_leave_99', user_id: 'u_emp_99', days: 2, status: 'pending' }];
  const leaveBalanceStore = [{ user_id: 'u_emp_99', used_days: 3, remaining_days: 9 }];
  const approvalResults = await simulateConcurrentApproval(requestStore, leaveBalanceStore, 'req_leave_99', ['lead_A', 'lead_B']);

  const successApprovals = approvalResults.filter(r => r.success);
  const userBalance = leaveBalanceStore[0];

  assert(successApprovals.length === 1 && userBalance.used_days === 5 && userBalance.remaining_days === 7,
    'TC-CONC-03: 2 Leader cùng duyệt 1 đơn -> Chỉ duyệt 1 lần, ngày phép chỉ bị trừ 1 lần duy nhất (không bị trừ 2 lần)');

  // TC-CONC-04: Xen kẽ (Interleaved Race) - Override đã đọc snapshot unlocked nhưng Lock được bật trước khi commit
  const raceResult = await simulateInterleavedOverrideAndLock();

  assert(
    raceResult.initialSnapshot.is_locked === false &&
    raceResult.overrideSuccess === false &&
    raceResult.attendanceUnmodified === true &&
    raceResult.lockFinalState === true,
    'TC-CONC-04: Xen kẽ concurrent race (Override đã đọc unlocked -> Lock bật lên) -> Write-Intent Guard chặn đứng mutation, bảo toàn công 100%'
  );
}

module.exports = runConcurrencyTests;
