// ==============================================

const ExcelJS = require('exceljs');
const exportController = require('../../src/controllers/exportController');
// tests/unit/exportCalculations.test.js
// Kiểm thử Công cụ Xuất Báo cáo Excel & Ánh xạ Ký hiệu Bảng công
// ==============================================

function getTimesheetSymbol(rec) {
  if (!rec) return '';
  const notes = (rec.notes || '').toUpperCase();
  if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI')) return 'CT2';
  if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || rec.check_in_type === 'site') return 'CT1';
  if (rec.check_in_type === 'wfh' || notes.includes('WFH')) return 'WFH';
  if (rec.status === 'leave' || notes.includes('NGHỈ PHÉP') || notes.includes('(P)')) return 'P';
  if (notes.includes('NGHỈ ỐM') || notes.includes('(O)')) return 'O';
  if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)')) return 'KL';
  if (notes.includes('(K)') || notes.includes('KHÁC')) return 'K';
  if (rec.total_hours >= 7.5) return 'x';
  if (rec.total_hours >= 5.5) return '0,75x';
  if (rec.total_hours >= 3.5) return '0,5x';
  if (rec.total_hours > 0) return '0,5x';
  return '';
}

function aggregateMonthlyStaffTimesheet(dailyRecords) {
  let nlv_office = 0;
  let ct_domestic = 0;
  let ct_foreign = 0;
  let wfh = 0;
  let annual_leave = 0;
  let sick_leave = 0;
  let unpaid_leave = 0;
  let other_leave = 0;

  dailyRecords.forEach(rec => {
    const sym = getTimesheetSymbol(rec);
    if (sym === 'x') nlv_office += 1.0;
    else if (sym === '0,75x') nlv_office += 0.75;
    else if (sym === '0,5x') nlv_office += 0.5;
    else if (sym === 'CT1') ct_domestic += 1;
    else if (sym === 'CT2') ct_foreign += 1;
    else if (sym === 'WFH') wfh += 1;
    else if (sym === 'P') annual_leave += 1;
    else if (sym === 'O') sick_leave += 1;
    else if (sym === 'KL') unpaid_leave += 1;
    else if (sym === 'K') other_leave += 1;
  });

  const totalWorkingDays = nlv_office + ct_domestic + ct_foreign + wfh + annual_leave;

  return {
    nlv_office,
    ct_domestic,
    ct_foreign,
    wfh,
    annual_leave,
    sick_leave,
    unpaid_leave,
    other_leave,
    totalWorkingDays
  };
}

async function runExportTests(assert) {
  console.log('\n📑 [TEST SUITE: EXCEL EXPORT & SUMMARY CALCULATIONS]');

  // TC-EXP-01: Ánh xạ ký hiệu theo số giờ công làm việc
  assert(getTimesheetSymbol({ total_hours: 8.0 }) === 'x', 'TC-EXP-01.1: 8.0h -> Ký hiệu "x" (đủ 1 ngày công)');
  assert(getTimesheetSymbol({ total_hours: 6.0 }) === '0,75x', 'TC-EXP-01.2: 6.0h -> Ký hiệu "0,75x"');
  assert(getTimesheetSymbol({ total_hours: 4.0 }) === '0,5x', 'TC-EXP-01.3: 4.0h -> Ký hiệu "0,5x" (nửa ngày)');
  assert(getTimesheetSymbol(null) === '', 'TC-EXP-01.4: Không có bản ghi -> Ký hiệu rỗng ""');

  // TC-EXP-02: Ánh xạ theo đặc thù công tác & WFH
  assert(getTimesheetSymbol({ check_in_type: 'site', notes: 'Công tác Hà Nội' }) === 'CT1',
    'TC-EXP-02.1: Công tác trong nước -> Ký hiệu "CT1"');
  assert(getTimesheetSymbol({ notes: 'Công tác nước ngoài (CT2)' }) === 'CT2',
    'TC-EXP-02.2: Công tác nước ngoài -> Ký hiệu "CT2"');
  assert(getTimesheetSymbol({ check_in_type: 'wfh' }) === 'WFH',
    'TC-EXP-02.3: Làm việc tại nhà -> Ký hiệu "WFH"');

  // TC-EXP-03: Tổng hợp cột tổng công cả tháng
  const mockMonthDays = [
    { total_hours: 8 }, // x (1.0)
    { total_hours: 8 }, // x (1.0)
    { total_hours: 4 }, // 0,5x (0.5)
    { check_in_type: 'wfh' }, // WFH (1.0)
    { check_in_type: 'site' }, // CT1 (1.0)
    { status: 'leave', notes: 'Nghỉ phép năm (P)' }, // P (1.0)
    { notes: 'Nghỉ không lương (KL)' }, // KL (0.0)
  ];

  const summary = aggregateMonthlyStaffTimesheet(mockMonthDays);
  assert(summary.nlv_office === 2.5, 'TC-EXP-03.1: Tổng ngày làm việc tại VP = 2.5 công');
  assert(summary.wfh === 1 && summary.ct_domestic === 1 && summary.annual_leave === 1 && summary.unpaid_leave === 1,
    'TC-EXP-03.2: Đúng 1 ngày WFH, 1 CT1, 1 phép năm (P), 1 nghỉ không lương (KL)');
  assert(summary.totalWorkingDays === 5.5, 'TC-EXP-03.3: Tổng công hưởng lương tính cả phép & WFH = 5.5 ngày công');

  const workbookInput = {
    users: [{
      _id: 'u1',
      employee_code: 'NS-001',
      full_name: 'Nhân viên Test',
      position: 'KTS',
      role: 'employee',
      email: 'test@example.com',
      phone: '0900000000',
      department_id: { name: 'Thiết kế' },
      cccd: '012345678901',
      bank_account: '123456789',
      bhxh_code: 'BHXH-001',
    }],
    attendances: [{ user_id: 'u1', date: '2026-08-01', total_hours: 8, work_units: 1 }],
    month: 8,
    year: 2026,
  };

  const leaderWorkbook = exportController.__test.buildAttendanceWorkbook({
    ...workbookInput,
    includeSensitive: false,
  });
  const leaderDirectory = leaderWorkbook.getWorksheet('Danh Bạ Nhóm');
  const leaderHeaders = leaderDirectory.getRow(1).values.map(String);
  assert(
    leaderWorkbook.worksheets.length === 2 &&
      leaderDirectory &&
      !leaderHeaders.includes('CCCD') &&
      !leaderHeaders.includes('STK') &&
      !leaderHeaders.includes('MÃ BHXH'),
    'TC-EXP-04: File Leader chỉ có danh bạ nhóm, không chứa CCCD/ngân hàng/BHXH'
  );

  const buffer = Buffer.from(await leaderWorkbook.xlsx.writeBuffer());
  const loadedWorkbook = new ExcelJS.Workbook();
  await loadedWorkbook.xlsx.load(buffer);
  assert(
    buffer.subarray(0, 2).toString() === 'PK' &&
      loadedWorkbook.worksheets.length === 2 &&
      loadedWorkbook.getWorksheet('Chấm Công ET_Staff'),
    'TC-EXP-05: Workbook ExcelJS tạo file XLSX ZIP hợp lệ và đọc lại được'
  );

  const adminWorkbook = exportController.__test.buildAttendanceWorkbook({
    ...workbookInput,
    includeSensitive: true,
  });
  const adminHeaders = adminWorkbook.getWorksheet('Thông Tin Nhân Sự').getRow(1).values.map(String);
  assert(
    adminHeaders.includes('CCCD') && adminHeaders.includes('STK') && adminHeaders.includes('MÃ BHXH'),
    'TC-EXP-06: File Admin giữ đúng sheet nhân sự nhạy cảm theo quyền quản trị'
  );
}

module.exports = runExportTests;
