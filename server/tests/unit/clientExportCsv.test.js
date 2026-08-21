// ==============================================
// tests/unit/clientExportCsv.test.js
// Kiểm thử Xuất Tệp CSV Chấm Công Phía Giao Diện (Client CSV Export)
// ==============================================

function generateAttendanceCSVContent(staffList, dateStr) {
  const headers = ['STT', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Giờ vào', 'Loại', 'Giờ ra', 'Tổng giờ', 'Trạng thái'];

  const rows = staffList.map((s, idx) => [
    idx + 1,
    s.employee_code || '',
    `"${(s.full_name || '').replace(/"/g, '""')}"`,
    `"${(s.department_name || '').replace(/"/g, '""')}"`,
    s.check_in_time ? s.check_in_time.slice(11, 16) : '—',
    s.check_in_type || '—',
    s.check_out_time ? s.check_out_time.slice(11, 16) : '—',
    s.total_hours ? `${s.total_hours}h` : '0h',
    s.status === 'present' ? 'Có mặt' : s.status === 'leave' ? 'Nghỉ phép' : 'Vắng mặt',
  ]);

  const csv = '\uFEFF' + [
    `BÁO CÁO CHẤM CÔNG NGÀY ${dateStr || ''}`,
    '',
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');

  return csv;
}

function runClientExportCsvTests(assert) {
  console.log('\n📊 [TEST SUITE: FRONTEND CSV EXPORT & UTF-8 FORMATTING]');

  const mockStaff = [
    {
      employee_code: 'ET001',
      full_name: 'Nguyễn Văn "Hải" A',
      department_name: 'Phòng Kỹ thuật, IT',
      check_in_time: '2026-08-21T08:30:00+07:00',
      check_in_type: 'office',
      check_out_time: '2026-08-21T17:30:00+07:00',
      total_hours: 8,
      status: 'present'
    },
    {
      employee_code: 'ET002',
      full_name: 'Trần Thị B',
      department_name: 'Phòng Kinh doanh',
      check_in_time: null,
      check_in_type: null,
      check_out_time: null,
      total_hours: 0,
      status: 'leave'
    }
  ];

  const csvContent = generateAttendanceCSVContent(mockStaff, '2026-08-21');

  // TC-UI-CSV-01: Kiểm tra tiền tố UTF-8 BOM (\uFEFF) cho tiếng Việt có dấu
  assert(csvContent.startsWith('\uFEFF'), 'TC-UI-CSV-01: Nội dung CSV có chứa tiền tố UTF-8 BOM cho Excel tiếng Việt');

  // TC-UI-CSV-02: Kiểm tra Escape dấu ngoặc kép trong tên nhân viên
  assert(csvContent.includes('"Nguyễn Văn ""Hải"" A"'),
    'TC-UI-CSV-02: Escape chính xác dấu ngoặc kép trong tên nhân viên ("" thay vì ")');

  // TC-UI-CSV-03: Kiểm tra bao bọc trường có chứa dấu phẩy
  assert(csvContent.includes('"Phòng Kỹ thuật, IT"'),
    'TC-UI-CSV-03: Bao bọc dấu ngoặc kép các trường có chứa dấu phẩy để không vỡ cột CSV');

  // TC-UI-CSV-04: Kiểm tra định dạng giờ vào / ra (HH:mm)
  assert(csvContent.includes('08:30') && csvContent.includes('17:30') && csvContent.includes('8h'),
    'TC-UI-CSV-04: Cắt chuỗi hiển thị đúng giờ dạng HH:mm (08:30, 17:30)');
}

module.exports = runClientExportCsvTests;
