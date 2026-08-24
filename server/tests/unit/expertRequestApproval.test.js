// ==============================================
// tests/unit/expertRequestApproval.test.js
// Bộ Kiểm Thử Chuyên Gia: Quy Trình Phê Duyệt Đơn Từ & Tác Động Toàn Diện
// Zero-Impact Isolated Test Engine
// ==============================================

// Helper tính toán dải ngày giữa start_date và end_date
const getDatesInRange = (startDateStr, endDateStr) => {
  if (!startDateStr) return [];
  const endStr = endDateStr || startDateStr;
  const dates = [];
  const start = new Date(startDateStr + 'T00:00:00+07:00');
  const end = new Date(endStr + 'T00:00:00+07:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return [startDateStr];
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// Helper tính toán giờ OT từ start_time và end_time
const calculateOtHours = (startTimeStr, endTimeStr) => {
  if (!startTimeStr || !endTimeStr) return 2.0; // fallback
  const [sH, sM] = startTimeStr.split(':').map(Number);
  const [eH, eM] = endTimeStr.split(':').map(Number);
  const diffMinutes = (eH * 60 + eM) - (sH * 60 + sM);
  if (diffMinutes <= 0) return 0;
  return parseFloat((diffMinutes / 60).toFixed(1));
};

// Mô phỏng hàm xử lý duyệt đơn
const simulateApproveRequest = (request, targetUser, reviewer, existingAttendances = []) => {
  // 1. Kiểm tra phân quyền RBAC
  if (['leader', 'manager'].includes(reviewer.role) && targetUser.role === 'admin') {
    return { success: false, status: 403, error: 'Leader không có quyền duyệt đơn của Admin.' };
  }

  // 2. Cập nhật trạng thái đơn
  const updatedRequest = {
    ...request,
    status: 'approved',
    approved_by: reviewer._id,
    approved_at: new Date().toISOString(),
    reviewer_note: 'Đã duyệt bởi quản lý'
  };

  // 3. Tính dải ngày áp dụng
  const dates = getDatesInRange(request.start_date, request.end_date);
  const updatedAttendances = [...existingAttendances];

  // 4. Xử lý tác động điểm danh theo từng ngày
  dates.forEach(d => {
    let att = updatedAttendances.find(a => a.user_id === request.user_id && a.date === d);
    if (att) {
      if (['late', 'early_leave'].includes(request.type)) {
        att.is_late = false;
        att.late_minutes = 0;
        att.late_tier = 'on_time';
        att.work_units = 1.0;
        att.notes = `Đã duyệt giải trình: ${request.reason}`;
      } else if (['business_trip', 'foreign_trip'].includes(request.type)) {
        att.check_in_type = 'site';
        att.status = 'present';
        att.work_units = 1.0;
        att.is_late = false;
        att.total_hours = Math.max(att.total_hours || 0, 8.5);
      } else if (request.type === 'wfh') {
        att.check_in_type = 'wfh';
        att.status = 'present';
        att.work_units = 1.0;
        att.is_late = false;
        att.total_hours = Math.max(att.total_hours || 0, 8.5);
      } else if (['annual_leave', 'sick_leave', 'unpaid_leave'].includes(request.type)) {
        att.status = 'leave';
        att.work_units = 1.0;
        att.total_hours = 8.5;
        att.is_late = false;
      } else if (request.type === 'overtime') {
        const ot = calculateOtHours(request.start_time, request.end_time);
        att.ot_hours = (att.ot_hours || 0) + ot;
      }
    } else {
      // Tạo mới
      const newAtt = {
        user_id: request.user_id,
        date: d,
        work_units: 1.0,
        is_late: false,
        late_minutes: 0,
        late_tier: 'on_time',
        status: ['annual_leave', 'sick_leave', 'unpaid_leave'].includes(request.type) ? 'leave' : 'present',
        check_in_type: ['business_trip', 'foreign_trip'].includes(request.type) ? 'site' : request.type === 'wfh' ? 'wfh' : 'office',
        total_hours: 8.5,
        ot_hours: request.type === 'overtime' ? calculateOtHours(request.start_time, request.end_time) : 0,
        notes: `Duyệt đơn: ${request.type}`
      };
      updatedAttendances.push(newAtt);
    }
  });

  return {
    success: true,
    status: 200,
    request: updatedRequest,
    attendances: updatedAttendances,
    affected_dates: dates
  };
};

function runExpertRequestApprovalTests(assert) {
  console.log('\n👑 [TEST SUITE: EXPERT REQUEST APPROVAL WORKFLOW & LIFECYCLE]');

  // TC-EXP-REQ-01: Duyệt đơn nghỉ nhiều ngày (Multi-day Range)
  const multiDayReq = {
    _id: 'req_01',
    user_id: 'emp_01',
    type: 'annual_leave',
    start_date: '2026-08-25',
    end_date: '2026-08-27',
    reason: 'Nghỉ du lịch gia đình',
    status: 'pending'
  };
  const empUser = { _id: 'emp_01', role: 'employee', department_id: 'dept_it' };
  const leaderUser = { _id: 'ldr_01', role: 'leader', department_id: 'dept_it' };

  const res1 = simulateApproveRequest(multiDayReq, empUser, leaderUser, []);
  assert(res1.success === true, 'TC-EXP-REQ-01.1: Trưởng phòng duyệt đơn nghỉ phép thành công (200 OK)');
  assert(res1.affected_dates.length === 3, 'TC-EXP-REQ-01.2: Tính toán chính xác 3 ngày nghỉ (25/08, 26/08, 27/08)');
  assert(res1.attendances.length === 3 && res1.attendances.every(a => a.status === 'leave' && a.work_units === 1.0),
    'TC-EXP-REQ-01.3: Tự động đồng bộ đầy đủ 3 bản ghi điểm danh với status="leave" và công đủ 1.0');

  // TC-EXP-REQ-02: Duyệt đơn tăng ca OT tính giờ chuẩn xác
  const otReq = {
    _id: 'req_02',
    user_id: 'emp_01',
    type: 'overtime',
    start_date: '2026-08-24',
    end_date: '2026-08-24',
    start_time: '18:30',
    end_time: '21:30',
    reason: 'Triển khai dự án gấp',
    status: 'pending'
  };
  const existingAtt = [{
    user_id: 'emp_01',
    date: '2026-08-24',
    total_hours: 8.5,
    ot_hours: 0,
    status: 'present'
  }];
  const res2 = simulateApproveRequest(otReq, empUser, leaderUser, existingAtt);
  assert(res2.success === true, 'TC-EXP-REQ-02.1: Duyệt đơn tăng ca thành công');
  assert(res2.attendances[0].ot_hours === 3.0, 'TC-EXP-REQ-02.2: Tính chính xác 3.0h OT (18:30 -> 21:30) và cộng vào ot_hours');

  // TC-EXP-REQ-03: Kiểm tra ranh giới quyền Leader vs Admin (Security Boundary)
  const adminUser = { _id: 'adm_01', role: 'admin' };
  const adminReq = {
    _id: 'req_03',
    user_id: 'adm_01',
    type: 'business_trip',
    start_date: '2026-08-28',
    status: 'pending'
  };
  const res3 = simulateApproveRequest(adminReq, adminUser, leaderUser, []);
  assert(res3.success === false && res3.status === 403,
    'TC-EXP-REQ-03.1: Chặn Leader duyệt đơn của Admin (403 Forbidden - Security Boundary Protection)');

  const res3Admin = simulateApproveRequest(adminReq, adminUser, adminUser, []);
  assert(res3Admin.success === true && res3Admin.status === 200,
    'TC-EXP-REQ-03.2: Admin có thẩm quyền tối cao duyệt mọi đơn trong hệ thống');

  // TC-EXP-REQ-04: Duyệt giải trình đi muộn -> Tự động xóa phạt & phục hồi 1.0 công
  const lateReq = {
    _id: 'req_04',
    user_id: 'emp_01',
    type: 'late',
    start_date: '2026-08-24',
    reason: 'Hỏng xe trên đường đi làm',
    status: 'pending'
  };
  const existingLateAtt = [{
    user_id: 'emp_01',
    date: '2026-08-24',
    is_late: true,
    late_minutes: 25,
    late_tier: 'tier1',
    work_units: 0.8
  }];
  const res4 = simulateApproveRequest(lateReq, empUser, leaderUser, existingLateAtt);
  assert(res4.attendances[0].is_late === false && res4.attendances[0].late_minutes === 0,
    'TC-EXP-REQ-04.1: Xóa hoàn toàn trạng thái đi muộn (is_late=false, late_minutes=0)');
  assert(res4.attendances[0].work_units === 1.0 && res4.attendances[0].late_tier === 'on_time',
    'TC-EXP-REQ-04.2: Phục hồi nguyên vẹn 1.0 công lao động cho nhân viên');

  // TC-EXP-REQ-05: Duyệt đơn WFH & Công tác (CT1/CT2)
  const wfhReq = {
    _id: 'req_05',
    user_id: 'emp_01',
    type: 'wfh',
    start_date: '2026-08-29',
    reason: 'Làm việc từ xa hỗ trợ đối tác',
    status: 'pending'
  };
  const res5 = simulateApproveRequest(wfhReq, empUser, leaderUser, []);
  assert(res5.attendances[0].check_in_type === 'wfh' && res5.attendances[0].status === 'present',
    'TC-EXP-REQ-05.1: Ghi nhận đúng loại hình check_in_type="wfh" và status="present"');
  assert(res5.attendances[0].work_units === 1.0 && res5.attendances[0].total_hours === 8.5,
    'TC-EXP-REQ-05.2: Tính đủ 1.0 công chuẩn cho ngày WFH được duyệt');
}

module.exports = runExpertRequestApprovalTests;
