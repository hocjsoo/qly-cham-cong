// controllers/exportController.js — Excel export engine (Chuẩn mẫu ET_Staff 2026)
const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
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
      else if (symbol === '1,5x' || symbol === '2x' || symbol === '3x') {
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

const styleWorksheet = (worksheet, { frozenColumns = 0, totalRowNumber = null } = {}) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: frozenColumns }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell(cell => {
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFD1D5DB' } },
        left: { style: 'hair', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } },
        right: { style: 'hair', color: { argb: 'FFD1D5DB' } },
      };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  if (totalRowNumber) {
    const totalRow = worksheet.getRow(totalRowNumber);
    totalRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF111827' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });
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
    { header: 'NHÂN SỰ', key: 'NHÂN SỰ', width: 24 },
    { header: 'CHỨC VỤ', key: 'CHỨC VỤ', width: 18 },
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
    { header: 'Tổng giờ OT', key: 'Tổng giờ OT', width: 12 },
  ];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = String(day).padStart(2, '0');
    summaryColumns.push({ header: key, key, width: 6 });
  }
  summarySheet.columns = summaryColumns;
  summarySheet.addRows(summaryRows);
  styleWorksheet(summarySheet, { frozenColumns: 3, totalRowNumber: summaryRows.length + 1 });
  for (let columnIndex = 15; columnIndex <= summarySheet.columnCount; columnIndex++) {
    summarySheet.getColumn(columnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
  }

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

module.exports = {
  exportAttendanceExcel,
  __test: {
    getTimesheetSymbol,
    buildAttendanceWorkbook,
  },
};
