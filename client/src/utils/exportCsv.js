// src/utils/exportCsv.js
// Xuất dữ liệu chấm công ra file CSV

export function exportAttendanceToCSV(staffList, dateStr) {
  if (!staffList?.length) return;

  const headers = ['Họ tên', 'Phòng ban', 'Trạng thái', 'Check-in', 'Check-out', 'Loại', 'Tổng giờ'];
  const rows = staffList.map(p => [
    p.full_name || '',
    p.department_name || '',
    p.today_status === 'checked_in' ? 'Đang làm' : p.today_status === 'checked_out' ? 'Đã về' : 'Vắng',
    p.check_in_time ? new Date(p.check_in_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
    p.check_out_time ? new Date(p.check_out_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
    p.check_in_type || '',
    p.total_hours || '',
  ]);

  const BOM = '\uFEFF';
  const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chamcong_${dateStr || new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
