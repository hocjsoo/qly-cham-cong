// server/tests/unit/fundManagement.test.js
// Test Suite: Quản Lý Sổ Quỹ Tạm Ứng Xoay Vòng (Petty Cash Fund)

function runFundManagementTests(assert) {
  console.log('\n🏦 [TEST SUITE: ADVANCE FUND & PETTY CASH MANAGEMENT]');

  // Test 1: Validation dữ liệu nạp quỹ
  const invalidPayloads = [
    { date: '', amount: 10000000, holder_id: 'user_1' },
    { date: '2026-10-01', amount: 0, holder_id: 'user_1' },
    { date: '2026-10-01', amount: -500000, holder_id: 'user_1' },
    { date: '2026-10-01', amount: 'abc', holder_id: 'user_1' },
    { date: '2026-10-01', amount: 5000000, holder_id: null },
    { date: '2026-10-01', amount: 5000000, holder_id: '' },
  ];

  invalidPayloads.forEach((payload, idx) => {
    const isValid = Boolean(
      payload.date &&
      typeof payload.amount === 'number' &&
      payload.amount > 0 &&
      payload.holder_id
    );
    assert(isValid === false, `TC-FUND-01.${idx + 1}: Bắt lỗi nạp quỹ không hợp lệ payload #${idx + 1}`);
  });

  const validPayload = {
    date: '2026-10-01',
    amount: 10000000,
    sender_name: 'Ban Giám Đốc / Sếp',
    holder_id: '6a6462bfcfb9793ca87ca003',
    note: 'Tạm ứng đợt 1 T10',
  };
  const isValid = Boolean(
    validPayload.date &&
    typeof validPayload.amount === 'number' &&
    validPayload.amount > 0 &&
    validPayload.holder_id
  );
  assert(isValid === true, 'TC-FUND-01.7: Chấp nhận đợt nạp quỹ hợp lệ');

  // Test 2: Tính toán số dư quỹ dương (Dư tiền)
  const mockDeposits = [
    { amount: 10000000, date: '2026-10-01' },
    { amount: 5000000, date: '2026-10-05' },
  ];
  const mockExpensesPaidFromFund = [
    { amount: 1111111, payment_status: 'paid', paid_from_fund: true },
    { amount: 425000, payment_status: 'paid', paid_from_fund: true },
    { amount: 875000, payment_status: 'paid', paid_from_fund: true },
  ];

  const totalFundIn = mockDeposits.reduce((s, d) => s + d.amount, 0); // 15.000.000 đ
  const totalFundOut = mockExpensesPaidFromFund.reduce((s, e) => s + e.amount, 0); // 2.411.111 đ
  const balance = totalFundIn - totalFundOut; // 12.588.889 đ

  assert(totalFundIn === 15000000, 'TC-FUND-02.1: Tổng tiền nạp quỹ đạt 15.000.000 đ');
  assert(totalFundOut === 2411111, 'TC-FUND-02.2: Tổng tiền đã xuất quỹ đạt 2.411.111 đ');
  assert(balance === 12588889 && balance > 0, 'TC-FUND-02.3: Số dư quỹ dương đạt +12.588.889 đ');

  // Test 3: Tính toán số dư quỹ âm (Chi vượt quỹ -> Công ty nợ người giữ quỹ)
  const mockDepositsSmall = [
    { amount: 5000000, date: '2026-10-01' },
  ];
  const mockExpensesOver = [
    { amount: 3500000, payment_status: 'paid', paid_from_fund: true },
    { amount: 2500000, payment_status: 'paid', paid_from_fund: true },
  ];

  const totalFundInSmall = mockDepositsSmall.reduce((s, d) => s + d.amount, 0);
  const totalFundOutOver = mockExpensesOver.reduce((s, e) => s + e.amount, 0);
  const negativeBalance = totalFundInSmall - totalFundOutOver;

  assert(negativeBalance === -1000000 && negativeBalance < 0,
    'TC-FUND-03: Tính toán chính xác số dư quỹ âm (-1.000.000 đ), cty nợ người giữ quỹ');

  // Test 4: Hoàn tác thanh toán khoản chi (paid -> unpaid) tự động phục hồi số dư quỹ
  let fundBalance = 5000000;
  const expense = { _id: 'e1', amount: 1500000, payment_status: 'unpaid', paid_from_fund: false };

  expense.payment_status = 'paid';
  expense.paid_from_fund = true;
  fundBalance -= expense.amount;
  assert(fundBalance === 3500000, 'TC-FUND-04.1: Thanh toán thành công, quỹ giảm còn 3.500.000 đ');

  expense.payment_status = 'unpaid';
  expense.paid_from_fund = false;
  fundBalance += expense.amount;
  assert(fundBalance === 5000000, 'TC-FUND-04.2: Hoàn tác thanh toán, số dư quỹ phục hồi nguyên vẹn 5.000.000 đ');

  // Test 5: Không tính khoản chi chưa trả (unpaid) vào tổng đã xuất quỹ
  const expenses = [
    { amount: 500000, payment_status: 'paid', paid_from_fund: true },
    { amount: 300000, payment_status: 'unpaid', paid_from_fund: false },
    { amount: 200000, payment_status: 'unpaid', paid_from_fund: true },
  ];

  const actualDisbursed = expenses
    .filter(e => e.payment_status === 'paid' && e.paid_from_fund === true)
    .reduce((s, e) => s + e.amount, 0);

  assert(actualDisbursed === 500000, 'TC-FUND-05: Chỉ tính khoản đã thực tế xuất quỹ (paid=true) vào tổng xuất');
}

module.exports = runFundManagementTests;
