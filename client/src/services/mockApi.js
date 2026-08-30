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
    const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 45);

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
      status: isLate ? 'late' : 'present',
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
      rec.check_out_time = new Date().toISOString();
      rec.total_hours = 8.0;
      setMockStorage('attendance', attendance);
    }
    return { data: { message: 'Check-out thành công! (Offline Mode)', total_hours: 8.0 } };
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
      const att = attendance.find((a) => a.user_id === (u._id || u.id) && a.date === todayStr);
      return {
        user_id: u._id || u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        department_name: u.department_name,
        today_status: att ? (att.check_out_time ? 'checked_out' : 'checked_in') : 'absent',
        check_in_time: att?.check_in_time || null,
        check_in_type: att?.check_in_type || null,
        check_out_time: att?.check_out_time || null,
      };
    });

    return {
      data: {
        date: todayStr,
        summary: {
          total: users.length,
          checked_in: staffSummary.filter((s) => s.today_status === 'checked_in').length,
          checked_out: staffSummary.filter((s) => s.today_status === 'checked_out').length,
          absent: staffSummary.filter((s) => s.today_status === 'absent').length,
          present_total: staffSummary.filter((s) => s.today_status !== 'absent').length,
        },
        staff: staffSummary,
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

  // === SYSTEM SETTINGS ===
  if (url.includes('/settings')) {
    let systemSettings = getMockStorage('system_settings', {
      company_name: 'Kiến trúc ET',
      company_logo_url: '/logo.png',
      work_start_time: '08:30',
      work_end_time: '17:30',
      minor_late_mins: 10,
      medium_late_mins: 30,
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

    if (url.includes('/approve') && method === 'put') {
      const parts = url.split('/');
      const expId = parts[parts.indexOf('expenses') + 1];
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (exp) {
        exp.approval_status = data.status || 'approved';
        exp.approved_by = { full_name: 'Quản trị viên (Offline Mode)' };
        exp.approved_at = new Date().toISOString();
        if (data.rejection_reason) exp.rejection_reason = data.rejection_reason;
        setMockStorage('expenses', expenses);
      }
      return { data: { message: 'Cập nhật trạng thái duyệt thành công ✅', expense: exp } };
    }

    if (url.includes('/pay') && method === 'put') {
      const parts = url.split('/');
      const expId = parts[parts.indexOf('expenses') + 1];
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      if (exp) {
        exp.payment_status = 'paid';
        exp.paid_by = { full_name: 'Quản trị viên (Offline Mode)' };
        exp.paid_at = new Date().toISOString();
        if (data.payment_note) exp.payment_note = data.payment_note;
        setMockStorage('expenses', expenses);
      }
      return { data: { message: 'Xác nhận hoàn ứng thành công 💵', expense: exp } };
    }

    if (method === 'post') {
      const newExp = {
        _id: `exp-${Date.now()}`,
        id: `exp-${Date.now()}`,
        user_id: {
          _id: 'user-staff',
          full_name: 'Lê Văn Nhân (KTS)',
          employee_code: 'ET003',
          department_name: 'Kiến trúc',
          avatar_url: '/logo.png',
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
      const expId = url.split('/').pop();
      const nextExpenses = expenses.filter((e) => e._id !== expId && e.id !== expId);
      setMockStorage('expenses', nextExpenses);
      return { data: { message: 'Đã xóa khoản chi tiêu thành công 🗑️' } };
    }

    // GET /expenses
    let filtered = [...expenses];
    let totalApprovedAmount = 0;
    let totalPendingAmount = 0;
    let totalPendingCount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidAmount = 0;

    expenses.forEach((exp) => {
      if (exp.approval_status === 'approved') {
        totalApprovedAmount += exp.amount || 0;
        if (exp.payment_status === 'paid') totalPaidAmount += exp.amount || 0;
        else totalUnpaidAmount += exp.amount || 0;
      } else if (exp.approval_status === 'pending') {
        totalPendingAmount += exp.amount || 0;
        totalPendingCount += 1;
      }
    });

    return {
      data: {
        expenses: filtered,
        summary: {
          totalApprovedAmount,
          totalPendingAmount,
          totalPendingCount,
          totalUnpaidAmount,
          totalPaidAmount,
          myTotalApproved: totalApprovedAmount,
          myTotalUnpaid: totalUnpaidAmount,
        },
      },
    };
  }

  return { data: {} };
}
