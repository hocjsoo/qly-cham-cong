// controllers/exportController.js — Excel export engine (Chuẩn mẫu ET_Staff 2026)
const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Department = require('../models/Department');
const Expense = require('../models/Expense');
const {
  isLeaderRole,
  buildLeaderUserScope,
  combineUserFilters,
} = require('../utils/roleScope');

function getTimesheetSymbol(rec) {
  if (!rec) return '';
  const workUnits = Number(rec.work_units);
  const notes = (rec.notes || '').toUpperCase();
  if (workUnits === 1.5) return '1,5x';
  if (workUnits === 1.75) return '1,75x';
  if (workUnits === 2) return '2x';
  if (workUnits === 3) return '3x';
  if (rec.status === 'holiday') return 'L';
  if (rec.status === 'leave') {
    if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)') || notes.includes('[KL]')) return 'KL';
    if (notes.includes('NGHỈ ỐM') || notes.includes('(O)') || notes.includes('[O]')) return 'O';
    return 'P';
  }
  if (rec.check_in_type === 'client') return 'CT2';
  if (rec.check_in_type === 'site') return 'CT1';
  if (rec.check_in_type === 'wfh') return 'WFH';
  if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI') || notes.includes('[CT2]')) return 'CT2';
  if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || notes.includes('[CT1]')) return 'CT1';
  if (notes.includes('NGHỈ PHÉP') || notes.includes('(P)') || notes.includes('[P]')) return 'P';
  if (notes.includes('NGHỈ ỐM') || notes.includes('(O)') || notes.includes('[O]')) return 'O';
  if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)') || notes.includes('[KL]')) return 'KL';
  if (notes.includes('(K)') || notes.includes('KHÁC') || notes.includes('[K]')) return 'K';
  if (notes.includes('NGHỈ LỄ') || notes.includes('(L)') || notes.includes('[L]')) return 'L';
  if (rec.work_units === 0.75 || notes.includes('[0,75X]') || notes.includes('[0.75X]') || notes.includes('0,75X') || notes.includes('0.75X')) return '0,75x';
  if (rec.work_units === 0.5 || rec.status === 'half_day' || notes.includes('[0,5X]') || notes.includes('[0.5X]') || notes.includes('0,5X') || notes.includes('0.5X')) return '0,5x';
  if (notes.includes('[X]') || rec.work_units === 1.0 || rec.total_hours >= 7.5) return 'x';
  if (rec.total_hours >= 5.5) return '0,75x';
  if (rec.total_hours > 0) return '0,5x';
  return '';
}

const getDepartmentName = user => {
  if (Array.isArray(user.department_ids) && user.department_ids.length > 0) {
    return user.department_ids.map(department => department?.name).filter(Boolean).join(', ') || '—';
  }
  return user.department_id?.name || '—';
};

const createSummaryRows = ({ users, attendances, month, year }) => {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const attendancesByUser = new Map();

  attendances.forEach(attendance => {
    const userId = String(attendance.user_id?._id || attendance.user_id);
    if (!attendancesByUser.has(userId)) attendancesByUser.set(userId, []);
    attendancesByUser.get(userId).push(attendance);
  });

  const rows = users.map((user, index) => {
    const records = attendancesByUser.get(String(user._id)) || [];
    const attendanceByDate = new Map(records.map(record => [record.date, record]));
    const totals = {
      office: 0,
      domestic: 0,
      foreign: 0,
      wfh: 0,
      annualLeave: 0,
      sickLeave: 0,
      unpaidLeave: 0,
      otherLeave: 0,
    };
    const daySymbols = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const columnKey = String(day).padStart(2, '0');
      const symbol = getTimesheetSymbol(attendanceByDate.get(`${monthStr}-${columnKey}`));
      daySymbols[columnKey] = symbol;

      if (symbol === 'CT2') totals.foreign += 1;
      else if (symbol === 'CT1') totals.domestic += 1;
      else if (symbol === 'WFH') totals.wfh += 1;
      else if (symbol === 'P') totals.annualLeave += 1;
      else if (symbol === 'O') totals.sickLeave += 1;
      else if (symbol === 'KL') totals.unpaidLeave += 1;
      else if (symbol === 'K') totals.otherLeave += 1;
      else if (symbol === 'x') totals.office += 1;
      else if (symbol === '0,75x') totals.office += 0.75;
      else if (symbol === '0,5x') totals.office += 0.5;
      else if (symbol === '1,5x' || symbol === '1,75x' || symbol === '2x' || symbol === '3x') {
        totals.office += Number(attendanceByDate.get(`${monthStr}-${columnKey}`)?.work_units) || 0;
      }
    }

    return {
      ID: user.employee_code || `NS ${String(index + 1).padStart(2, '0')}`,
      'NHÂN SỰ': user.full_name,
      'CHỨC VỤ': user.position || (user.role === 'admin' ? 'KTS-PGD' : (isLeaderRole(user) ? 'KTS NT - QL' : 'KTS')),
      'NLV tại VP': Number(totals.office.toFixed(2)),
      'CT Trong nước': Number(totals.domestic.toFixed(2)),
      'CT Nước ngoài': Number(totals.foreign.toFixed(2)),
      'Work from home': Number(totals.wfh.toFixed(2)),
      'Nghỉ phép': Number(totals.annualLeave.toFixed(2)),
      'Nghỉ ốm': Number(totals.sickLeave.toFixed(2)),
      'Nghỉ không lương': Number(totals.unpaidLeave.toFixed(2)),
      Khác: Number(totals.otherLeave.toFixed(2)),
      'Muộn (lượt)': records.filter(record => record.is_late).length,
      'Sớm (lượt)': records.filter(record => record.is_early_leave).length,
      'Tổng giờ OT': Number(records.reduce((sum, record) => sum + (record.ot_status === 'pending_approval' ? 0 : (record.ot_hours || 0)), 0).toFixed(1)),
      ...daySymbols,
    };
  });

  const totalRow = {
    ID: 'TỔNG CỘNG',
    'NHÂN SỰ': `HỆ THỐNG (${users.length} NV)`,
    'CHỨC VỤ': '—',
  };
  const numericKeys = [
    'NLV tại VP', 'CT Trong nước', 'CT Nước ngoài', 'Work from home',
    'Nghỉ phép', 'Nghỉ ốm', 'Nghỉ không lương', 'Khác',
    'Muộn (lượt)', 'Sớm (lượt)', 'Tổng giờ OT',
  ];
  numericKeys.forEach(key => {
    totalRow[key] = Number(rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0).toFixed(2));
  });
  for (let day = 1; day <= daysInMonth; day++) {
    totalRow[String(day).padStart(2, '0')] = '—';
  }

  return { rows: [...rows, totalRow], daysInMonth };
};

const buildDirectoryRows = (users, includeSensitive) => users.map((user, index) => {
  const row = {
    STT: index + 1,
    ID: user.employee_code || `NS ${String(index + 1).padStart(2, '0')}`,
    'HỌ TÊN': user.full_name,
    'CHỨC VỤ': user.position || 'KTS',
    'PHÒNG BAN': getDepartmentName(user),
    'TRẠNG THÁI': user.employment_status || 'Đang làm việc',
    'SĐT': user.phone || '—',
    EMAIL: user.email || '—',
  };

  if (includeSensitive) {
    Object.assign(row, {
      'NGÀY SINH': user.dob || '—',
      'QUÊ QUÁN': user.hometown || '—',
      CCCD: user.cccd || '—',
      'MÃ BHXH': user.bhxh_code || '—',
      'NGÂN HÀNG': user.bank_name || '—',
      STK: user.bank_account || '—',
      'BIỂN SỐ XE': user.license_plate || user.vehicle_info || '—',
    });
  }

  return row;
});

const WEEKDAY_NAMES_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const styleWorksheet = (worksheet, { frozenColumns = 0, totalRowNumber = null, isTimesheet = false, month = null, year = null, daysInMonth = 0 } = {}) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: frozenColumns }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };

  const headerRow = worksheet.getRow(1);
  headerRow.height = isTimesheet ? 34 : 28;
  headerRow.eachCell((cell, colIndex) => {
    let headerBg = 'FF1E293B'; // Executive Dark Slate
    let headerFg = 'FFFFFFFF';

    if (isTimesheet && colIndex >= 15 && month && year) {
      const dayNum = colIndex - 14;
      const dObj = new Date(year, month - 1, dayNum);
      const dayOfWeek = dObj.getDay();
      if (dayOfWeek === 0) { // Chủ nhật
        headerBg = 'FF991B1B'; // Deep Red
      } else if (dayOfWeek === 6) { // Thứ 7
        headerBg = 'FF334155'; // Medium Slate
        headerFg = 'FFE2E8F0';
      }
    }

    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: headerFg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  // Tô màu và định dạng từng dòng dữ liệu
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || (totalRowNumber && rowNumber >= totalRowNumber)) return;
    row.height = 23;
    const isEven = rowNumber % 2 === 0;

    row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
      let cellBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
      let fontColor = 'FF0F172A';
      let isBold = false;
      let alignH = 'left';

      const val = cell.value;
      const valStr = typeof val === 'string' ? val.trim() : '';

      if (isTimesheet) {
        if (colIndex === 1) {
          alignH = 'center';
          fontColor = 'FF2563EB';
          isBold = true;
        } else if (colIndex === 2) {
          alignH = 'left';
          isBold = true;
        } else if (colIndex === 3) {
          alignH = 'center';
          fontColor = 'FF475569';
        } else if (colIndex >= 4 && colIndex <= 14) {
          alignH = 'right';
          if (typeof val === 'number') {
            cell.numFmt = colIndex === 12 || colIndex === 13 ? '#,##0' : '#,##0.00';
            if (val > 0) isBold = true;
          }
        } else if (colIndex >= 15) {
          alignH = 'center';
          const dayNum = colIndex - 14;
          const dObj = (month && year) ? new Date(year, month - 1, dayNum) : null;
          const isSun = dObj && dObj.getDay() === 0;

          if (valStr === 'x') {
            cellBg = 'FFECFDF5';
            fontColor = 'FF047857';
            isBold = true;
          } else if (valStr === '0,75x' || valStr === '0,5x') {
            cellBg = 'FFFEF3C7';
            fontColor = 'FFB45309';
            isBold = true;
          } else if (['1,5x', '1,75x', '2x', '3x'].includes(valStr)) {
            cellBg = 'FFFFEDD5';
            fontColor = 'FFC2410C';
            isBold = true;
          } else if (valStr === 'CT1' || valStr === 'CT2') {
            cellBg = 'FFEFF6FF';
            fontColor = 'FF1D4ED8';
            isBold = true;
          } else if (valStr === 'WFH') {
            cellBg = 'FFECFEFF';
            fontColor = 'FF0E7490';
            isBold = true;
          } else if (valStr === 'P') {
            cellBg = 'FFF5F3FF';
            fontColor = 'FF6D28D9';
            isBold = true;
          } else if (valStr === 'L') {
            cellBg = 'FFFFF1F2';
            fontColor = 'FFBE123C';
            isBold = true;
          } else if (valStr === 'O') {
            cellBg = 'FFFFE4E6';
            fontColor = 'FFE11D48';
            isBold = true;
          } else if (valStr === 'KL' || valStr === 'K') {
            cellBg = 'FFF1F5F9';
            fontColor = 'FF64748B';
          } else if (!valStr && isSun) {
            cellBg = 'FFFEF2F2';
          }
        }
      }

      cell.font = { name: 'Arial', size: 9.5, bold: isBold, color: { argb: fontColor } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellBg } };
      cell.alignment = { horizontal: alignH, vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Hàng TỔNG CỘNG kế toán (GAAP Double-Underline)
  if (totalRowNumber) {
    const totalRow = worksheet.getRow(totalRowNumber);
    totalRow.height = 27;

    totalRow.eachCell({ includeEmpty: true }, (cell, colIndex) => {
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (isTimesheet) {
        if (colIndex >= 4 && colIndex <= 14) {
          const colLetter = worksheet.getColumn(colIndex).letter;
          const cachedVal = cell.value;
          cell.value = {
            formula: `SUM(${colLetter}2:${colLetter}${totalRowNumber - 1})`,
            result: Number(cachedVal) || 0,
          };
          cell.numFmt = colIndex === 12 || colIndex === 13 ? '#,##0' : '#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colIndex >= 15) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    });

    // Thêm khối chữ ký 3 bên ở cuối bảng
    if (isTimesheet) {
      const sigTitleRowIdx = totalRowNumber + 3;
      const sigTitleRow = worksheet.getRow(sigTitleRowIdx);
      sigTitleRow.height = 24;

      sigTitleRow.getCell(2).value = 'NGƯỜI LẬP BIỂU';
      sigTitleRow.getCell(2).font = { name: 'Arial', bold: true, size: 10.5, color: { argb: 'FF1E293B' } };
      sigTitleRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

      sigTitleRow.getCell(6).value = 'KẾ TOÁN TRƯỞNG';
      sigTitleRow.getCell(6).font = { name: 'Arial', bold: true, size: 10.5, color: { argb: 'FF1E293B' } };
      sigTitleRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      sigTitleRow.getCell(12).value = 'BAN GIÁM ĐỐC';
      sigTitleRow.getCell(12).font = { name: 'Arial', bold: true, size: 10.5, color: { argb: 'FF1E293B' } };
      sigTitleRow.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };

      const sigNoteRowIdx = totalRowNumber + 4;
      const sigNoteRow = worksheet.getRow(sigNoteRowIdx);
      sigNoteRow.height = 18;

      sigNoteRow.getCell(2).value = '(Ký, ghi rõ họ tên)';
      sigNoteRow.getCell(2).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF64748B' } };
      sigNoteRow.getCell(2).alignment = { horizontal: 'center', vertical: 'top' };

      sigNoteRow.getCell(6).value = '(Ký, ghi rõ họ tên)';
      sigNoteRow.getCell(6).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF64748B' } };
      sigNoteRow.getCell(6).alignment = { horizontal: 'center', vertical: 'top' };

      sigNoteRow.getCell(12).value = '(Ký, đóng dấu)';
      sigNoteRow.getCell(12).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF64748B' } };
      sigNoteRow.getCell(12).alignment = { horizontal: 'center', vertical: 'top' };
    }
  }
};

const buildAttendanceWorkbook = ({ users, attendances, month, year, includeSensitive = false }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ET Office Portal';
  workbook.company = 'Kiến trúc ET';
  workbook.created = new Date();

  const { rows: summaryRows, daysInMonth } = createSummaryRows({ users, attendances, month, year });
  const summarySheet = workbook.addWorksheet('Chấm Công ET_Staff', {
    properties: { defaultRowHeight: 22 },
  });

  const summaryColumns = [
    { header: 'ID', key: 'ID', width: 12 },
    { header: 'NHÂN SỰ', key: 'NHÂN SỰ', width: 25 },
    { header: 'CHỨC VỤ', key: 'CHỨC VỤ', width: 16 },
    { header: 'NLV tại VP', key: 'NLV tại VP', width: 13 },
    { header: 'CT Trong nước', key: 'CT Trong nước', width: 15 },
    { header: 'CT Nước ngoài', key: 'CT Nước ngoài', width: 15 },
    { header: 'Work from home', key: 'Work from home', width: 16 },
    { header: 'Nghỉ phép', key: 'Nghỉ phép', width: 12 },
    { header: 'Nghỉ ốm', key: 'Nghỉ ốm', width: 11 },
    { header: 'Nghỉ không lương', key: 'Nghỉ không lương', width: 16 },
    { header: 'Khác', key: 'Khác', width: 10 },
    { header: 'Muộn (lượt)', key: 'Muộn (lượt)', width: 12 },
    { header: 'Sớm (lượt)', key: 'Sớm (lượt)', width: 12 },
    { header: 'Tổng giờ OT', key: 'Tổng giờ OT', width: 13 },
  ];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = String(day).padStart(2, '0');
    const dObj = new Date(year, month - 1, day);
    const wd = WEEKDAY_NAMES_VI[dObj.getDay()];
    summaryColumns.push({ header: `${key}\n${wd}`, key, width: 6.5 });
  }
  summarySheet.columns = summaryColumns;
  summarySheet.addRows(summaryRows);
  styleWorksheet(summarySheet, {
    frozenColumns: 3,
    totalRowNumber: summaryRows.length + 1,
    isTimesheet: true,
    month,
    year,
    daysInMonth,
  });

  const directoryRows = buildDirectoryRows(users, includeSensitive);
  const directorySheet = workbook.addWorksheet(includeSensitive ? 'Thông Tin Nhân Sự' : 'Danh Bạ Nhóm');
  const directoryKeys = directoryRows[0]
    ? Object.keys(directoryRows[0])
    : ['STT', 'ID', 'HỌ TÊN', 'CHỨC VỤ', 'PHÒNG BAN', 'TRẠNG THÁI', 'SĐT', 'EMAIL'];
  const directoryWidths = {
    STT: 7,
    ID: 12,
    'HỌ TÊN': 24,
    'CHỨC VỤ': 20,
    'PHÒNG BAN': 22,
    'TRẠNG THÁI': 18,
    'SĐT': 15,
    EMAIL: 28,
    'NGÀY SINH': 13,
    'QUÊ QUÁN': 22,
    CCCD: 18,
    'MÃ BHXH': 18,
    'NGÂN HÀNG': 18,
    STK: 20,
    'BIỂN SỐ XE': 22,
  };
  directorySheet.columns = directoryKeys.map(key => ({ header: key, key, width: directoryWidths[key] || 16 }));
  directorySheet.addRows(directoryRows);
  styleWorksheet(directorySheet, { frozenColumns: 2 });

  return workbook;
};

// GET /api/export/excel?month=7&year=2026&department_id=...&user_id=...
const exportAttendanceExcel = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Tháng hoặc năm xuất báo cáo không hợp lệ.' });
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const departmentId = req.query.department_id;
    const userId = req.query.user_id;
    const includeSensitive = req.user.role === 'admin';

    const baseFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] },
    };
    const departmentFilter = departmentId && departmentId !== 'all'
      ? {
          $or: [
            { department_ids: departmentId },
            { department_id: departmentId },
          ],
        }
      : {};
    const requestedUserFilter = userId && userId !== 'all' ? { _id: userId } : {};
    const userFilter = combineUserFilters(
      baseFilter,
      isLeaderRole(req.user) ? buildLeaderUserScope(req.user, { includeSelf: true }) : {},
      departmentFilter,
      requestedUserFilter
    );

    const safeFields = 'employee_code full_name position role email phone department_id department_ids employment_status vehicle_info license_plate';
    const sensitiveFields = ' bhxh_code dob hometown cccd bank_name bank_account';
    const users = await User.find(userFilter)
      .select(safeFields + (includeSensitive ? sensitiveFields : ''))
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .sort({ employee_code: 1, full_name: 1 });

    const userIds = users.map(user => user._id);
    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: { $regex: `^${monthStr}` },
    }).sort({ date: 1 });

    const workbook = buildAttendanceWorkbook({
      users,
      attendances,
      month,
      year,
      includeSensitive,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `ET_Staff_ChamCong_${monthStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('ExportExcel error:', error);
    return res.status(500).json({ error: 'Lỗi xuất file Excel.' });
  }
};

// GET /api/export/expenses — Xuất file Excel Chi Tiêu & Hoàn Ứng chuẩn GAAP với 2 sheet
const exportExpensesExcel = async (req, res) => {
  try {
    const { user_id, approval_status, payment_status, has_vat, month, year, search } = req.query;
    const filter = {};

    if (user_id && user_id !== 'all') filter.user_id = user_id;
    if (approval_status && approval_status !== 'all') filter.approval_status = approval_status;
    if (payment_status && payment_status !== 'all') filter.payment_status = payment_status;
    if (has_vat !== undefined && has_vat !== 'all') filter.has_vat_invoice = has_vat === 'true' || has_vat === true;

    if (month && month !== 'all') {
      const targetYear = year || new Date().getFullYear();
      const monthStr = String(month).padStart(2, '0');
      filter.date = { $regex: `^${targetYear}-${monthStr}` };
    } else if (year && year !== 'all') {
      filter.date = { $regex: `^${year}-` };
    }

    if (search && search.trim()) {
      filter.description = { $regex: search.trim(), $options: 'i' };
    }

    const expenses = await Expense.find(filter)
      .populate('user_id', 'full_name employee_code bank_name bank_account branch department_name')
      .populate('advanced_by', 'full_name employee_code bank_name bank_account branch department_name')
      .sort({ date: -1, created_at: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ET Office Portal';
    workbook.company = 'CÔNG TY TNHH THIẾT KẾ KIẾN TRÚC ET';
    workbook.created = new Date();

    // Sheet 1: Danh Sách Chi Tiêu Chi Tiết
    const sheet1 = workbook.addWorksheet('Chi Tiết Chi Tiêu', {
      properties: { defaultRowHeight: 22 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
    });

    // Tiêu đề lớn
    sheet1.mergeCells('A1:L1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = 'BẢNG KÊ CHI TIÊU & HOÀN ỨNG CÔNG TY ET';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(1).height = 32;

    sheet1.mergeCells('A2:L2');
    const subCell = sheet1.getCell('A2');
    subCell.value = `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} · Tổng số: ${expenses.length} khoản chi`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(2).height = 20;

    const headers = [
      { header: 'STT', key: 'stt', width: 7 },
      { header: 'NGÀY CHI', key: 'date', width: 14 },
      { header: 'MÔ TẢ KHOẢN CHI', key: 'description', width: 34 },
      { header: 'NGƯỜI CHI THỰC TẾ', key: 'spender', width: 24 },
      { header: 'NGƯỜI ỨNG THAY', key: 'advancer', width: 24 },
      { header: 'SỐ TIỀN (VNĐ)', key: 'amount', width: 18 },
      { header: 'DUYỆT CHI', key: 'approval', width: 14 },
      { header: 'HOÀN ỨNG', key: 'payment', width: 14 },
      { header: 'HÓA ĐƠN', key: 'vat', width: 12 },
      { header: 'NGÂN HÀNG', key: 'bank_name', width: 18 },
      { header: 'SỐ TÀI KHOẢN', key: 'bank_account', width: 24 },
      { header: 'GHI CHÚ', key: 'notes', width: 28 },
    ];

    sheet1.getRow(3).values = headers.map(h => h.header);
    sheet1.getRow(3).height = 28;
    sheet1.getRow(3).eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    headers.forEach((col, idx) => {
      sheet1.getColumn(idx + 1).width = col.width;
    });

    let totalAmount = 0;
    expenses.forEach((exp, idx) => {
      const spenderName = exp.user_id?.full_name || 'Nhân viên';
      const advancerName = exp.advanced_by?.full_name || '—';
      const beneficiary = exp.advanced_by || exp.user_id || {};
      const approvalVi = exp.approval_status === 'approved' ? 'Đã duyệt' : exp.approval_status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
      const paymentVi = exp.payment_status === 'paid' ? 'Đã hoàn' : 'Chưa hoàn';
      const vatVi = exp.has_vat_invoice ? 'Có VAT' : 'Không';
      const numAmount = Number(exp.amount) || 0;
      totalAmount += numAmount;

      const row = sheet1.addRow([
        idx + 1,
        exp.date || '—',
        exp.description || '—',
        spenderName,
        advancerName,
        numAmount,
        approvalVi,
        paymentVi,
        vatVi,
        beneficiary.bank_name || '—',
        beneficiary.bank_account ? String(beneficiary.bank_account).trim() : '—',
        exp.notes || '—'
      ]);

      const isEven = idx % 2 === 0;
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colIdx === 1 || colIdx === 2 || colIdx === 9) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colIdx === 3) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Arial', size: 9.5, bold: true };
        } else if (colIdx === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        } else if (colIdx === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (exp.approval_status === 'approved') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
          } else if (exp.approval_status === 'pending') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
          }
        } else if (colIdx === 8) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (exp.payment_status === 'paid') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
          }
        } else if (colIdx === 11) {
          cell.numFmt = '@';
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Dòng TỔNG CỘNG
    const totalRow = sheet1.addRow([
      '', '', 'TỔNG CỘNG KHOẢN CHI', '', '', totalAmount, '', '', '', '', '', ''
    ]);
    totalRow.height = 28;
    sheet1.mergeCells(`A${expenses.length + 4}:B${expenses.length + 4}`);
    totalRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colIdx === 3) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colIdx === 6) {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFDC2626' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      }
    });

    // Sheet 2: Bảng Quyết Toán Gom Theo Người Thụ Hưởng
    const sheet2 = workbook.addWorksheet('Quyết Toán Theo Người', {
      properties: { defaultRowHeight: 24 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
    });

    sheet2.mergeCells('A1:F1');
    const title2 = sheet2.getCell('A1');
    title2.value = 'DANH SÁCH QUYẾT TOÁN HOÀN ỨNG THEO NHÂN SỰ';
    title2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet2.getRow(1).height = 30;

    const headers2 = [
      { header: 'STT', width: 7 },
      { header: 'NGƯỜI THỤ HƯỞNG', width: 26 },
      { header: 'SỐ KHOẢN CHI GỘP', width: 18 },
      { header: 'TỔNG TIỀN CẦN TRẢ (VNĐ)', width: 26 },
      { header: 'NGÂN HÀNG', width: 20 },
      { header: 'SỐ TÀI KHOẢN NHẬN TIỀN', width: 25 },
    ];
    sheet2.getRow(2).values = headers2.map(h => h.header);
    sheet2.getRow(2).height = 26;
    sheet2.getRow(2).eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headers2.forEach((h, idx) => { sheet2.getColumn(idx + 1).width = h.width; });

    // Gom nhóm theo người thụ hưởng
    const beneficiaryMap = new Map();
    expenses.forEach(exp => {
      const benUser = exp.advanced_by || exp.user_id;
      const bId = String(benUser?._id || 'unknown');
      if (!beneficiaryMap.has(bId)) {
        beneficiaryMap.set(bId, {
          user: benUser,
          total: 0,
          count: 0,
        });
      }
      const b = beneficiaryMap.get(bId);
      b.total += Number(exp.amount) || 0;
      b.count += 1;
    });

    const sortedBeneficiaries = Array.from(beneficiaryMap.values()).sort((a, b) => b.total - a.total);
    sortedBeneficiaries.forEach((item, idx) => {
      const u = item.user || {};
      const row = sheet2.addRow([
        idx + 1,
        u.full_name || 'Nhân viên',
        `${item.count} khoản`,
        item.total,
        u.bank_name || '—',
        u.bank_account ? String(u.bank_account).trim() : '—'
      ]);
      row.height = 24;
      row.eachCell((cell, colIdx) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (colIdx === 1 || colIdx === 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colIdx === 4) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        } else if (colIdx === 6) {
          cell.numFmt = '@';
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2563EB' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Bang_Ke_Chi_Tieu_ET_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('ExportExpensesExcel error:', error);
    return res.status(500).json({ error: 'Lỗi xuất file Excel chi tiêu.' });
  }
};

module.exports = {
  exportAttendanceExcel,
  exportExpensesExcel,
  __test: {
    getTimesheetSymbol,
    buildAttendanceWorkbook,
  },
};
