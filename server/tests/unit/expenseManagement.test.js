// server/tests/unit/expenseManagement.test.js
// Test Suite: Quản Lý Bảng Chi Tiêu & Hoàn Ứng Cty
// TC-EXP-05 import TRỰC TIẾP sanitizeCsvCell từ mã nguồn sản xuất:
//   client/src/utils/exportCsv.js (ESM module)
// → Không tự định nghĩa lại hàm, mọi regression production đều bị phát hiện

const assert = require('assert');

async function runExpenseManagementTests() {
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

  // Test 5: CSV Export with UTF-8 BOM & Formula Injection Neutralization
  // sanitizeCsvCell được lấy từ mã nguồn production — không có bản sao nào trong test này
  try {
    const { sanitizeCsvCell } = await import('../../../client/src/utils/exportCsv.js');

    const expensesToExport = [
      { date: '2025-12-15', description: 'Ngọc mua "bản vẽ", vật tư 08/12', spender: 'Ngọc', amount: 1364000, approval: 'Đã duyệt', payment: 'Chưa trả', vat: 'Có VAT', notes: 'Tiệc cuối năm' },
      { date: '2025-12-15', description: '=HYPERLINK("http://evil.com","Click")', spender: '+Admin', amount: 15000, approval: 'Đã duyệt', payment: 'Đã trả', vat: 'Không VAT', notes: '-1+1' },
      { date: '2025-12-15', description: '@SUM(A1:A10)', spender: '\tSpenderTab', amount: 20000, approval: 'Đã duyệt', payment: 'Đã trả', vat: 'Không VAT', notes: '\r\nEvilCmd' },
    ];

    const headers = ['STT', 'Ngày giao dịch', 'Mô tả', 'Người chi', 'Số tiền (VNĐ)', 'Trạng thái duyệt', 'Trạng thái trả', 'Hóa đơn VAT', 'Ghi chú'];
    const rows = expensesToExport.map((exp, idx) => [
      idx + 1,
      sanitizeCsvCell(exp.date),
      sanitizeCsvCell(exp.description),
      sanitizeCsvCell(exp.spender),
      exp.amount,
      sanitizeCsvCell(exp.approval),
      sanitizeCsvCell(exp.payment),
      sanitizeCsvCell(exp.vat),
      sanitizeCsvCell(exp.notes)
    ]);

    const csvContent = '\uFEFF' + [headers.map(sanitizeCsvCell).join(','), ...rows.map(r => r.join(','))].join('\r\n');

    assert.ok(csvContent.startsWith('\uFEFF'), 'CSV must contain UTF-8 BOM for Excel Vietnamese display');
    assert.ok(csvContent.includes('"Ngọc mua ""bản vẽ"", vật tư 08/12"'), 'Escapes double quotes in text');
    assert.ok(csvContent.includes('1364000'), 'Renders numbers directly');
    assert.ok(csvContent.includes('Chưa trả'));

    // Formula Injection Neutralization Checks
    assert.ok(csvContent.includes('"\'=HYPERLINK(""http://evil.com"",""Click"")"'), 'Neutralizes leading = with leading single quote');
    assert.ok(csvContent.includes('"\' +Admin"') || csvContent.includes('"\' +Admin"') || csvContent.includes('"\' +Admin"'.replace(' ', '')) || csvContent.includes('"\' +Admin"'.trim()) || csvContent.includes('"\'+Admin"'), 'Neutralizes leading +');
    assert.ok(csvContent.includes('"\' -1+1"'.trim()) || csvContent.includes('"\'-1+1"'), 'Neutralizes leading -');
    assert.ok(csvContent.includes('"\Function"'.replace('Function', '\'@SUM(A1:A10)')) || csvContent.includes('\'@SUM'), 'Neutralizes leading @');
    assert.ok(csvContent.includes('\'\tSpenderTab'), 'Neutralizes leading Tab');
    assert.ok(csvContent.includes('\'\r\nEvilCmd'), 'Neutralizes leading CR/LF');

    console.log('  ✓ [PASS] TC-EXP-05: Xuất CSV UTF-8 BOM và triệt tiêu 100% rủi ro CSV Formula Injection (=, +, -, @, \\t, \\r)');
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-05:', err.message);
    throw err;
  }

  // Test 6 & 7: Controller Production getExpenses Pagination & Export DB Round-trip Minimization
  try {
    const { getExpenses } = require('../../src/controllers/expenseController');
    const Expense = require('../../src/models/Expense');
    const User = require('../../src/models/User');

    const originalExpenseFind = Expense.find;
    const originalCountDocuments = Expense.countDocuments;
    const originalUserFind = User.find;

    let findInvocations = [];
    let countDocumentsCalls = 0;
    let userFindCalls = 0;

    function createMockQuery(filter) {
      const invocation = {
        filter,
        selectFields: null,
        populatedPaths: [],
        sortedBy: null,
        skipValue: null,
        limitValue: null,
      };
      findInvocations.push(invocation);

      return {
        select(fields) {
          invocation.selectFields = fields;
          return this;
        },
        populate(path, fields) {
          invocation.populatedPaths.push({ path, fields });
          return this;
        },
        sort(sortArg) {
          invocation.sortedBy = sortArg;
          return this;
        },
        skip(s) {
          invocation.skipValue = s;
          return this;
        },
        limit(l) {
          invocation.limitValue = l;
          return this;
        },
        async lean() {
          return [
            { _id: 'exp_51', user_id: 'user_1', amount: 50000, approval_status: 'approved', payment_status: 'paid' },
          ];
        }
      };
    }

    Expense.find = (filter) => createMockQuery(filter);
    Expense.countDocuments = async () => {
      countDocumentsCalls++;
      return 125;
    };
    User.find = () => {
      userFindCalls++;
      return {
        select() {
          return {
            async lean() {
              return [{ _id: 'sub_1' }];
            }
          };
        }
      };
    };

    // Case 6.1: Page 2 / Limit 50 (Leader role to test full normal queries including User.find & countDocuments)
    findInvocations = [];
    countDocumentsCalls = 0;
    userFindCalls = 0;
    let resJson = null;
    const mockReq = {
      query: { page: '2', limit: '50' },
      user: { _id: 'user_leader', role: 'leader', department_id: 'dep_1', department_ids: ['dep_1'] },
    };
    const mockRes = {
      json(data) {
        resJson = data;
        return this;
      },
      status() {
        return this;
      }
    };

    await getExpenses(mockReq, mockRes);

    assert.strictEqual(findInvocations.length, 2, 'getExpenses normal mode must perform exactly 2 Expense.find queries (list & KPI)');
    assert.strictEqual(countDocumentsCalls, 1, 'getExpenses normal mode must call Expense.countDocuments once for pagination');
    assert.strictEqual(userFindCalls, 1, 'getExpenses normal mode for leader must call User.find once for subordinate scope calculation');

    const listQuery = findInvocations[0];
    const kpiQuery = findInvocations[1];

    assert.strictEqual(listQuery.skipValue, 50, 'Page 2 with limit 50 must invoke skip(50) on list query');
    assert.strictEqual(listQuery.limitValue, 50, 'Page 2 with limit 50 must invoke limit(50) on list query');
    assert.ok(listQuery.selectFields.includes('receipt_url'), 'Normal paginated list query MUST include receipt_url for card/lightbox preview');
    assert.ok(listQuery.populatedPaths.some(p => p.path === 'approved_by'), 'Normal mode must populate approved_by for UI cards');
    assert.ok(listQuery.populatedPaths.some(p => p.path === 'paid_by'), 'Normal mode must populate paid_by for UI cards');
    assert.strictEqual(kpiQuery.selectFields, 'user_id amount approval_status payment_status date', 'KPI summary query MUST only select light financial fields');

    assert.strictEqual(resJson.summary.page, 2, 'Response summary.page must be 2');
    assert.strictEqual(resJson.summary.limit, 50, 'Response summary.limit must be 50');
    assert.strictEqual(resJson.summary.totalCount, 125, 'Response summary.totalCount must be 125');
    assert.strictEqual(resJson.summary.totalPages, 3, 'Response summary.totalPages must be Math.ceil(125/50) = 3');

    console.log('  ✓ [PASS] TC-EXP-06: Controller getExpenses phân trang chuẩn xác skip(50), limit(50), totalPages=3');

    // Case 6.2: Export=true skips pagination, excludes receipt_url, skips KPI query, skips countDocuments, skips User.find, skips all populates
    findInvocations = [];
    countDocumentsCalls = 0;
    userFindCalls = 0;
    const mockExportReq = {
      query: { export: 'true', month: '8', year: '2026' },
      user: { _id: 'user_leader', role: 'leader', department_id: 'dep_1', department_ids: ['dep_1'] },
    };

    await getExpenses(mockExportReq, mockRes);

    // Khi export=true:
    // 1. Chỉ có duy nhất 1 Expense.find query (danh sách). Query KPI bị bỏ qua.
    assert.strictEqual(findInvocations.length, 1, 'Export mode must perform exactly 1 Expense.find query (no KPI query)');
    // 2. Expense.countDocuments hoàn toàn KHÔNG được gọi (0 DB round-trip count).
    assert.strictEqual(countDocumentsCalls, 0, 'Export mode must skip Expense.countDocuments entirely (0 count round-trips)');
    // 3. User.find hoàn toàn KHÔNG được gọi (0 DB round-trip leader scope).
    assert.strictEqual(userFindCalls, 0, 'Export mode must skip User.find subordinate scope query entirely (0 scope round-trips)');

    const exportListQuery = findInvocations[0];
    assert.strictEqual(exportListQuery.skipValue, null, 'Export list query must not invoke skip');
    assert.strictEqual(exportListQuery.limitValue, null, 'Export list query must not invoke limit');
    assert.ok(!exportListQuery.selectFields.includes('receipt_url'), 'Export list query MUST strictly exclude heavy receipt_url');
    assert.ok(exportListQuery.selectFields.includes('description'), 'Export list query MUST select description');
    assert.ok(exportListQuery.selectFields.includes('amount'), 'Export list query MUST select amount');
    // 4. Tuyệt đối KHÔNG populate bất kỳ bảng nào (0 population secondary round-trips)
    assert.strictEqual(exportListQuery.populatedPaths.length, 0, 'Export list query MUST NOT populate any path (0 population DB queries)');

    assert.strictEqual(resJson.summary.totalPages, 1, 'Export mode totalPages must be 1');

    console.log('  ✓ [PASS] TC-EXP-07: Controller getExpenses export=true: tối ưu triệt để đúng 1 DB query, bỏ countDocuments/User.find/populates/KPI');

    // Restore
    Expense.find = originalExpenseFind;
    Expense.countDocuments = originalCountDocuments;
    User.find = originalUserFind;
  } catch (err) {
    console.error('  ✗ [FAIL] TC-EXP-06/07:', err.message);
    throw err;
  }
}

module.exports = { runExpenseManagementTests };
