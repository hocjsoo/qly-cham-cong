// src/utils/exportCsv.js
// Xuất dữ liệu chấm công ra file CSV (Bảo vệ chống CSV Formula Injection)

import { downloadBlob } from './downloadBlob.js';

/**
 * Chuẩn hóa và vô hiệu hóa các ký tự độc hại có thể kích hoạt công thức trong Excel/Google Sheets
 * (Formula Injection Prevention: =, +, -, @, \t, \r, \n)
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  let str = String(value);
  // Nếu chuỗi bắt đầu bằng các ký tự công thức nguy hiểm (kể cả sau khoảng trắng/tab/xuống dòng)
  if (/^[\s\t\r\n]*[=+\-@\t\r\n]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildAttendanceCSVContent(staffList, dateStr) {
  if (!staffList?.length) return '';

  const headers = ['STT', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Giờ vào', 'Loại', 'Giờ ra', 'Tổng giờ', 'Trạng thái'];
  const rows = staffList.map((s, idx) => [
    idx + 1,
    s.employee_code || '',
    sanitizeCsvCell(s.full_name || ''),
    sanitizeCsvCell(s.department_name || ''),
    s.check_in_time ? (typeof s.check_in_time === 'string' && s.check_in_time.length >= 16 ? s.check_in_time.slice(11, 16) : new Date(s.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })) : '—',
    s.check_in_type || '—',
    s.check_out_time ? (typeof s.check_out_time === 'string' && s.check_out_time.length >= 16 ? s.check_out_time.slice(11, 16) : new Date(s.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })) : '—',
    s.total_hours ? `${s.total_hours}h` : '0h',
    s.status === 'present' ? 'Có mặt' : s.status === 'leave' ? 'Nghỉ phép' : s.today_status === 'checked_in' ? 'Đang làm' : s.today_status === 'checked_out' ? 'Đã về' : 'Vắng mặt',
  ]);

  const BOM = '\uFEFF';
  const csv = BOM + [
    ...(dateStr ? [`BÁO CÁO CHẤM CÔNG NGÀY ${dateStr}`, ''] : []),
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');

  return csv;
}

export function exportAttendanceToCSV(staffList, dateStr) {
  if (!staffList?.length) return;
  const csv = buildAttendanceCSVContent(staffList, dateStr);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `chamcong_${dateStr || new Date().toISOString().slice(0, 10)}.csv`);
}
