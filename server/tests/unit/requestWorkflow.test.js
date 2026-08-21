// ==============================================
// tests/unit/requestWorkflow.test.js
// Kiểm thử Quy trình Đơn từ & Tự động Khấu trừ Phép Năm
// Độc lập 100% không đụng vào Database
// ==============================================

const VALID_TYPES = ['late', 'early_leave', 'overtime', 'business_trip', 'foreign_trip', 'wfh', 'sick_leave', 'annual_leave', 'unpaid_leave', 'other'];

function calculateLeaveDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr || startDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function processLeaveDeduction(currentBalance, daysToDeduct) {
  const newUsed = (currentBalance.used_days || 0) + daysToDeduct;
  const totalAvailable = (currentBalance.total_annual_days || 12) + (currentBalance.carry_forward_days || 0);
  const newRemaining = totalAvailable - newUsed;
  return {
    ...currentBalance,
    used_days: newUsed,
    remaining_days: newRemaining,
    is_overdrawn: newRemaining < 0
  };
}

function checkDuplicateRequest(existingRequests, userId, type, startDate) {
  return existingRequests.some(r =>
    r.user_id === userId &&
    r.type === type &&
    r.start_date === startDate &&
    ['pending', 'approved'].includes(r.status)
  );
}

function runRequestTests(assert) {
  console.log('\n📝 [TEST SUITE: REQUEST WORKFLOW & LEAVE BALANCE]');

  // TC-REQ-01: Kiểm tra danh sách loại đơn hợp lệ
  assert(VALID_TYPES.includes('annual_leave') && VALID_TYPES.includes('wfh') && VALID_TYPES.includes('overtime'),
    'TC-REQ-01: Hỗ trợ đầy đủ các loại đơn chính (annual_leave, wfh, overtime, business_trip)');

  // TC-REQ-02: Tính số ngày nghỉ phép (1 ngày vs nhiều ngày)
  const singleDay = calculateLeaveDays('2026-08-10', '2026-08-10');
  assert(singleDay === 1, 'TC-REQ-02.1: Đơn 1 ngày (10/08 -> 10/08) -> 1 ngày phép');

  const multiDays = calculateLeaveDays('2026-08-10', '2026-08-12');
  assert(multiDays === 3, 'TC-REQ-02.2: Đơn 3 ngày (10/08 -> 12/08) -> 3 ngày phép');

  // TC-REQ-03: Khấu trừ ngày phép khi duyệt đơn nghỉ phép năm
  const initialBalance = {
    user_id: 'u1',
    year: 2026,
    total_annual_days: 12,
    carry_forward_days: 2,
    used_days: 3,
    remaining_days: 11
  };

  const updatedBalance = processLeaveDeduction(initialBalance, 2);
  assert(updatedBalance.used_days === 5 && updatedBalance.remaining_days === 9,
    'TC-REQ-03: Khấu trừ 2 ngày phép -> used_days=5, remaining_days=9');

  // TC-REQ-04: Cảnh báo khi nghỉ vượt quá số ngày phép còn lại (14 ngày khả dụng, dùng 3, xin thêm 15 -> -4)
  const overdrawnBalance = processLeaveDeduction(initialBalance, 15);
  assert(overdrawnBalance.remaining_days === -4 && overdrawnBalance.is_overdrawn === true,
    'TC-REQ-04: Nghỉ vượt quá số phép -> remaining_days = -4 (< 0), gắn cờ is_overdrawn');

  // TC-REQ-05: Chặn tạo đơn trùng lặp trong cùng ngày
  const mockExisting = [
    { user_id: 'u1', type: 'annual_leave', start_date: '2026-08-15', status: 'pending' },
    { user_id: 'u1', type: 'wfh', start_date: '2026-08-20', status: 'rejected' },
  ];

  const isDup1 = checkDuplicateRequest(mockExisting, 'u1', 'annual_leave', '2026-08-15');
  assert(isDup1 === true, 'TC-REQ-05.1: Chặn nộp đơn trùng ngày 15/08 đã có đơn annual_leave pending');

  const isDup2 = checkDuplicateRequest(mockExisting, 'u1', 'wfh', '2026-08-20');
  assert(isDup2 === false, 'TC-REQ-05.2: Cho phép nộp lại đơn ngày 20/08 vì đơn trước đó đã bị rejected');
}

module.exports = runRequestTests;
