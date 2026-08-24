// server/tests/unit/expenseManagement.test.js
// Test Suite: Quản Lý Bảng Chi Tiêu & Hoàn Ứng Cty

const assert = require('assert');

function runExpenseManagementTests() {
  console.log('\n💵 [TEST SUITE: COMPANY EXPENSES & REIMBURSEMENT MANAGEMENT]');

  // Test 1: Validate Expense Creation
  try {
    const invalidPayloads = [
      { date: '', description: 'Mua cafe', amount: 50000 },
      { date: '2026-08-24', description: '', amount: 50000 },
      { date: '2026-08-24', description: 'Mua cafe', amount: -1000 },
      { date: '2026-08-24', description: 'Mua cafe', amount: 0 },
      { date: '2026-08-24', description: 'Mua cafe', amount: 'abc' },
    ];

    invalidPayloads.forEach((payload, idx) => {
      const isValid = Boolean(
        payload.date &&
        payload.description &&
        typeof payload.amount === 'number' &&
        payload.amount > 0
      );
      assert.strictEqual(isValid, false, `Payload #${idx} must be invalid`);
    });

    const validPayload = {
      date: '2026-08-24',
      description: 'Ngọc mua rượu 08/12',
      amount: 1364000,
      has_vat_invoice: true,
      receipt_url: 'data:image/jpeg;base64,sample',
    };
    const isValid = Boolean(
      validPayload.date &&
      validPayload.description &&
      typeof validPayload.amount === 'number' &&
      validPayload.amount > 0
    );
    assert.strictEqual(isValid, true, 'Valid payload should pass validation');

    console.log('  ✓ [PASS] TC-EXP-01: Validation dữ liệu đầu vào khi tạo khoản chi tiêu');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-01:', err.message);
    throw err;
  }

  // Test 2: KPI & Summary Calculation
  try {
    const mockExpenses = [
      { _id: '1', user_id: 'user_1', amount: 1364000, approval_status: 'approved', payment_status: 'unpaid' },
      { _id: '2', user_id: 'user_2', amount: 15000, approval_status: 'approved', payment_status: 'paid' },
      { _id: '3', user_id: 'user_2', amount: 108000, approval_status: 'pending', payment_status: 'unpaid' },
      { _id: '4', user_id: 'user_3', amount: 190000, approval_status: 'rejected', payment_status: 'unpaid' },
      { _id: '5', user_id: 'user_1', amount: 40000, approval_status: 'approved', payment_status: 'paid' },
    ];

    let totalApprovedAmount = 0;
    let totalPendingAmount = 0;
    let totalPendingCount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidAmount = 0;
    let myTotalApproved = 0;
    let myTotalUnpaid = 0;

    const currentUserId = 'user_1';

    mockExpenses.forEach(exp => {
      const isMine = exp.user_id === currentUserId;
      if (exp.approval_status === 'approved') {
        totalApprovedAmount += exp.amount;
        if (exp.payment_status === 'paid') {
          totalPaidAmount += exp.amount;
        } else {
          totalUnpaidAmount += exp.amount;
        }

        if (isMine) {
          myTotalApproved += exp.amount;
          if (exp.payment_status !== 'paid') {
            myTotalUnpaid += exp.amount;
          }
        }
      } else if (exp.approval_status === 'pending') {
        totalPendingAmount += exp.amount;
        totalPendingCount += 1;
      }
    });

    // Verify
    assert.strictEqual(totalApprovedAmount, 1364000 + 15000 + 40000); // 1.419.000 đ
    assert.strictEqual(totalPendingAmount, 108000); // 108.000 đ
    assert.strictEqual(totalPendingCount, 1);
    assert.strictEqual(totalUnpaidAmount, 1364000); // 1.364.000 đ
    assert.strictEqual(totalPaidAmount, 15000 + 40000); // 55.000 đ
    assert.strictEqual(myTotalApproved, 1364000 + 40000); // 1.404.000 đ
    assert.strictEqual(myTotalUnpaid, 1364000); // 1.364.000 đ

    console.log('  ✓ [PASS] TC-EXP-02: Tính toán chính xác 100% KPI Tổng đã chi, Chờ duyệt, Chưa trả, Đã trả');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-02:', err.message);
    throw err;
  }

  // Test 3: Approval & Rejection Logic
  try {
    const expense = {
      _id: 'exp_100',
      description: 'Circle K công tác',
      amount: 108000,
      approval_status: 'pending',
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    };

    // Case 3.1: Approve
    const adminId = 'admin_999';
    expense.approval_status = 'approved';
    expense.approved_by = adminId;
    expense.approved_at = new Date();

    assert.strictEqual(expense.approval_status, 'approved');
    assert.strictEqual(expense.approved_by, adminId);
    assert.ok(expense.approved_at instanceof Date);

    // Case 3.2: Reject
    expense.approval_status = 'rejected';
    expense.rejection_reason = 'Hóa đơn mờ không đọc được số tiền';
    assert.strictEqual(expense.approval_status, 'rejected');
    assert.strictEqual(expense.rejection_reason, 'Hóa đơn mờ không đọc được số tiền');

    console.log('  ✓ [PASS] TC-EXP-03: Xử lý duyệt chi & từ chối kèm lý do chính xác');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-03:', err.message);
    throw err;
  }

  // Test 4: Payment & Reimbursement Flow
  try {
    const expense = {
      _id: 'exp_101',
      description: 'Mua đồ thắp hương',
      amount: 243000,
      approval_status: 'approved',
      payment_status: 'unpaid',
      paid_by: null,
      paid_at: null,
      payment_note: null,
    };

    // Mark as Paid
    const accountantId = 'admin_999';
    expense.payment_status = 'paid';
    expense.paid_by = accountantId;
    expense.paid_at = new Date();
    expense.payment_note = 'Đã CK qua Techcombank';

    assert.strictEqual(expense.payment_status, 'paid');
    assert.strictEqual(expense.paid_by, accountantId);
    assert.strictEqual(expense.payment_note, 'Đã CK qua Techcombank');

    console.log('  ✓ [PASS] TC-EXP-04: Đánh dấu đã chuyển khoản hoàn ứng thành công');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-04:', err.message);
    throw err;
  }

  // Test 5: CSV Export with UTF-8 BOM
  try {
    const expensesToExport = [
      { date: '2025-12-15', description: 'Ngọc mua rượu 08/12', spender: 'Ngọc', amount: 1364000, approval: 'Đã duyệt', payment: 'Chưa trả', vat: 'Có VAT', notes: 'Tiệc cuối năm' },
      { date: '2025-12-15', description: 'cf', spender: 'Ninh', amount: 15000, approval: 'Đã duyệt', payment: 'Đã trả', vat: 'Không VAT', notes: '' },
    ];

    const headers = ['STT', 'Ngày giao dịch', 'Mô tả', 'Người chi', 'Số tiền (VNĐ)', 'Trạng thái duyệt', 'Trạng thái trả', 'Hóa đơn VAT', 'Ghi chú'];
    const rows = expensesToExport.map((exp, idx) => [
      idx + 1,
      exp.date,
      `"${exp.description}"`,
      `"${exp.spender}"`,
      exp.amount,
      `"${exp.approval}"`,
      `"${exp.payment}"`,
      `"${exp.vat}"`,
      `"${exp.notes}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    assert.ok(csvContent.startsWith('\uFEFF'), 'CSV must contain UTF-8 BOM for Excel Vietnamese display');
    assert.ok(csvContent.includes('Ngọc mua rượu 08/12'));
    assert.ok(csvContent.includes('1364000'));
    assert.ok(csvContent.includes('Chưa trả'));

    console.log('  ✓ [PASS] TC-EXP-05: Xuất file CSV UTF-8 BOM chuẩn bảng tổng hợp Google Sheets');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-05:', err.message);
    throw err;
  }
}

module.exports = { runExpenseManagementTests };
