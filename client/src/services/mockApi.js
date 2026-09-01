// src/services/mockApi.js
// Offline Mock DB Engine for testing ALL features 100% offline in browser (localStorage DB)

const INITIAL_MOCK_USERS = [
  {
    id: 'user-admin',
    _id: 'user-admin',
    email: 'admin@company.com',
    full_name: 'Quản trị viên (Phó GĐ)',
    phone: '0901234567',
    role: 'admin',
    department_name: 'Hành chính',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
    vehicle_info: 'Honda SH 29E1-888.88',
    license_plate: '29E1-888.88',
    is_active: true,
  },
  {
    id: 'user-manager',
    _id: 'user-manager',
    email: 'manager@etoffice.vn',
    full_name: 'Trần Văn Trưởng (Trưởng phòng)',
    phone: '0907654321',
    role: 'manager',
    department_name: 'Kiến trúc',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
    vehicle_info: 'Yamaha Grande 29B1-123.45',
    license_plate: '29B1-123.45',
    is_active: true,
  },
  {
    id: 'user-staff',
    _id: 'user-staff',
    email: 'staff@etoffice.vn',
    full_name: 'Lê Văn Nhân (KTS)',
    phone: '0912345678',
    role: 'staff',
    department_name: 'Kiến trúc',
    parking_location: 'Tòa 17T10 Nguyễn Thị Định',
    vehicle_info: 'Honda Lead 29X1-678.90',
    license_plate: '29X1-678.90',
    is_active: true,
  },
];

const INITIAL_MOCK_REQUESTS = [
  {
    id: 'req-1',
    _id: 'req-1',
    user_id: 'user-staff',
    requester_name: 'Lê Văn Nhân (KTS)',
    type: 'late',
    start_date: new Date().toISOString().split('T')[0],
    reason: 'Kẹt xe ngã tư Hàng Xanh 30 phút',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'req-2',
    _id: 'req-2',
    user_id: 'user-staff',
    requester_name: 'Lê Văn Nhân (KTS)',
    type: 'business_trip',
    start_date: new Date().toISOString().split('T')[0],
    reason: 'Khảo sát hiện trạng công trình biệt thự Q2',
    status: 'approved',
    reviewer_note: 'Đồng ý, nhớ chụp ảnh báo cáo',
    created_at: new Date().toISOString(),
  },
];

const INITIAL_MOCK_EXPENSES = [
  {
    _id: 'exp-1',
    id: 'exp-1',
    user_id: {
      _id: 'user-staff',
      full_name: 'Lê Văn Nhân (KTS)',
      employee_code: 'ET003',
      department_name: 'Kiến trúc',
      avatar_url: '/logo.png',
    },
    date: new Date().toISOString().split('T')[0],
    description: 'Mua văn phòng phẩm, giấy in A3 & bút dạ thiết kế',
    amount: 350000,
    has_vat_invoice: true,
    approval_status: 'approved',
    approved_by: { full_name: 'Quản trị viên (Phó GĐ)' },
    approved_at: new Date().toISOString(),
    payment_status: 'unpaid',
    notes: 'Chi hộ dự án Biệt thự Gamuda',
    created_at: new Date().toISOString(),
  },
  {
    _id: 'exp-2',
    id: 'exp-2',
    user_id: {
      _id: 'user-manager',
      full_name: 'Trần Văn Trưởng (Trưởng phòng)',
      employee_code: 'ET002',
      department_name: 'Kiến trúc',
      avatar_url: '/logo.png',
    },
    date: new Date().toISOString().split('T')[0],
    description: 'Tiền taxi tiếp khách khảo sát hiện trường công trình',
    amount: 180000,
    has_vat_invoice: false,
    approval_status: 'approved',
    approved_by: { full_name: 'Quản trị viên (Phó GĐ)' },
    approved_at: new Date().toISOString(),
    payment_status: 'paid',
    paid_by: { full_name: 'Quản trị viên (Phó GĐ)' },
    paid_at: new Date().toISOString(),
    payment_note: 'Đã hoàn tiền qua Techcombank',
    created_at: new Date().toISOString(),
  },
];

const HOLIDAY_WORK_MULTIPLIERS = [1.5, 2, 3];

function normalizeHolidayMultiplier(value) {
  const multiplier = Number(value);
  return HOLIDAY_WORK_MULTIPLIERS.includes(multiplier) ? multiplier : 1.5;
}

function getVnClockParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0),
    second: Number(values.second || 0),
  };
}

function getVnThreshold(dateStr, time, fallback = '18:30') {
  const normalizedTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || '').trim())
    ? String(time).trim()
    : fallback;
  return new Date(`${dateStr}T${normalizedTime}:00+07:00`);
}

function createMockHttpError(message, status = 400) {
  const error = new Error(message);
  error.response = { status, data: { error: message } };
  return error;
}

function getMockStorage(key, initialData) {
  const data = localStorage.getItem(`mock_${key}`);
  if (!data) {
    localStorage.setItem(`mock_${key}`, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(data);
}

function setMockStorage(key, data) {
  localStorage.setItem(`mock_${key}`, JSON.stringify(data));
}

// Mock API Call Handler
export async function mockRequest(method, url, data = {}) {
  await new Promise((r) => setTimeout(r, 200)); // Sim 200ms delay

  const users = getMockStorage('users', INITIAL_MOCK_USERS);
  const requests = getMockStorage('requests', INITIAL_MOCK_REQUESTS);
  const attendance = getMockStorage('attendance', []);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  // === AUTH ===
  if (url.includes('/auth/login')) {
    const email = data.email?.toLowerCase();
    let user = users.find((u) => u.email === email);
    if (!user) {
      user = {
        id: 'user-admin',
        _id: 'user-admin',
        email: email || 'admin@etoffice.vn',
        full_name: 'Quản trị viên (Offline Mode)',
        role: 'admin',
        department_name: 'Kiến trúc',
        is_active: true,
      };
    }
    return { data: { token: 'mock-jwt-token-12345', user } };
  }

  if (url.includes('/auth/me')) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];
    return { data: { user } };
  }

  // === ATTENDANCE TODAY ===
  if (url.includes('/attendance/today')) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];
    const rec = attendance.find((a) => a.user_id === (user._id || user.id) && a.date === todayStr);

    let status = 'not_checked_in';
    if (rec) {
      status = rec.check_out_time ? 'checked_out' : 'checked_in';
    }
    return { data: { date: todayStr, attendance: rec || null, status } };
  }

  // === CHECKIN ===
  if (url.includes('/attendance/checkin')) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];

    const now = new Date();
    const clock = getVnClockParts(now);
    const currentSeconds = (clock.hour * 3600) + (clock.minute * 60) + clock.second;
    const settings = getMockStorage('system_settings', {
      work_start_time: '09:00',
      work_end_time: '18:30',
      ot_start_time: '18:30',
    });
    const workStart = String(settings.work_start_time || '09:00').split(':').map(Number);
    const workStartSeconds = ((workStart[0] || 9) * 3600) + ((workStart[1] || 0) * 60);
    const isExemptFromLate = ['wfh', 'site', 'client'].includes(data.type || 'office');
    const isLate = !isExemptFromLate && currentSeconds > workStartSeconds;
    const isAfterWorkUnitCutoff = !isExemptFromLate && currentSeconds > ((9 * 3600) + (30 * 60));
    const holidays = getMockStorage('holidays', []);
    const activeHoliday = holidays.find(holiday => {
      const startDate = String(holiday.date || '');
      const endDate = String(holiday.end_date || holiday.date || '');
      return startDate <= todayStr && todayStr <= endDate;
    });

    const newRec = {
      id: `att-${Date.now()}`,
      _id: `att-${Date.now()}`,
      user_id: user._id || user.id,
      date: todayStr,
      check_in_time: now.toISOString(),
      check_in_lat: data.lat || 10.7769,
      check_in_lng: data.lng || 106.7009,
      check_in_type: data.type || 'office',
      check_in_note: data.note || '',
      is_late: isLate,
      late_minutes: isLate ? Math.max(0, Math.floor((currentSeconds - workStartSeconds) / 60)) : 0,
      status: isLate ? 'late' : 'present',
      work_units: activeHoliday ? normalizeHolidayMultiplier(activeHoliday.work_multiplier) : (isAfterWorkUnitCutoff ? 0.75 : 1),
      holiday_id: activeHoliday?._id || null,
    };

    const updated = [newRec, ...attendance.filter((a) => !(a.user_id === (user._id || user.id) && a.date === todayStr))];
    setMockStorage('attendance', updated);

    return { data: { message: `Check-in thành công! (Offline Mode)`, attendance: newRec, data: newRec, is_late: isLate } };
  }

  // === CHECKOUT ===
  if (url.includes('/attendance/checkout')) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];

    const rec = attendance.find((a) => a.user_id === (user._id || user.id) && a.date === todayStr);
    if (rec) {
      const checkOut = new Date();
      const checkIn = new Date(rec.check_in_time);
      const settings = getMockStorage('system_settings', {
        work_start_time: '09:00',
        work_end_time: '18:30',
        ot_start_time: '18:30',
      });
      const workEndThreshold = getVnThreshold(todayStr, settings.work_end_time, '18:30');
      const otThreshold = getVnThreshold(todayStr, settings.ot_start_time, '18:30');
      const totalHours = Number.isNaN(checkIn.getTime()) || checkOut <= checkIn
        ? 0
        : Number(((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(1));
      const otHours = checkOut <= otThreshold
        ? 0
        : Number(((checkOut.getTime() - Math.max(checkIn.getTime(), otThreshold.getTime())) / 3600000).toFixed(1));
      const isEarlyLeave = checkOut < workEndThreshold;

      rec.check_out_time = checkOut.toISOString();
      rec.total_hours = totalHours;
      rec.ot_hours = Math.max(0, otHours);
      rec.is_early_leave = isEarlyLeave;
      rec.early_minutes = isEarlyLeave
        ? Math.max(0, Math.ceil((workEndThreshold.getTime() - checkOut.getTime()) / 60000))
        : 0;
      setMockStorage('attendance', attendance);
      return { data: { message: 'Check-out thành công! (Offline Mode)', total_hours: totalHours, attendance: rec } };
    }
    throw createMockHttpError('Không tìm thấy dữ liệu check-in hôm nay.', 404);
  }

  // === HISTORY ===
  if (url.includes('/attendance/history')) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];
    const userAtt = attendance.filter((a) => a.user_id === (user._id || user.id));

    return {
      data: {
        month: data.month || '2026-07',
        stats: {
          total_days: userAtt.length || 1,
          present_days: userAtt.length || 1,
          late_days: 0,
          total_hours: (userAtt.length * 8).toFixed(1) || '8.0',
        },
        records: userAtt,
      },
    };
  }

  // === DASHBOARD ===
  if (url.includes('/dashboard/today')) {
    const staffSummary = users.map((u) => {
      const att = attendance.find((a) => String(a.user_id) === String(u._id || u.id) && a.date === todayStr);
      let today_status = 'absent';
      if (att) {
        if (att.check_in_time) {
          today_status = att.check_out_time ? 'checked_out' : 'checked_in';
        } else if (att.status === 'leave' || att.status === 'holiday') {
          today_status = att.status;
        } else if (att.status === 'present' && ((att.work_units ?? 0) > 0 || (att.total_hours ?? 0) > 0)) {
          today_status = 'checked_in';
        } else {
          today_status = 'absent';
        }
      }

      return {
        user_id: u._id || u.id,
        id: u._id || u.id,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone || '',
        employee_code: u.employee_code || '—',
        avatar_url: u.avatar_url || null,
        role: u.role,
        department_name: u.department_name || '—',
        today_status,
        check_in_time: att?.check_in_time || null,
        check_in_type: att?.check_in_type || null,
        check_out_time: att?.check_out_time || null,
        total_hours: att?.total_hours ?? 0,
        work_units: att ? (att.work_units ?? (att.status === 'present' ? 1.0 : 0)) : 0,
        status: att?.status || 'absent',
      };
    });

    return {
      data: {
        date: todayStr,
        summary: {
          total: users.length,
          checked_in: staffSummary.filter((s) => s.today_status === 'checked_in').length,
          checked_out: staffSummary.filter((s) => s.today_status === 'checked_out').length,
          leave: staffSummary.filter((s) => s.today_status === 'leave').length,
          holiday: staffSummary.filter((s) => s.today_status === 'holiday').length,
          absent: staffSummary.filter((s) => s.today_status === 'absent').length,
          present_total: staffSummary.filter((s) => ['checked_in', 'checked_out'].includes(s.today_status)).length,
        },
        staff: staffSummary,
        my_projects: [],
      },
    };
  }

  if (url.includes('/dashboard/pending-count')) {
    const pending = requests.filter((r) => r.status === 'pending');
    return { data: { pending_count: pending.length } };
  }

  // === REQUESTS ===
  if (url.includes('/requests/pending')) {
    const pending = requests.filter((r) => r.status === 'pending');
    return { data: { count: pending.length, requests: pending } };
  }

  if (url.includes('/requests') && method === 'get') {
    return { data: { requests, pagination: { total: requests.length, page: 1, limit: 10 } } };
  }

  if (url.includes('/requests') && method === 'post') {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : users[0];

    const newReq = {
      id: `req-${Date.now()}`,
      _id: `req-${Date.now()}`,
      user_id: user._id || user.id,
      requester_name: user.full_name,
      type: data.type,
      start_date: data.start_date,
      reason: data.reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    requests.unshift(newReq);
    setMockStorage('requests', requests);
    return { data: { message: 'Tạo đơn thành công! (Offline Mode)', request: newReq } };
  }

  if (url.includes('/approve')) {
    const parts = url.split('/');
    const reqId = parts[parts.indexOf('requests') + 1];
    const reqItem = requests.find((r) => r.id === reqId || r._id === reqId);
    if (reqItem) {
      reqItem.status = 'approved';
      setMockStorage('requests', requests);
    }
    return { data: { message: 'Đã duyệt đơn thành công ✅' } };
  }

  if (url.includes('/reject')) {
    const parts = url.split('/');
    const reqId = parts[parts.indexOf('requests') + 1];
    const reqItem = requests.find((r) => r.id === reqId || r._id === reqId);
    if (reqItem) {
      reqItem.status = 'rejected';
      reqItem.reviewer_note = data.reviewer_note;
      setMockStorage('requests', requests);
    }
    return { data: { message: 'Đã từ chối đơn ❌' } };
  }

  // === USERS MANAGEMENT ===
  if (url.includes('/users') && method === 'get') {
    return { data: users };
  }

  if (url.includes('/users') && method === 'post') {
    const newUser = {
      id: `user-${Date.now()}`,
      _id: `user-${Date.now()}`,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.role || 'staff',
      department_name: data.department_name || 'Kiến trúc',
      is_active: true,
    };
    users.unshift(newUser);
    setMockStorage('users', users);
    return { data: { message: 'Thêm nhân viên mới thành công!', user: newUser } };
  }

  if (url.includes('/users') && method === 'patch') {
    const userId = url.split('/').pop();
    const u = users.find((item) => item.id === userId || item._id === userId);
    if (u) {
      Object.assign(u, data);
      setMockStorage('users', users);
    }
    return { data: { message: 'Cập nhật nhân viên thành công!', user: u } };
  }

  // === HOLIDAYS ===
  if (url.includes('/holidays')) {
    const holidays = getMockStorage('holidays', []);
    const pathOnly = url.split('?')[0];
    const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');

    if (pathOnly.endsWith('/seed-vietnam') && method === 'post') {
      const year = Number(params.get('year')) || new Date().getFullYear();
      const seeded = [
        { name: 'Tết Dương lịch', date: `${year}-01-01`, end_date: `${year}-01-01` },
        { name: 'Quốc khánh', date: `${year}-09-02`, end_date: `${year}-09-02` },
      ].map((holiday, index) => ({
        _id: `holiday-seed-${year}-${index}`,
        ...holiday,
        work_multiplier: 1.5,
      }));
      seeded.forEach(holiday => {
        if (!holidays.some(item => item.date === holiday.date && item.name === holiday.name)) holidays.push(holiday);
      });
      setMockStorage('holidays', holidays);
      return { data: { message: `Đã nạp ngày lễ Việt Nam năm ${year}!`, holidays: seeded } };
    }

    if (method === 'get') {
      const year = params.get('year');
      const yearStart = year ? `${year}-01-01` : '';
      const yearEnd = year ? `${year}-12-31` : '';
      const filtered = year
        ? holidays.filter(holiday => String(holiday.date || '') <= yearEnd && String(holiday.end_date || holiday.date || '') >= yearStart)
        : holidays;
      return { data: filtered.map(holiday => ({ ...holiday, work_multiplier: normalizeHolidayMultiplier(holiday.work_multiplier) })) };
    }

    if (method === 'post') {
      const multiplier = Number(data.work_multiplier ?? 1.5);
      if (!HOLIDAY_WORK_MULTIPLIERS.includes(multiplier)) throw createMockHttpError('Hệ số công ngày lễ không hợp lệ.', 400);
      const holiday = {
        ...data,
        _id: `holiday-${Date.now()}`,
        end_date: data.end_date || data.date,
        work_multiplier: multiplier,
      };
      holidays.push(holiday);
      setMockStorage('holidays', holidays);
      return { data: { message: 'Đã thêm ngày nghỉ lễ thành công!', holiday } };
    }

    if (method === 'put') {
      const id = pathOnly.split('/').pop();
      const holiday = holidays.find(item => String(item._id || item.id) === String(id));
      if (!holiday) throw createMockHttpError('Không tìm thấy ngày lễ.', 404);
      const multiplier = Number(data.work_multiplier ?? holiday.work_multiplier ?? 1.5);
      if (!HOLIDAY_WORK_MULTIPLIERS.includes(multiplier)) throw createMockHttpError('Hệ số công ngày lễ không hợp lệ.', 400);
      Object.assign(holiday, data, {
        end_date: data.end_date || data.date || holiday.end_date || holiday.date,
        work_multiplier: multiplier,
      });
      setMockStorage('holidays', holidays);
      return { data: { message: 'Đã cập nhật ngày nghỉ lễ thành công!', holiday } };
    }

    if (method === 'delete') {
      const id = pathOnly.split('/').pop();
      const nextHolidays = holidays.filter(item => String(item._id || item.id) !== String(id));
      if (nextHolidays.length === holidays.length) throw createMockHttpError('Không tìm thấy ngày lễ.', 404);
      setMockStorage('holidays', nextHolidays);
      return { data: { message: 'Đã xóa ngày nghỉ lễ thành công!' } };
    }
  }

  // === SYSTEM SETTINGS ===
  if (url.includes('/settings')) {
    let systemSettings = getMockStorage('system_settings', {
      company_name: 'Kiến trúc ET',
      company_logo_url: '/logo.png',
      work_start_time: '09:00',
      work_end_time: '18:30',
      ot_start_time: '18:30',
      minor_late_mins: 30,
      medium_late_mins: 60,
    });
    if (method === 'put' || method === 'post') {
      systemSettings = { ...systemSettings, ...data };
      setMockStorage('system_settings', systemSettings);
      return { data: { message: 'Đã lưu cấu hình hệ thống!', settings: systemSettings } };
    }
    return { data: systemSettings };
  }

  // === COMPANY EXPENSES & REIMBURSEMENTS ===
  if (url.includes('/expenses')) {
    const expenses = getMockStorage('expenses', INITIAL_MOCK_EXPENSES);
    const userList = getMockStorage('users', INITIAL_MOCK_USERS);
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : userList[0];
    const currentUserId = String(currentUser._id || currentUser.id || 'user-admin');
    const isAdmin = currentUser.role === 'admin';
    const isLeader = ['leader', 'manager'].includes(currentUser.role);

    const isSubordinate = (ownerRef) => {
      if (!isLeader || isAdmin) return false;
      const ownerId = String(ownerRef?._id || ownerRef?.id || ownerRef || '');
      if (ownerId === currentUserId) return false;
      const matched = userList.find((u) => String(u._id || u.id) === ownerId) || (typeof ownerRef === 'object' ? ownerRef : null);
      if (!matched) return false;
      if (matched.role === 'admin') return false;

      if (matched.manager_id && String(matched.manager_id) === currentUserId) return true;

      const leaderDeptIds = (currentUser.department_ids && currentUser.department_ids.length > 0)
        ? currentUser.department_ids.map(String)
        : [String(currentUser.department_id || '')].filter(Boolean);
      const leaderDeptName = currentUser.department_name || currentUser.department || '';

      const userDeptIds = (matched.department_ids && matched.department_ids.length > 0)
        ? matched.department_ids.map(String)
        : [String(matched.department_id || '')].filter(Boolean);
      const userDeptName = matched.department_name || matched.department || '';

      const hasDeptIdOverlap = leaderDeptIds.length > 0 && userDeptIds.some((id) => leaderDeptIds.includes(id));
      const hasDeptNameMatch = Boolean(leaderDeptName && userDeptName && leaderDeptName === userDeptName);

      return hasDeptIdOverlap || hasDeptNameMatch;
    };

    const createMockError = (message, status = 400) => {
      const err = new Error(message);
      err.response = {
        status,
        data: { error: message },
      };
      return err;
    };

    const urlParts = url.split('?');
    const pathOnly = urlParts[0];
    const queryString = urlParts[1] || '';
    const params = new URLSearchParams(queryString);
    const qUserId = params.get('user_id');
    const qYear = params.get('year');
    const qMonth = params.get('month');
    const qStatus = params.get('approval_status') || params.get('status');
    const qPaymentStatus = params.get('payment_status');
    const qHasVat = params.get('has_vat');
    const qSearch = params.get('search');
    const qPage = params.get('page');
    const qLimit = params.get('limit');

    if (pathOnly.includes('/approve') && method === 'put') {
      const parts = pathOnly.split('/');
      const expId = parts[parts.indexOf('expenses') + 1];
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (!exp) throw createMockError('Khoản chi không tồn tại.', 404);

      const canApprove = (isAdmin || isSubordinate(exp.user_id)) && exp.approval_status === 'pending';
      if (!canApprove) throw createMockError('Bạn không có quyền duyệt khoản chi này.', 403);

      exp.approval_status = data.status || 'approved';
      exp.approved_by = { full_name: currentUser.full_name || 'Quản trị viên' };
      exp.approved_at = new Date().toISOString();
      if (data.rejection_reason) exp.rejection_reason = data.rejection_reason;
      setMockStorage('expenses', expenses);
      return { data: { message: 'Cập nhật trạng thái duyệt thành công ✅', expense: exp } };
    }

    if (pathOnly.includes('/pay') && method === 'put') {
      const parts = pathOnly.split('/');
      const expId = parts[parts.indexOf('expenses') + 1];
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (!exp) throw createMockError('Khoản chi không tồn tại.', 404);

      if (!isAdmin || exp.approval_status !== 'approved') {
        throw createMockError('Chỉ Admin mới có quyền xác nhận hoàn ứng cho khoản chi đã duyệt.', 403);
      }

      exp.payment_status = data.payment_status || (exp.payment_status === 'paid' ? 'unpaid' : 'paid');
      if (exp.payment_status === 'paid') {
        exp.paid_by = { full_name: currentUser.full_name || 'Quản trị viên' };
        exp.paid_at = new Date().toISOString();
        if (data.payment_note) exp.payment_note = data.payment_note;
      } else {
        exp.paid_by = null;
        exp.paid_at = null;
        exp.payment_note = null;
      }
      setMockStorage('expenses', expenses);
      return { data: { message: 'Cập nhật trạng thái hoàn ứng thành công 💵', expense: exp } };
    }

    if (pathOnly.includes('/vat') && method === 'put') {
      const parts = pathOnly.split('/');
      const expId = parts[parts.indexOf('expenses') + 1];
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (!exp) throw createMockError('Khoản chi không tồn tại.', 404);

      const ownerId = String(exp.user_id?._id || exp.user_id?.id || exp.user_id || '');
      const isOwner = ownerId === currentUserId;
      const canToggleVat = isAdmin || ((isOwner || isSubordinate(exp.user_id)) && exp.approval_status === 'pending');
      if (!canToggleVat) throw createMockError('Bạn không có quyền cập nhật VAT cho khoản chi này.', 403);

      exp.has_vat_invoice = !exp.has_vat_invoice;
      setMockStorage('expenses', expenses);
      return { data: { message: 'Đã cập nhật trạng thái hóa đơn VAT!', has_vat_invoice: exp.has_vat_invoice } };
    }

    if (method === 'post') {
      const newExp = {
        _id: `exp-${Date.now()}`,
        id: `exp-${Date.now()}`,
        user_id: {
          _id: currentUserId,
          full_name: currentUser.full_name || 'Nhân viên',
          employee_code: currentUser.employee_code || 'ET003',
          department_name: currentUser.department_name || currentUser.department || 'Kiến trúc',
          avatar_url: currentUser.avatar_url || '/logo.png',
        },
        date: data.date || todayStr,
        description: data.description || 'Khoản chi tiêu mới',
        amount: Number(data.amount) || 0,
        has_vat_invoice: Boolean(data.has_vat_invoice),
        receipt_url: data.receipt_url || null,
        notes: data.notes || null,
        approval_status: 'pending',
        payment_status: 'unpaid',
        created_at: new Date().toISOString(),
      };
      expenses.unshift(newExp);
      setMockStorage('expenses', expenses);
      return { data: { message: 'Báo cáo khoản chi tiêu mới thành công! ✅', expense: newExp } };
    }

    if (method === 'delete') {
      const expId = pathOnly.split('/').pop();
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (!exp) throw createMockError('Khoản chi không tồn tại.', 404);

      const ownerId = String(exp.user_id?._id || exp.user_id?.id || exp.user_id || '');
      const isOwner = ownerId === currentUserId;
      const canDelete = isAdmin || ((isOwner || isSubordinate(exp.user_id)) && exp.approval_status === 'pending');
      if (!canDelete) throw createMockError('Bạn không có quyền xóa khoản chi này.', 403);

      const nextExpenses = expenses.filter((e) => e._id !== expId && e.id !== expId);
      setMockStorage('expenses', nextExpenses);
      return { data: { message: 'Đã xóa khoản chi tiêu thành công 🗑️' } };
    }

    // GET /expenses with filters
    let filtered = [...expenses];
    if (qUserId && qUserId !== 'all') {
      filtered = filtered.filter((e) => String(e.user_id?._id || e.user_id?.id || e.user_id || '') === qUserId);
    }
    if (qYear && qYear !== 'all') {
      filtered = filtered.filter((e) => e.date && e.date.startsWith(`${qYear}-`));
    }
    if (qMonth && qMonth !== 'all') {
      const targetYear = qYear && qYear !== 'all' ? qYear : new Date().getFullYear();
      const monthPrefix = `${targetYear}-${String(qMonth).padStart(2, '0')}`;
      filtered = filtered.filter((e) => e.date && e.date.startsWith(monthPrefix));
    }
    if (qStatus && qStatus !== 'all') {
      filtered = filtered.filter((e) => e.approval_status === qStatus);
    }
    if (qPaymentStatus && qPaymentStatus !== 'all') {
      filtered = filtered.filter((e) => e.payment_status === qPaymentStatus);
    }
    if (qHasVat !== null && qHasVat !== undefined && qHasVat !== 'all') {
      filtered = filtered.filter((e) => Boolean(e.has_vat_invoice) === (qHasVat === 'true' || qHasVat === true));
    }
    if (qSearch && qSearch.trim()) {
      const s = qSearch.trim().toLowerCase();
      filtered = filtered.filter((e) => e.description && e.description.toLowerCase().includes(s));
    }

    // Summary KPIs calculated across year dataset
    let totalApprovedAmount = 0;
    let totalPendingAmount = 0;
    let totalPendingCount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidAmount = 0;
    let myTotalApproved = 0;
    let myTotalUnpaid = 0;

    const summaryExpenses = (qYear && qYear !== 'all')
      ? expenses.filter((e) => e.date && e.date.startsWith(`${qYear}-`))
      : expenses;

    summaryExpenses.forEach((exp) => {
      const ownerId = String(exp.user_id?._id || exp.user_id?.id || exp.user_id || '');
      const isMine = ownerId === currentUserId;

      if (exp.approval_status === 'approved') {
        totalApprovedAmount += exp.amount || 0;
        if (exp.payment_status === 'paid') totalPaidAmount += exp.amount || 0;
        else totalUnpaidAmount += exp.amount || 0;

        if (isMine) {
          myTotalApproved += exp.amount || 0;
          if (exp.payment_status !== 'paid') myTotalUnpaid += exp.amount || 0;
        }
      } else if (exp.approval_status === 'pending') {
        totalPendingAmount += exp.amount || 0;
        totalPendingCount += 1;
      }
    });

    const qExport = params.get('export');
    const isExport = qExport === 'true' || qExport === true;

    const expenseDtos = filtered.map((exp) => {
      const ownerId = String(exp.user_id?._id || exp.user_id?.id || exp.user_id || '');
      const isOwner = ownerId === currentUserId;
      const isSub = isSubordinate(exp.user_id);
      const isPending = exp.approval_status === 'pending';
      const isApproved = exp.approval_status === 'approved';

      const canApprove = (isAdmin || isSub) && isPending;
      const canDelete = isAdmin || ((isOwner || isSub) && isPending);
      const canToggleVat = isAdmin || ((isOwner || isSub) && isPending);
      const canMarkPaid = isAdmin && isApproved;
      const canManage = canApprove || canDelete || canToggleVat || canMarkPaid;

      const baseExp = isExport
        ? {
            _id: exp._id,
            user_id: exp.user_id,
            date: exp.date,
            description: exp.description,
            amount: exp.amount,
            has_vat_invoice: exp.has_vat_invoice,
            notes: exp.notes,
            approval_status: exp.approval_status,
            approved_by: exp.approved_by,
            approved_at: exp.approved_at,
            rejection_reason: exp.rejection_reason,
            payment_status: exp.payment_status,
            paid_by: exp.paid_by,
            paid_at: exp.paid_at,
            payment_note: exp.payment_note,
            created_at: exp.created_at,
          }
        : exp;

      return {
        ...baseExp,
        can_approve: canApprove,
        can_delete: canDelete,
        can_toggle_vat: canToggleVat,
        can_mark_paid: canMarkPaid,
        can_manage: canManage,
      };
    });

    const hasPagination = !isExport && (qPage !== null || qLimit !== null);
    const pageNum = Math.max(1, parseInt(qPage, 10) || 1);
    const limitNum = hasPagination ? Math.min(Math.max(1, parseInt(qLimit, 10) || 50), 500) : expenseDtos.length;
    const paginatedList = hasPagination ? expenseDtos.slice((pageNum - 1) * limitNum, pageNum * limitNum) : expenseDtos;

    return {
      data: {
        expenses: paginatedList,
        summary: {
          totalApprovedAmount,
          totalPendingAmount,
          totalPendingCount,
          totalUnpaidAmount,
          totalPaidAmount,
          myTotalApproved,
          myTotalUnpaid,
          totalCount: expenseDtos.length,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(expenseDtos.length / limitNum) || 1,
        },
      },
    };
  }

  return { data: {} };
}
