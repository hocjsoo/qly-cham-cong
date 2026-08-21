// ==============================================
// tests/integration/transactionRollback.test.js
// Kiểm thử Xử lý Lỗi Giao dịch & Cơ chế Rollback / Bù trừ (Transaction Fault Tolerance)
// ==============================================

async function executeLeaveApprovalTransaction(dbState, reqId, shouldFailStep2 = false) {
  const originalReq = JSON.parse(JSON.stringify(dbState.requests.find(r => r._id === reqId)));
  const originalBalance = JSON.parse(JSON.stringify(dbState.leaveBalances.find(b => b.user_id === originalReq.user_id)));

  // BƯỚC 1: Cập nhật đơn thành approved
  const req = dbState.requests.find(r => r._id === reqId);
  req.status = 'approved';

  try {
    // BƯỚC 2: Khấu trừ ngày phép trong LeaveBalance
    if (shouldFailStep2) {
      throw new Error('MÔ PHỎNG LỖI MẠNG: Kết nối MongoDB Atlas bị ngắt quãng khi đang trừ ngày phép!');
    }

    const bal = dbState.leaveBalances.find(b => b.user_id === req.user_id);
    bal.used_days += req.days;
    bal.remaining_days -= req.days;

    // BƯỚC 3: Tạo bản ghi chấm công ngày nghỉ (P)
    dbState.attendances.push({
      user_id: req.user_id,
      date: req.date,
      status: 'leave',
      notes: 'Nghỉ phép năm (P)'
    });

    return { success: true, message: 'Giao dịch hoàn tất thành công' };

  } catch (error) {
    // CƠ CHẾ ROLLBACK (BÙ TRỪ): Phục hồi toàn bộ trạng thái về ban đầu khi có lỗi xảy ra ở bước sau
    req.status = originalReq.status;
    const bal = dbState.leaveBalances.find(b => b.user_id === req.user_id);
    if (bal && originalBalance) {
      bal.used_days = originalBalance.used_days;
      bal.remaining_days = originalBalance.remaining_days;
    }
    // Xóa bản ghi điểm danh rác nếu đã lỡ tạo
    dbState.attendances = dbState.attendances.filter(a => !(a.user_id === req.user_id && a.date === req.date));

    return {
      success: false,
      rolledBack: true,
      error: error.message,
      message: 'Đã kích hoạt Rollback: Dữ liệu được bảo toàn nguyên vẹn, đơn được đưa lại trạng thái pending.'
    };
  }
}

async function runTransactionRollbackTests(assert) {
  console.log('\n💥 [TEST SUITE: TRANSACTION FAULT TOLERANCE & ROLLBACK]');

  // TC-TX-01: Giao dịch duyệt đơn bình thường (Happy Path)
  const dbHappy = {
    requests: [{ _id: 'req_1', user_id: 'u1', days: 2, date: '2026-08-25', status: 'pending' }],
    leaveBalances: [{ user_id: 'u1', used_days: 3, remaining_days: 9 }],
    attendances: []
  };

  const resHappy = await executeLeaveApprovalTransaction(dbHappy, 'req_1', false);
  assert(resHappy.success === true && dbHappy.requests[0].status === 'approved' && dbHappy.leaveBalances[0].used_days === 5 && dbHappy.attendances.length === 1,
    'TC-TX-01: Giao dịch 3 bước thành công toàn vẹn khi không có sự cố');

  // TC-TX-02: Mô phỏng lỗi mạng ở bước 2 -> Tự động Rollback hoàn toàn
  const dbFaulty = {
    requests: [{ _id: 'req_2', user_id: 'u2', days: 2, date: '2026-08-26', status: 'pending' }],
    leaveBalances: [{ user_id: 'u2', used_days: 1, remaining_days: 11 }],
    attendances: []
  };

  const resFaulty = await executeLeaveApprovalTransaction(dbFaulty, 'req_2', true); // Giả lập lỗi ở bước 2

  assert(resFaulty.success === false && resFaulty.rolledBack === true,
    'TC-TX-02.1: Phát hiện lỗi gián đoạn -> Kích hoạt cơ chế Rollback an toàn');

  assert(dbFaulty.requests[0].status === 'pending',
    'TC-TX-02.2: Rollback: Trạng thái đơn được hoàn nguyên về "pending" (không bị kẹt ở approved)');

  assert(dbFaulty.leaveBalances[0].used_days === 1 && dbFaulty.leaveBalances[0].remaining_days === 11,
    'TC-TX-02.3: Rollback: Ngày phép của nhân viên được bảo toàn nguyên vẹn (không bị mất ngày phép)');

  assert(dbFaulty.attendances.length === 0,
    'TC-TX-02.4: Rollback: Không sinh ra bản ghi điểm danh rác khi giao dịch thất bại');
}

module.exports = runTransactionRollbackTests;
