// ==============================================
// tests/unit/clientExportCsv.test.js
// Kiểm thử Xuất Tệp CSV Chấm Công Phía Giao Diện (Client CSV Export)
// Hàm sanitizeCsvCell được import TRỰC TIẾP từ mã nguồn sản xuất:
//   client/src/utils/exportCsv.js
// → Mọi regression trong hàm production đều sẽ được phát hiện ngay
// ==============================================

async function runClientExportCsvTests(assert) {
  console.log('\n📊 [TEST SUITE: FRONTEND CSV EXPORT & UTF-8 FORMATTING]');

  // Import TRỰC TIẾP hàm production buildAttendanceCSVContent & sanitizeCsvCell (không tự định nghĩa lại bất kỳ hàm nào)
  const { buildAttendanceCSVContent, sanitizeCsvCell } = await import('../../../client/src/utils/exportCsv.js');

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
    },
    {
      employee_code: 'ET003',
      full_name: '=HYPERLINK("http://evil.com","Click")',
      department_name: '+Phòng Dự án @Hà Nội',
      check_in_time: null,
      check_in_type: null,
      check_out_time: null,
      total_hours: 0,
      status: 'leave'
    }
  ];

  // Gọi trực tiếp hàm sản xuất buildAttendanceCSVContent
  const csvContent = buildAttendanceCSVContent(mockStaff, '2026-08-21');


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

  // TC-UI-CSV-05: Kiểm tra triệt tiêu CSV Formula Injection qua hàm PRODUCTION (=, +, @)
  assert(csvContent.includes('"\'=HYPERLINK(""http://evil.com"",""Click"")"'),
    'TC-UI-CSV-05a: Vô hiệu hóa tiền tố = bằng dấu nháy đơn \' (gọi thật exportCsv.js)');
  assert(csvContent.includes('"\'+ Phòng Dự án @Hà Nội"'.replace('+ ', '+')) || csvContent.includes('"\'+Phòng Dự án @Hà Nội"'),
    'TC-UI-CSV-05b: Vô hiệu hóa tiền tố + bằng dấu nháy đơn \' (gọi thật exportCsv.js)');
}

module.exports = runClientExportCsvTests;
