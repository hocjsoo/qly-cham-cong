const http = require('node:http');

const PORT = Number(process.env.DOCS_MOCK_PORT || 5000);
const TODAY = '2026-08-29';

const users = [
  {
    _id: 'user-admin', id: 'user-admin', employee_code: 'ET001',
    full_name: 'Nguyễn Danh Học', email: 'admin@etoffice.vn', phone: '0901 234 567',
    role: 'admin', position: 'Phó Giám đốc', employee_type: 'NS', department_name: 'Ban Giám Đốc',
    department_id: { _id: 'dept-bgd', name: 'Ban Giám Đốc' }, is_active: true,
    bank_name: 'Vietcombank', bank_account: '0011001234567', bank_holder: 'NGUYEN DANH HOC',
    license_plate: '29E1-888.88', vehicle_type: 'Honda SH', vehicle_color: 'Xám',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
  },
  {
    _id: 'user-leader', id: 'user-leader', employee_code: 'ET012',
    full_name: 'Trần Minh Anh', email: 'minhanh@etoffice.vn', phone: '0912 345 678',
    role: 'leader', position: 'Trưởng nhóm Kiến trúc', employee_type: 'NS', department_name: 'Kiến trúc',
    department_id: { _id: 'dept-kt', name: 'Kiến trúc' }, is_active: true,
    license_plate: '29B1-123.45', vehicle_type: 'Yamaha Grande', vehicle_color: 'Trắng',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
  },
  {
    _id: 'user-staff', id: 'user-staff', employee_code: 'ET024',
    full_name: 'Lê Hoàng Nam', email: 'hoangnam@etoffice.vn', phone: '0988 112 233',
    role: 'employee', position: 'Kiến trúc sư', employee_type: 'NS', department_name: 'Kiến trúc',
    department_id: { _id: 'dept-kt', name: 'Kiến trúc' }, is_active: true,
    bank_name: 'Techcombank', bank_account: '19036789012345', bank_holder: 'LE HOANG NAM',
    license_plate: '29X1-678.90', vehicle_type: 'Honda Lead', vehicle_color: 'Đen',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
  },
  {
    _id: 'user-designer', id: 'user-designer', employee_code: 'ET031',
    full_name: 'Nguyễn Thu Hà', email: 'thuha@etoffice.vn', phone: '0966 778 899',
    role: 'employee', position: 'Thiết kế Nội thất', employee_type: 'NS', department_name: 'Nội thất',
    department_id: { _id: 'dept-nt', name: 'Nội thất' }, is_active: true,
    license_plate: '30M1-246.80', vehicle_type: 'VinFast Feliz', vehicle_color: 'Xanh',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
  },
  {
    _id: 'tts-01', id: 'tts-01', employee_code: 'TTS08',
    full_name: 'Phạm Khánh Linh', email: 'khanhlinh@etoffice.vn', phone: '0333 246 810',
    role: 'employee', position: 'Thực tập sinh Kiến trúc', employee_type: 'TTS', department_name: 'Kiến trúc',
    department_id: { _id: 'dept-kt', name: 'Kiến trúc' }, is_active: true,
    can_manage_tts_schedule: false, is_duty_exempt: false,
  },
  {
    _id: 'tts-02', id: 'tts-02', employee_code: 'TTS11',
    full_name: 'Đỗ Quốc Bảo', email: 'quocbao@etoffice.vn', phone: '0355 111 222',
    role: 'employee', position: 'Thực tập sinh Nội thất', employee_type: 'TTS', department_name: 'Nội thất',
    department_id: { _id: 'dept-nt', name: 'Nội thất' }, is_active: true,
    can_manage_tts_schedule: false, is_duty_exempt: false,
  },
];

const departments = [
  { _id: 'dept-bgd', id: 'dept-bgd', name: 'Ban Giám Đốc' },
  { _id: 'dept-kt', id: 'dept-kt', name: 'Kiến trúc' },
  { _id: 'dept-nt', id: 'dept-nt', name: 'Nội thất' },
];

const projects = [
  {
    _id: 'project-01', id: 'project-01', code: '26.018', name: 'Penthouse Ecopark Grand',
    sub_project: 'Thiết kế Kiến trúc & Nội thất', category: 'Kiến trúc&Nội thất',
    client_name: 'Gia đình Anh Minh', pm_id: users[1], pm_name: users[1].full_name,
    address: 'Ecopark, Hưng Yên', status: 'Đang tiến hành', start_date: '2026-05-12',
    deadline: '2026-09-20', progress: 78, members: [users[1], users[2], users[3]],
    note: 'Đang triển khai hồ sơ kỹ thuật thi công.', is_active: true,
  },
  {
    _id: 'project-02', id: 'project-02', code: '26.021', name: 'Sapa Eco Retreat',
    sub_project: 'Quy hoạch khu nghỉ dưỡng sinh thái', category: 'Quy hoạch&Kiến trúc',
    client_name: 'Sapa Eco Group', pm_id: users[0], pm_name: users[0].full_name,
    address: 'Sa Pa, Lào Cai', status: 'Đang tiến hành', start_date: '2026-06-03',
    deadline: '2026-11-30', progress: 46, members: [users[0], users[1], users[2]],
    note: 'Đã chốt phương án concept tổng mặt bằng.', is_active: true,
  },
  {
    _id: 'project-03', id: 'project-03', code: '26.009', name: 'Văn phòng Điều hành Bắc Hà',
    sub_project: 'Thiết kế & Thi công nội thất', category: 'Thiết kế&Thi công',
    client_name: 'Bắc Hà Holdings', pm_id: users[3], pm_name: users[3].full_name,
    address: 'Cầu Giấy, Hà Nội', status: 'Đã hoàn thành', start_date: '2026-02-10',
    deadline: '2026-07-25', progress: 100, members: [users[1], users[3]],
    note: 'Đã bàn giao và nghiệm thu.', is_active: true,
  },
];

const requests = [
  {
    _id: 'request-01', user_id: users[2], user_name: users[2].full_name,
    type: 'annual_leave', start_date: '2026-08-31', end_date: '2026-09-01',
    reason: 'Nghỉ phép thường niên cùng gia đình.', status: 'pending',
    created_at: '2026-08-29T01:30:00.000Z',
  },
  {
    _id: 'request-02', user_id: users[3], user_name: users[3].full_name,
    type: 'wfh', start_date: '2026-08-28', end_date: '2026-08-28',
    reason: 'Hoàn thiện hồ sơ phối cảnh 3D dự án Văn phòng Bắc Hà.', status: 'approved',
    reviewer_note: 'Đồng ý. Nộp bản vẽ trước 17:30.', created_at: '2026-08-27T03:00:00.000Z',
  },
  {
    _id: 'request-03', user_id: users[1], user_name: users[1].full_name,
    type: 'business_trip', start_date: '2026-08-29', end_date: '2026-08-29',
    project_id: projects[0], reason: 'Khảo sát hiện trạng và kiểm tra mẫu vật liệu tại công trình.',
    status: 'approved', reviewer_note: 'Đã duyệt, lưu ý gửi ảnh báo cáo cuối ngày.',
    created_at: '2026-08-28T02:15:00.000Z',
  },
  {
    _id: 'request-04', user_id: users[2], user_name: users[2].full_name,
    type: 'late', start_date: '2026-08-27', end_date: '2026-08-27', start_time: '08:48',
    reason: 'Tắc đường do mưa lớn trên tuyến Nguyễn Trãi.', status: 'rejected',
    reviewer_note: 'Vui lòng bổ sung minh chứng hoặc thông báo sớm hơn.',
    created_at: '2026-08-27T02:10:00.000Z',
  },
];

const expenses = [
  {
    _id: 'expense-01', date: '2026-08-28', description: 'Mua mẫu sơn và gạch lát cho dự án Penthouse Ecopark',
    notes: 'Có hóa đơn VAT điện tử.', amount: 1450000, user_id: users[2], user_name: users[2].full_name,
    approval_status: 'approved', payment_status: 'paid', has_vat_invoice: true,
  },
  {
    _id: 'expense-02', date: '2026-08-29', description: 'Tiếp khách hàng ký kết hợp đồng tư vấn thiết kế',
    notes: 'Chi phí phòng họp và đồ uống.', amount: 2200000, user_id: users[1], user_name: users[1].full_name,
    approval_status: 'pending', payment_status: 'unpaid', has_vat_invoice: true,
  },
  {
    _id: 'expense-03', date: '2026-08-26', description: 'Taxi khảo sát hiện trạng công trình Sapa Eco Retreat',
    notes: 'Di chuyển từ văn phòng đến ga và chiều về.', amount: 680000, user_id: users[0], user_name: users[0].full_name,
    approval_status: 'approved', payment_status: 'unpaid', has_vat_invoice: false,
  },
];

const attendanceRecords = [
  {
    _id: 'attendance-01', user_id: users[0], date: TODAY,
    check_in_time: '2026-08-29T01:22:00.000Z', check_out_time: null,
    check_in_type: 'office', total_hours: 0, work_units: 1, ot_hours: 0,
    is_late: false, late_minutes: 0, status: 'present',
  },
  {
    _id: 'attendance-02', user_id: users[0], date: '2026-08-28',
    check_in_time: '2026-08-28T01:24:00.000Z', check_out_time: '2026-08-28T11:18:00.000Z',
    check_in_type: 'office', total_hours: 9.9, work_units: 1, ot_hours: 0.8,
    is_late: false, late_minutes: 0, status: 'present',
  },
  {
    _id: 'attendance-03', user_id: users[0], date: '2026-08-27',
    check_in_time: '2026-08-27T01:38:00.000Z', check_out_time: '2026-08-27T10:35:00.000Z',
    check_in_type: 'office', total_hours: 8.9, work_units: 1, ot_hours: 0,
    is_late: true, late_minutes: 8, late_tier: 'late_minor', status: 'late',
  },
  {
    _id: 'attendance-04', user_id: users[0], date: '2026-08-26',
    check_in_time: '2026-08-26T01:18:00.000Z', check_out_time: '2026-08-26T10:32:00.000Z',
    check_in_type: 'site', total_hours: 9.2, work_units: 1, ot_hours: 0,
    is_late: false, late_minutes: 0, status: 'present', notes: '[CT1] Khảo sát công trình Sapa Eco Retreat',
  },
  {
    _id: 'attendance-05', user_id: users[0], date: '2026-08-25',
    check_in_time: '2026-08-25T01:25:00.000Z', check_out_time: '2026-08-25T10:30:00.000Z',
    check_in_type: 'wfh', total_hours: 9.1, work_units: 1, ot_hours: 0,
    is_late: false, late_minutes: 0, status: 'present', notes: '[WFH] Hoàn thiện tài liệu dự án',
  },
];

function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function createMatrix(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdayVN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const headerDays = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month - 1, day);
    return {
      day,
      dayStr: String(day).padStart(2, '0'),
      weekday: weekdayVN[date.getDay()],
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isSunday: date.getDay() === 0,
      isSaturday: date.getDay() === 6,
      isWeekend: date.getDay() === 0,
      isHoliday: false,
      holidayName: null,
    };
  });

  const patterns = [
    ['x', 'x', 'x', 'CT1', 'x', '', '', 'x', 'x', 'WFH', 'x', 'x', '', '', 'x', 'x', 'x', 'x', 'P', '', '', 'x', 'x', 'x', 'x', 'x', '', '', 'x', 'x', 'x'],
    ['x', 'x', '0,75x', 'x', 'x', '', '', 'x', 'x', 'x', 'x', 'CT1', '', '', 'x', 'x', 'x', 'WFH', 'x', '', '', 'x', 'x', 'x', 'x', 'x', '', '', 'x', 'x', ''],
    ['x', 'WFH', 'x', 'x', 'x', '', '', 'x', 'x', 'x', 'x', 'x', '', '', 'P', 'P', 'x', 'x', 'x', '', '', 'x', 'x', 'x', 'x', 'x', '', '', 'x', 'x', 'x'],
    ['x', 'x', 'x', 'x', '0,5x', '', '', 'x', 'x', 'CT1', 'x', 'x', '', '', 'x', 'x', 'x', 'x', 'x', '', '', 'x', 'x', 'WFH', 'x', 'x', '', '', 'x', 'x', 'x'],
  ];

  const staffRows = users.slice(0, 4).map((user, rowIndex) => {
    const days = headerDays.map((header, dayIndex) => {
      const symbol = header.isSunday ? '' : (patterns[rowIndex][dayIndex] || '');
      return {
        day: header.day, dateStr: header.dateStr, symbol,
        attendance_id: symbol ? `matrix-${rowIndex}-${header.day}` : null,
        check_in_time: symbol ? (symbol === '0,75x' ? '08:46' : '08:24') : null,
        check_out_time: symbol ? (symbol === '0,5x' ? '12:00' : '17:38') : null,
        total_hours: symbol === '0,5x' ? 4 : symbol === '0,75x' ? 6 : symbol ? 8 : 0,
        ot_hours: header.day % 9 === 0 && symbol ? 1.5 : 0,
        is_late: symbol === '0,75x', late_minutes: symbol === '0,75x' ? 16 : 0,
        is_early_leave: symbol === '0,5x', early_minutes: symbol === '0,5x' ? 330 : 0,
        status: symbol ? 'present' : 'none', notes: symbol ? `Ký hiệu: [${symbol}]` : '',
        check_in_type: symbol === 'CT1' ? 'site' : symbol === 'WFH' ? 'wfh' : 'office',
        is_modified: header.day === 3 && rowIndex === 1, audit_logs: [],
      };
    });
    const count = (symbol) => days.filter((item) => item.symbol === symbol).length;
    return {
      id: user._id, _id: user._id, code: user.employee_code, full_name: user.full_name,
      avatar_url: null, employee_type: user.employee_type, role_label: user.position,
      department_name: user.department_name, department_ids: [user.department_name],
      nlv_office: count('x') + count('0,75x') * 0.75 + count('0,5x') * 0.5,
      ct_domestic: count('CT1'), ct_foreign: 0, wfh: count('WFH'), annual_leave: count('P'),
      sick_leave: 0, unpaid_leave: 0, other_leave: 0,
      total_ot_hours: days.reduce((sum, item) => sum + item.ot_hours, 0),
      late_count: count('0,75x'), total_late_minutes: count('0,75x') * 16,
      early_count: count('0,5x'), total_early_minutes: count('0,5x') * 330,
      days, is_locked: rowIndex === 0, is_attendance_exempt: false,
      locked_info: rowIndex === 0 ? { locked_by_name: 'Nguyễn Danh Học', locked_at: '2026-08-29T07:00:00.000Z' } : null,
    };
  });

  return {
    month, year, days_in_month: daysInMonth,
    sunday_count: headerDays.filter((day) => day.isSunday).length,
    standard_working_days: daysInMonth - headerDays.filter((day) => day.isSunday).length,
    header_days: headerDays, staff_rows: staffRows, global_locked: false, global_lock_info: null,
  };
}

function getWeeklySchedule() {
  const allowedDates = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'];
  return {
    schedule: {
      week_start: '2026-08-24', week_end: '2026-08-29',
      registration_deadline: '2026-08-23T16:59:59.000Z', status: 'open',
      registrations: [
        { user_id: users[4], note: 'Thứ 5 xin về sớm để học chuyên ngành.', slots: allowedDates.map((date, index) => ({ date, morning: index !== 3, afternoon: index !== 5 })) },
        { user_id: users[5], note: 'Có mặt đầy đủ cả tuần.', slots: allowedDates.map((date) => ({ date, morning: true, afternoon: true })) },
      ],
      duties: allowedDates.map((date, index) => ({
        date,
        office_cleaning_user_ids: [index % 2 === 0 ? users[4] : users[5]],
        restroom_cleaning_user_ids: index === 5 ? [users[4], users[5]] : [],
      })),
      instructions: {
        before_work: 'Quét nhà, vệ sinh bàn chung và khu vực máy in.',
        during_day: 'Dọn đồ dùng sau khi sử dụng, đổ rác cuối ngày.',
        weekly: 'Tổng vệ sinh khu vực pantry và nhà vệ sinh vào chiều Thứ 7.',
      },
    },
    tts_users: users.slice(4), people: users, allowed_dates: allowedDates,
    is_registration_locked: false, can_manage: true, can_manage_duties: true,
  };
}

function getLeaderboard() {
  const rankings = [
    { rank: 1, ...users[1], displayValue: '100% đúng giờ', subText: '24/24 ngày · 2.5h OT', score: 100 },
    { rank: 2, ...users[3], displayValue: '98% đúng giờ', subText: '23/24 ngày · 1.5h OT', score: 98 },
    { rank: 3, ...users[2], displayValue: '96% đúng giờ', subText: '23/24 ngày · 3.0h OT', score: 96 },
    { rank: 4, ...users[0], displayValue: '95% đúng giờ', subText: '22/24 ngày · 4.5h OT', score: 95 },
    { rank: 5, ...users[4], displayValue: '92% đúng giờ', subText: '21/23 ngày · TTS', score: 92 },
  ];
  return { top3: rankings.slice(0, 3), rankings, myRank: rankings[3] };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/health') return json(res, { status: 'ok', mode: 'documentation-demo' });
  if (path === '/settings') return json(res, {
    company_name: 'Kiến trúc ET', company_logo_url: '/logo.png',
    company_address: 'Tòa 17T10 Nguyễn Thị Định, Thanh Xuân, Hà Nội',
    work_start_time: '08:30', work_end_time: '17:30',
    office_lat: 21.0067, office_lng: 105.8028, geofence_radius: 250, request_guidelines: {},
  });
  if (path === '/auth/me') return json(res, { user: users[0] });
  if (path === '/users') return json(res, users);
  if (path === '/departments') return json(res, departments);
  if (path === '/locations') return json(res, [{ _id: 'office-01', name: 'Văn phòng ET', lat: 21.0067, lng: 105.8028, radius: 250, is_active: true }]);
  if (path === '/projects') return json(res, projects);
  if (path === '/requests/my-requests') return json(res, requests.filter((item) => item.user_id._id === users[0]._id));
  if (path === '/requests/pending' || path === '/requests') return json(res, requests);
  if (path === '/expenses') return json(res, {
    expenses,
    summary: {
      totalApprovedAmount: 2130000, totalPendingAmount: 2200000, totalPendingCount: 1,
      totalUnpaidAmount: 680000, totalPaidAmount: 1450000,
      myTotalApproved: 680000, myTotalUnpaid: 680000, totalCount: expenses.length,
    },
  });
  if (path === '/attendance/today') return json(res, {
    date: TODAY, attendance: attendanceRecords[0], status: 'checked_in',
    office: { _id: 'office-01', name: 'Văn phòng ET', lat: 21.0067, lng: 105.8028, radius: 250, is_active: true },
    offices: [{ _id: 'office-01', name: 'Văn phòng ET', lat: 21.0067, lng: 105.8028, radius: 250, is_active: true }],
  });
  if (path === '/attendance/history') return json(res, {
    summary: { present_days: 4, late_days: 1, total_hours: 37.1, total_ot_hours: 0.8, total_days: 5 },
    records: attendanceRecords,
  });
  if (path === '/attendance/flagged') return json(res, {
    flagged: [{
      _id: 'flagged-01', user_id: users[2], date: TODAY,
      check_in_time: '2026-08-29T01:42:00.000Z', check_in_type: 'office',
      verification_status: 'pending', device_warning: 'Thiết bị mới chưa được xác thực',
      device_info: { platform: 'Android', browser: 'Chrome Mobile', is_trusted: false },
      notes: 'Phát hiện đăng nhập từ thiết bị mới.',
    }],
    counts: { pending: 1, device: 1, photo: 0, approved: 2, rejected: 0 },
  });
  if (path === '/dashboard/pending-count') return json(res, { pending_count: 3, request_count: 2, flagged_count: 1 });
  if (path === '/dashboard/today') return json(res, {
    date: TODAY,
    summary: { total: 6, checked_in: 4, checked_out: 1, absent: 1, present_total: 5, late: 1, on_time: 4 },
    staff: [
      { ...users[0], today_status: 'checked_in', check_in_time: '2026-08-29T01:22:00.000Z', check_in_type: 'office' },
      { ...users[1], today_status: 'checked_in', check_in_time: '2026-08-29T01:18:00.000Z', check_in_type: 'office' },
      { ...users[2], today_status: 'checked_in', check_in_time: '2026-08-29T01:42:00.000Z', check_in_type: 'office', is_late: true },
      { ...users[3], today_status: 'checked_out', check_in_time: '2026-08-29T01:25:00.000Z', check_out_time: '2026-08-29T09:45:00.000Z', check_in_type: 'wfh' },
      { ...users[4], today_status: 'checked_in', check_in_time: '2026-08-29T01:28:00.000Z', check_in_type: 'office' },
      { ...users[5], today_status: 'absent', check_in_time: null, check_in_type: null },
    ],
  });
  if (path === '/reports/trend') return json(res, { months: [
    { month: '03/2026', attendance_rate: 92 }, { month: '04/2026', attendance_rate: 94 },
    { month: '05/2026', attendance_rate: 96 }, { month: '06/2026', attendance_rate: 95 },
    { month: '07/2026', attendance_rate: 97 }, { month: '08/2026', attendance_rate: 98 },
  ] });
  if (path === '/reports/leaderboard') return json(res, getLeaderboard());
  if (path === '/timesheet-lock/full-matrix') return json(res, createMatrix(Number(url.searchParams.get('month') || 8), Number(url.searchParams.get('year') || 2026)));
  if (path === '/tts-schedules') return json(res, getWeeklySchedule());
  if (path === '/announcements/pinned') return json(res, [{
    _id: 'announcement-01', title: 'Hoàn thiện đối soát công tháng 8/2026',
    content: 'Mọi giải trình chấm công cần hoàn thành trước 17:30 ngày 31/08/2026.',
    priority: 'high', is_pinned: true, created_at: '2026-08-29T01:00:00.000Z',
  }]);
  if (path === '/announcements/birthdays') return json(res, { birthdays: [{ _id: users[3]._id, full_name: users[3].full_name, birthday: '1998-08-30' }] });
  if (path === '/announcements/anniversaries') return json(res, { anniversaries: [{ _id: users[1]._id, full_name: users[1].full_name, join_date: '2022-08-26', years: 4 }] });
  if (path === '/holidays') return json(res, []);
  if (path === '/notifications') return json(res, [{
    _id: 'notification-01', title: 'Đơn nghỉ phép mới',
    message: 'Lê Hoàng Nam vừa gửi đơn nghỉ phép năm.', is_read: false,
    created_at: '2026-08-29T01:30:00.000Z',
  }]);
  return json(res, { message: 'Documentation mock endpoint', path });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ET Office Portal documentation mock API: http://127.0.0.1:${PORT}/api/health`);
});

