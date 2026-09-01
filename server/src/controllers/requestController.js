// controllers/requestController.js - Request Controller với xử lý tác động bảng công & điểm danh
const mongoose = require('mongoose');
const Request = require('../models/Request');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const TimesheetLock = require('../models/TimesheetLock');
const SystemSetting = require('../models/SystemSetting');
const { calculateOT, calculateAttendanceMetrics, normalizeHolidayMultiplier } = require('../utils/attendanceCalculations');
const { logAction } = require('../utils/auditLogger');
const { deductLeaveOnApproval, revertLeaveOnUndo } = require('./leaveBalanceController');
const {
  isLeaderRole,
  getDepartmentIds,
  buildLeaderUserScope,
  canManageUserId,
} = require('../utils/roleScope');

const VALID_TYPES = ['late', 'early_leave', 'forgot_checkout', 'overtime', 'business_trip', 'foreign_trip', 'wfh', 'sick_leave', 'annual_leave', 'unpaid_leave', 'vehicle_update', 'other'];

const TYPE_LABELS = {
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  forgot_checkout: '🚪 Bổ sung giờ checkout',
  overtime: 'Tăng ca (OT)',
  business_trip: 'CT Trong nước (CT1)',
  foreign_trip: 'CT Nước ngoài (CT2)',
  wfh: 'Work from home (WFH)',
  annual_leave: 'Nghỉ phép (P)',
  sick_leave: 'Nghỉ ốm (O)',
  unpaid_leave: 'Nghỉ không lương (KL)',
  vehicle_update: '🛵 Đổi thông tin gửi xe',
  other: 'Khác (K)',
};

// Helper kiểm tra topology MongoDB theo chính sách Fail-Closed tuyệt đối [P1, P2]:
// - Mọi môi trường kết nối thật (Atlas, ReplicaSet, Sharded, Standalone, Development, Production) đều BẮT BUỘC ACID Transaction (Fail-Closed)
// - Chỉ in-memory unit test runner (NODE_ENV === 'test' khi không có kết nối DB thực) mới được miễn transaction
const getTopologyStatus = () => {
  const readyState = mongoose.connection?.readyState;
  const isTestEnv = Boolean(process.env.NODE_ENV === 'test');
  const topology = mongoose.connection?.client?.topology;

  // Giới hạn tường minh: chỉ in-memory test runner (NODE_ENV === 'test' và không có client topology và disconnected)
  if (isTestEnv && !topology && readyState !== 1) {
    return { readyState, isTestEnv: true, requiresTransaction: false };
  }

  // Mọi trường hợp còn lại đều yêu cầu Transaction Fail-Closed
  return { readyState, isTestEnv: false, requiresTransaction: true };
};

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

// Helper khởi tạo bảo đảm trước ngoài transaction (Idempotent Pre-Init)
const preInitTimesheetLocks = async (dates, userId) => {
  if (!dates || dates.length === 0) return;

  const monthYearSet = new Set();
  dates.forEach(d => {
    if (typeof d === 'string' && d.includes('-')) {
      const [y, m] = d.split('-').map(Number);
      if (y && m) monthYearSet.add(`${y}-${m}`);
    }
  });

  for (const ym of monthYearSet) {
    const [dYear, dMonth] = ym.split('-').map(Number);
    // 1. Pre-init global lock
    if (typeof TimesheetLock.updateOne === 'function') {
      try {
        await TimesheetLock.updateOne(
          { month: dMonth, year: dYear, user_id: null },
          { $setOnInsert: { month: dMonth, year: dYear, user_id: null, is_locked: false, guard_version: 0 } },
          { upsert: true }
        );
      } catch (e) {
        if (e.code !== 11000) {
          const err = new Error(`Lỗi khởi tạo bảo vệ giao dịch (Global Lock ${dMonth}/${dYear}): ` + e.message);
          err.statusCode = 500;
          throw err;
        }
      }

      // 2. Pre-init user lock
      if (userId) {
        try {
          await TimesheetLock.updateOne(
            { month: dMonth, year: dYear, user_id: userId },
            { $setOnInsert: { month: dMonth, year: dYear, user_id: userId, is_locked: false, guard_version: 0 } },
            { upsert: true }
          );
        } catch (e) {
          if (e.code !== 11000) {
            const err = new Error(`Lỗi khởi tạo bảo vệ giao dịch (User Lock ${dMonth}/${dYear}): ` + e.message);
            err.statusCode = 500;
            throw err;
          }
        }
      }
    }
  }
};

// Helper Write-Intent Guard thực thi ngay trong Transaction Session để chống Race Condition [P1]
const guardTimesheetLocksInTx = async (dates, userId, session) => {
  if (!dates || dates.length === 0) return;

  const monthYearSet = new Set();
  dates.forEach(d => {
    if (typeof d === 'string' && d.includes('-')) {
      const [y, m] = d.split('-').map(Number);
      if (y && m) monthYearSet.add(`${y}-${m}`);
    }
  });

  for (const ym of monthYearSet) {
    const [dYear, dMonth] = ym.split('-').map(Number);
    const updateOptions = { upsert: false, new: true };
    if (session) updateOptions.session = session;

    if (typeof TimesheetLock.findOneAndUpdate === 'function') {
      // 1. Guard global lock
      const globalGuard = await TimesheetLock.findOneAndUpdate(
        { month: dMonth, year: dYear, user_id: null, is_locked: { $ne: true } },
        { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
        updateOptions
      );
      if (!globalGuard || globalGuard.is_locked) {
        const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể thay đổi dữ liệu chấm công và đơn từ.`);
        lockErr.statusCode = 403;
        throw lockErr;
      }

      // 2. Guard user lock
      if (userId) {
        const userGuard = await TimesheetLock.findOneAndUpdate(
          { month: dMonth, year: dYear, user_id: userId, is_locked: { $ne: true } },
          { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
          updateOptions
        );
        if (!userGuard || userGuard.is_locked) {
          const lockErr = new Error(`Bảng công của nhân viên trong Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể thay đổi dữ liệu chấm công và đơn từ.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }
      }
    } else {
      // Fallback cho môi trường test không có findOneAndUpdate mock
      const lockQuery = TimesheetLock.findOne({
        month: dMonth,
        year: dYear,
        is_locked: true,
        $or: [{ user_id: null }, { user_id: userId }],
      });
      if (session && typeof lockQuery.session === 'function') lockQuery.session(session);
      const activeLock = await lockQuery;
      if (activeLock) {
        const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể thay đổi dữ liệu chấm công và đơn từ.`);
        lockErr.statusCode = 403;
        throw lockErr;
      }
    }
  }
};

// GET /api/requests
const getMyRequests = async (req, res) => {
  const { status, type } = req.query;

  try {
    const filter = { user_id: req.user._id };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const requests = await Request.find(filter)
      .populate({
        path: 'user_id',
        select: 'full_name email phone department_id department_ids avatar_url employee_code position role join_date start_year parking_location vehicle_info employment_status',
        populate: { path: 'department_id', select: 'name' }
      })
      .populate('approved_by', 'full_name')
      .sort({ created_at: -1 });

    const formatted = requests.map(r => {
      const obj = r.toObject ? r.toObject() : r;
      return {
        ...obj,
        id: obj._id,
        user_name: obj.user_id?.full_name || req.user.full_name,
        user_avatar: obj.user_id?.avatar_url || req.user.avatar_url,
        user_code: obj.user_id?.employee_code || req.user.employee_code,
        email: obj.user_id?.email || req.user.email,
        phone: obj.user_id?.phone || req.user.phone,
        position: obj.user_id?.position || req.user.position,
        department_name: obj.user_id?.department_id?.name || 'Văn Phòng',
        join_date: obj.user_id?.join_date || (obj.user_id?.start_year ? `Năm ${obj.user_id?.start_year}` : ''),
        parking_location: obj.user_id?.parking_location,
        vehicle_info: obj.user_id?.vehicle_info,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('GetMyRequests error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn.' });
  }
};

// POST /api/requests
const createRequest = async (req, res) => {
  try {
    const { type, start_date, end_date, start_time, end_time, reason, project_id, project_name, attachment_url, proposed_parking_location, proposed_vehicle_info } = req.body;
    const userId = req.user._id;

    const isVehicleUpdate = type === 'vehicle_update';
    const finalReason = (reason && reason.trim())
      ? reason.trim()
      : (isVehicleUpdate ? 'Đăng ký thông tin phương tiện gửi xe' : '');

    if (!type || !start_date || !finalReason) {
      return res.status(400).json({ error: 'Thiếu thông tin: loại đơn, ngày bắt đầu và lý do là bắt buộc.' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Loại đơn không hợp lệ.` });
    }

    if (finalReason.length < 3) {
      return res.status(400).json({ error: 'Lý do giải trình quá ngắn.' });
    }

    // [P1] Cưỡng chế end_date = start_date cho đơn forgot_checkout để tránh sửa dải nhiều ngày trái phép
    const finalEndDate = (type === 'forgot_checkout') ? start_date : (end_date || start_date);

    // Kiểm tra trùng đơn ngày này (ngoại trừ vehicle_update có thể gửi nếu chưa duyệt)
    const existing = await Request.findOne({
      user_id: userId,
      type,
      start_date,
      status: 'pending',
    });

    if (existing) {
      return res.status(409).json({ error: `Bạn đang có một yêu cầu "${TYPE_LABELS[type]}" đang chờ Admin phê duyệt.` });
    }

    // Nếu là đơn bổ sung giờ checkout: kiểm tra tiền điều kiện nghiêm ngặt [P1, P2]
    if (type === 'forgot_checkout') {
      const proposedCheckoutTime = end_time || start_time;
      if (!proposedCheckoutTime) {
        return res.status(400).json({ error: 'Vui lòng nhập giờ checkout đề xuất (VD: 18:30).' });
      }

      const [outH, outM] = proposedCheckoutTime.split(':').map(Number);
      if (isNaN(outH) || isNaN(outM) || outH < 0 || outH > 23 || outM < 0 || outM > 59) {
        return res.status(400).json({ error: 'Định dạng giờ checkout đề xuất không hợp lệ (HH:mm).' });
      }

      // 1. Tính toán thời gian VN hiện tại chính xác từng phút [P2]
      const now = new Date();
      const vnTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
      const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const currentVnDateTime = new Date(`${vnDateStr}T${vnTimeStr}+07:00`);

      const proposedCheckoutDateTime = new Date(`${start_date}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+07:00`);
      if (isNaN(proposedCheckoutDateTime.getTime())) {
        return res.status(400).json({ error: 'Ngày hoặc giờ checkout đề xuất không hợp lệ.' });
      }

      // 2. Chặn giờ checkout trong tương lai (kể cả trong cùng ngày hôm nay) [P2]
      if (proposedCheckoutDateTime.getTime() > currentVnDateTime.getTime()) {
        return res.status(400).json({
          error: `Giờ checkout đề xuất (${start_date} ${proposedCheckoutTime}) không được vượt quá thời gian hiện tại (${vnDateStr} ${vnTimeStr.substring(0, 5)}).`
        });
      }

      // 3. Kiểm tra Attendance của ngày đó
      const existingAtt = await Attendance.findOne({ user_id: userId, date: start_date });
      if (!existingAtt || !existingAtt.check_in_time) {
        return res.status(400).json({ error: `Ngày ${start_date} chưa có dữ liệu check-in để bổ sung giờ checkout.` });
      }
      if (existingAtt.check_out_time) {
        const formattedOut = new Date(existingAtt.check_out_time).toLocaleTimeString('vi-VN', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
        });
        return res.status(400).json({ error: `Ngày ${start_date} đã có dữ liệu checkout lúc ${formattedOut}. Không cần gửi đơn bổ sung.` });
      }

      // 4. Kiểm tra giờ checkout đề xuất so với giờ check-in thực tế
      const checkInDate = new Date(existingAtt.check_in_time);
      const checkInH = parseInt(checkInDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }), 10);
      const checkInM = parseInt(checkInDate.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }), 10);
      const checkInMinutes = checkInH * 60 + checkInM;
      const outMinutes = outH * 60 + outM;

      if (outMinutes <= checkInMinutes) {
        return res.status(400).json({
          error: `Giờ checkout đề xuất (${proposedCheckoutTime}) phải sau giờ check-in (${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}).`
        });
      }

      // 5. Chặn đơn quá hạn 48 giờ sau khi đã xác thực dữ liệu ca và thứ tự giờ hợp lệ.
      const diffMs = currentVnDateTime.getTime() - proposedCheckoutDateTime.getTime();
      if (diffMs > 48 * 60 * 60 * 1000) {
        return res.status(400).json({
          error: `Đơn bổ sung checkout chỉ được gửi trong vòng 48 giờ sau ca làm việc. Ngày ${start_date} đã quá hạn, vui lòng liên hệ Admin để xử lý.`
        });
      }
    }

    const request = await Request.create({
      user_id: userId,
      type,
      start_date,
      end_date: finalEndDate,
      start_time: start_time || null,
      end_time: end_time || null,
      proposed_parking_location: proposed_parking_location || null,
      proposed_vehicle_info: proposed_vehicle_info || null,
      project_id: project_id || null,
      project_name: project_name || null,
      reason: finalReason,
      attachment_url: attachment_url || null,
    });

    // Gửi thông báo đến Admin và Leader (ngoại trừ forgot_checkout chỉ gửi Admin)
    const employeeDepartmentIds = getDepartmentIds(req.user);
    const leaderRelationships = [];
    if (req.user.manager_id) leaderRelationships.push({ _id: req.user.manager_id });
    if (employeeDepartmentIds.length > 0) {
      leaderRelationships.push(
        { department_ids: { $in: employeeDepartmentIds } },
        { department_id: { $in: employeeDepartmentIds } }
      );
    }

    const reviewerConditions = [{ role: 'admin' }];
    if (type !== 'forgot_checkout' && leaderRelationships.length > 0) {
      reviewerConditions.push({
        role: { $in: ['leader', 'manager'] },
        $or: leaderRelationships,
      });
    }

    const reviewers = await User.find({
      $or: reviewerConditions,
      _id: { $ne: userId }
    });

    const senderName = req.user.full_name || 'Nhân viên';
    const notifs = reviewers.map((r) => ({
      user_id: r._id,
      title: `📝 Đơn mới từ ${senderName}`,
      message: type === 'vehicle_update'
        ? `${senderName} vừa gửi đơn "Đổi thông tin gửi xe". Nơi gửi: ${proposed_parking_location || '17T10'}`
        : `${senderName} vừa gửi đơn "${TYPE_LABELS[type]}" ngày ${start_date}. Lý do: "${finalReason}"`,
      type: 'request',
      link: '/requests',
    }));

    if (notifs.length > 0) {
      try { await Notification.insertMany(notifs); } catch (_) {}
    }

    try {
      await Notification.create({
        user_id: userId,
        title: 'Đã gửi đơn thành công',
        message: `Đơn "${TYPE_LABELS[type]}" ngày ${start_date} của bạn đã được gửi và đang chờ duyệt.`,
        type: 'request',
        link: '/requests',
      });
    } catch (_) {}

    res.status(201).json({
      message: `Gửi đơn "${TYPE_LABELS[type]}" thành công! Đang chờ duyệt.`,
      request,
    });
  } catch (error) {
    console.error('CreateRequest error:', error);
    res.status(500).json({ error: 'Lỗi tạo đơn.' });
  }
};

// GET /api/requests/pending
const getPendingRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    let filter = {};

    if (userRole === 'admin') {
      filter = {};
    } else if (isLeaderRole(req.user)) {
      filter = buildLeaderUserScope(req.user, { includeSelf: false });
    } else {
      return res.status(403).json({ error: 'Chỉ Admin hoặc Leader mới có quyền xem đơn chờ duyệt.' });
    }

    const targetUsers = await User.find(filter).select('_id');
    const targetUserIds = targetUsers.map(u => u._id);

    const requests = await Request.find({ user_id: { $in: targetUserIds } })
      .populate({
        path: 'user_id',
        select: 'full_name email phone department_id department_ids avatar_url employee_code position role join_date start_year parking_location vehicle_info employment_status',
        populate: { path: 'department_id', select: 'name' }
      })
      .populate('approved_by', 'full_name')
      .sort({ created_at: -1 });

    const formatted = requests.map(r => {
      const obj = r.toObject ? r.toObject() : r;
      return {
        ...obj,
        id: obj._id,
        user_name: obj.user_id?.full_name || 'Nhân viên',
        user_avatar: obj.user_id?.avatar_url,
        user_code: obj.user_id?.employee_code || 'NV',
        email: obj.user_id?.email,
        phone: obj.user_id?.phone,
        position: obj.user_id?.position || 'Nhân viên',
        department_name: obj.user_id?.department_id?.name || 'Văn Phòng',
        join_date: obj.user_id?.join_date || (obj.user_id?.start_year ? `Năm ${obj.user_id?.start_year}` : ''),
        parking_location: obj.user_id?.parking_location,
        vehicle_info: obj.user_id?.vehicle_info,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('GetPendingRequests error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn chờ duyệt.' });
  }
};

// Helper hoàn nguyên snapshot 100% cho đơn đã duyệt khi revert hoặc delete [P1]
const restoreRequestSnapshot = async (request, session = null) => {
  if (!request || request.status !== 'approved') return;

  if (request.snapshot_before) {
    const snap = request.snapshot_before;

    // 1. Phục hồi thông tin xe của nhân viên nếu là đơn đổi xe
    if (request.type === 'vehicle_update' && snap.user_vehicle) {
      let userQuery = User.findByIdAndUpdate(request.user_id, {
        parking_location: snap.user_vehicle.parking_location || null,
        vehicle_info: snap.user_vehicle.vehicle_info || null,
      });
      if (session && typeof userQuery.session === 'function') userQuery = userQuery.session(session);
      await userQuery;
    }

    // 2. Hoàn lại ngày phép nếu là đơn nghỉ có trừ phép
    if (['annual_leave', 'sick_leave'].includes(request.type)) {
      await revertLeaveOnUndo(request.user_id, request.type, request.start_date, request.end_date, session);
    }

    // 3. Phục hồi toàn bộ các bản ghi Attendance về đúng 100% snapshot ban đầu
    if (Array.isArray(snap.attendance_records)) {
      for (const rec of snap.attendance_records) {
        let attQuery = Attendance.findOne({ user_id: request.user_id, date: rec.date });
        if (session && typeof attQuery.session === 'function') attQuery = attQuery.session(session);
        const att = await attQuery;

        if (rec.was_created) {
          if (att && !att.check_in_time) {
            let delQuery = Attendance.findByIdAndDelete(att._id);
            if (session && typeof delQuery.session === 'function') delQuery = delQuery.session(session);
            await delQuery;
          } else if (att) {
            att.notes = 'Đã hoàn tác duyệt đơn';
            await att.save(session ? { session } : undefined);
          }
        } else if (rec.doc && att) {
          att.status = rec.doc.status;
          att.work_units = rec.doc.work_units;
          att.total_hours = rec.doc.total_hours;
          att.ot_hours = rec.doc.ot_hours;
          att.is_late = rec.doc.is_late;
          att.late_minutes = rec.doc.late_minutes;
          att.late_tier = rec.doc.late_tier;
          att.is_early_leave = rec.doc.is_early_leave;
          att.early_minutes = rec.doc.early_minutes;
          att.check_in_type = rec.doc.check_in_type;
          att.check_in_time = rec.doc.check_in_time;
          att.check_out_time = rec.doc.check_out_time;
          att.notes = rec.doc.notes;
          await att.save(session ? { session } : undefined);
        }
      }
    }
  } else {
    // Legacy fallback cho các đơn cũ duyệt trước khi có snapshot
    if (['annual_leave', 'sick_leave'].includes(request.type)) {
      await revertLeaveOnUndo(request.user_id, request.type, request.start_date, request.end_date, session);
    }

    let calculatedOtHours = 0;
    if (request.type === 'overtime') {
      if (request.start_time && request.end_time) {
        const [sH, sM] = request.start_time.split(':').map(Number);
        const [eH, eM] = request.end_time.split(':').map(Number);
        const diffMinutes = (eH * 60 + eM) - (sH * 60 + sM);
        if (diffMinutes > 0) calculatedOtHours = parseFloat((diffMinutes / 60).toFixed(1));
      }
      if (calculatedOtHours <= 0) calculatedOtHours = 2.0;
    }

    const targetDates = (request.type === 'forgot_checkout') ? [request.start_date] : getDatesInRange(request.start_date, request.end_date);
    for (const d of targetDates) {
      let attQuery = Attendance.findOne({ user_id: request.user_id, date: d });
      if (session && typeof attQuery.session === 'function') attQuery = attQuery.session(session);
      let att = await attQuery;

      if (att) {
        if (request.type === 'overtime') {
          att.ot_hours = Math.max(0, (att.ot_hours || 0) - calculatedOtHours);
          att.notes = att.notes ? att.notes.replace(/Duyệt tăng ca OT[^\n|]*/g, '').trim() : '';
          await att.save(session ? { session } : undefined);
        } else if (['annual_leave', 'sick_leave', 'unpaid_leave'].includes(request.type)) {
          if (!att.check_in_time) {
            let delQuery = Attendance.findByIdAndDelete(att._id);
            if (session && typeof delQuery.session === 'function') delQuery = delQuery.session(session);
            await delQuery;
          } else {
            att.status = 'present';
            att.notes = 'Đã hoàn tác duyệt nghỉ phép';
            await att.save(session ? { session } : undefined);
          }
        } else if (['business_trip', 'foreign_trip'].includes(request.type)) {
          if (!att.check_in_time) {
            let delQuery = Attendance.findByIdAndDelete(att._id);
            if (session && typeof delQuery.session === 'function') delQuery = delQuery.session(session);
            await delQuery;
          } else {
            att.check_in_type = 'office';
            att.notes = 'Đã hoàn tác duyệt công tác/WFH';
            await att.save(session ? { session } : undefined);
          }
        } else if (['late', 'early_leave'].includes(request.type)) {
          att.notes = 'Đã hoàn tác duyệt giải trình';
          await att.save(session ? { session } : undefined);
        }
      }
    }
  }
};

// PUT /api/requests/:id/approve
const approveRequest = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  // 1. Fail-Fast: Kiểm tra trạng thái kết nối & topology trước mọi thao tác DB [P1, P2]
  const topologyStatus = getTopologyStatus();
  if (topologyStatus.requiresTransaction && (topologyStatus.readyState !== 1 || typeof mongoose.startSession !== 'function')) {
    return res.status(500).json({
      error: 'Lỗi kết nối cơ sở dữ liệu: Trạng thái kết nối MongoDB không khả dụng để thiết lập phiên giao dịch an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
    });
  }

  let session = null;
  let useCallbackTx = false;
  let hasManualTx = false;

  // [P1, P2] Session Setup & Leak Prevention
  try {
    if (topologyStatus.requiresTransaction) {
      try {
        session = await mongoose.startSession();
        if (!session) {
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session). Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
        useCallbackTx = typeof session.withTransaction === 'function';
        hasManualTx = typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function';
        if (!useCallbackTx && !hasManualTx) {
          try { await session.endSession(); } catch (_) {}
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch thiếu phương thức transaction hợp lệ. Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
      } catch (sessInitErr) {
        console.error('Session start failed:', sessInitErr);
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Không thể khởi tạo phiên giao dịch an toàn trên MongoDB Atlas. Yêu cầu bị hủy theo chính sách Fail-Closed.',
        });
      }
    } else if (topologyStatus.isTestEnv && typeof mongoose.startSession === 'function') {
      // In-memory test runner session
      try {
        session = await mongoose.startSession();
        useCallbackTx = Boolean(session && typeof session.withTransaction === 'function');
        hasManualTx = Boolean(session && typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function');
      } catch (_) {
        session = null;
        useCallbackTx = false;
        hasManualTx = false;
      }
    } else {
      session = null;
      useCallbackTx = false;
      hasManualTx = false;
    }
  } catch (initErr) {
    console.error('Session init error:', initErr);
    return res.status(500).json({ error: 'Lỗi khởi tạo phiên làm việc cơ sở dữ liệu.' });
  }

  let isCommitted = false;
  let updatedRequestDoc = null;
  let initialReq = null;

  try {
    // 2. Đọc và kiểm tra quyền trên đơn
    initialReq = await Request.findById(id);
    if (!initialReq || initialReq.status !== 'pending') {
      return res.status(404).json({ error: 'Không tìm thấy đơn hoặc đơn đã được xử lý.' });
    }

    // [P1] RBAC CHẤM CÔNG: Chỉ Admin mới có quyền duyệt đơn bổ sung giờ checkout (forgot_checkout)
    if (initialReq.type === 'forgot_checkout' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền duyệt đơn bổ sung giờ checkout.' });
    }

    if (isLeaderRole(req.user) && !(await canManageUserId(req.user, initialReq.user_id))) {
      return res.status(403).json({ error: 'Bạn chỉ được duyệt đơn của nhân sự thuộc nhóm mình quản lý.' });
    }

    // [P1] Cưỡng chế targetDates chỉ có 1 ngày duy nhất cho forgot_checkout
    const targetDates = (initialReq.type === 'forgot_checkout') ? [initialReq.start_date] : getDatesInRange(initialReq.start_date, initialReq.end_date);

    // 3. Pre-init TimesheetLock documents ngoài transaction sau khi đã qua fail-fast connection check
    await preInitTimesheetLocks(targetDates, initialReq.user_id);

    // 4. Định nghĩa khối Mutation thực thi trong Transaction Session
    const executeMutation = async (activeSession) => {
      let reqQuery = Request.findOne({ _id: id, status: 'pending' });
      if (activeSession && typeof reqQuery.session === 'function') reqQuery = reqQuery.session(activeSession);
      const request = await reqQuery;

      if (!request) {
        const err = new Error('Không tìm thấy đơn hoặc đơn đã được xử lý.');
        err.statusCode = 404;
        throw err;
      }

      // Write-Intent Guard khóa trạng thái TimesheetLock ngay trong Transaction Session [P1]
      await guardTimesheetLocksInTx(targetDates, request.user_id, activeSession);

      // Nếu là đơn forgot_checkout: Kiểm tra lại Attendance tại thời điểm duyệt [P1]
      if (request.type === 'forgot_checkout') {
        let attQuery = Attendance.findOne({ user_id: request.user_id, date: request.start_date });
        if (activeSession && typeof attQuery.session === 'function') attQuery = attQuery.session(activeSession);
        const existingAtt = await attQuery;

        if (!existingAtt || !existingAtt.check_in_time) {
          const err = new Error(`Ngày ${request.start_date} chưa có dữ liệu check-in hợp lệ để bổ sung giờ checkout.`);
          err.statusCode = 400;
          throw err;
        }
        if (existingAtt.check_out_time) {
          const formattedOut = new Date(existingAtt.check_out_time).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
          });
          const err = new Error(`Ngày ${request.start_date} đã có dữ liệu checkout thực tế (${formattedOut}). Không thể duyệt bổ sung giờ ra để tránh ghi đè dữ liệu.`);
          err.statusCode = 409;
          throw err;
        }

        // [P1] Re-check giờ checkout đề xuất so với giờ check-in thực tế
        const checkInDate = new Date(existingAtt.check_in_time);
        const checkInH = parseInt(checkInDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }), 10);
        const checkInM = parseInt(checkInDate.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }), 10);
        const checkInMinutes = checkInH * 60 + checkInM;

        const proposedTime = request.end_time || request.start_time || '18:30';
        const [outH, outM] = proposedTime.split(':').map(Number);
        const outMinutes = outH * 60 + outM;

        if (outMinutes <= checkInMinutes) {
          const err = new Error(`Giờ checkout đề xuất (${proposedTime}) phải sau giờ check-in thực tế (${String(checkInH).padStart(2, '0')}:${String(checkInM).padStart(2, '0')}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      // Thu thập snapshot trước khi duyệt để hoàn tác chính xác 100% [P1]
      const attSnapshots = [];
      for (const d of targetDates) {
        let existingAttQuery = Attendance.findOne({ user_id: request.user_id, date: d });
        if (activeSession && typeof existingAttQuery.session === 'function') existingAttQuery = existingAttQuery.session(activeSession);
        const existingAtt = await existingAttQuery;

        if (existingAtt) {
          attSnapshots.push({
            date: d,
            was_created: false,
            doc: {
              status: existingAtt.status,
              work_units: existingAtt.work_units,
              total_hours: existingAtt.total_hours,
              ot_hours: existingAtt.ot_hours,
              is_late: existingAtt.is_late,
              late_minutes: existingAtt.late_minutes,
              late_tier: existingAtt.late_tier,
              is_early_leave: existingAtt.is_early_leave,
              early_minutes: existingAtt.early_minutes,
              check_in_type: existingAtt.check_in_type,
              check_in_time: existingAtt.check_in_time,
              check_out_time: existingAtt.check_out_time,
              notes: existingAtt.notes,
            },
          });
        } else {
          attSnapshots.push({
            date: d,
            was_created: true,
          });
        }
      }

      let userQuery = User.findById(request.user_id);
      if (activeSession && typeof userQuery.session === 'function') userQuery = userQuery.session(activeSession);
      const targetUser = await userQuery;

      const userVehicleSnapshot = targetUser
        ? {
            parking_location: targetUser.parking_location,
            vehicle_info: targetUser.vehicle_info,
          }
        : null;

      // Trừ ngày phép nếu là đơn nghỉ phép năm hoặc nghỉ ốm [P1 - Throw on error]
      if (['annual_leave', 'sick_leave'].includes(request.type)) {
        await deductLeaveOnApproval(request.user_id, request.type, request.start_date, request.end_date, activeSession);
      }

      // Cập nhật thông tin xe nếu là đơn đổi thông tin gửi xe
      if (request.type === 'vehicle_update' && (request.proposed_vehicle_info || request.proposed_parking_location)) {
        const updateVehicleFields = {};
        if (request.proposed_vehicle_info) updateVehicleFields.vehicle_info = request.proposed_vehicle_info;
        if (request.proposed_parking_location) updateVehicleFields.parking_location = request.proposed_parking_location;
        let updUserQuery = User.findByIdAndUpdate(request.user_id, updateVehicleFields);
        if (activeSession && typeof updUserQuery.session === 'function') updUserQuery = updUserQuery.session(activeSession);
        await updUserQuery;
      }

      // Lấy cấu hình ca làm việc từ SystemSetting [P2]
      let settingQuery = SystemSetting.findOne({ key: 'global' });
      if (activeSession && typeof settingQuery.session === 'function') settingQuery = settingQuery.session(activeSession);
      if (settingQuery && typeof settingQuery.select === 'function') {
        settingQuery = settingQuery.select('work_end_time ot_start_time');
      }
      if (settingQuery && typeof settingQuery.lean === 'function') settingQuery = settingQuery.lean();
      const systemSetting = await settingQuery || {};
      const workEndTime = systemSetting.work_end_time || '18:30';
      const otStartTime = systemSetting.ot_start_time || '18:30';

      // Tính toán số giờ OT nếu là đơn tăng ca
      let calculatedOtHours = 0;
      if (request.type === 'overtime') {
        if (request.start_time && request.end_time) {
          const otDate = targetDates[0] || request.start_date;
          const startClock = request.start_time.length === 5 ? `${request.start_time}:00` : request.start_time;
          const endClock = request.end_time.length === 5 ? `${request.end_time}:00` : request.end_time;
          const startDateTime = new Date(`${otDate}T${startClock}+07:00`);
          const endDateTime = new Date(`${otDate}T${endClock}+07:00`);
          calculatedOtHours = calculateOT(startDateTime, endDateTime, otStartTime);
          if (calculatedOtHours <= 0) {
            const err = new Error(`Khoảng tăng ca phải có thời gian làm việc sau ${otStartTime}.`);
            err.statusCode = 400;
            throw err;
          }
        } else {
          // Giữ tương thích cho đơn legacy không lưu khoảng giờ.
          calculatedOtHours = 2.0;
        }
      }

      // Đồng bộ tất cả ngày trong targetDates vào Bảng Chấm Công (Attendance)
      for (const d of targetDates) {
        let attItemQuery = Attendance.findOne({ user_id: request.user_id, date: d });
        if (activeSession && typeof attItemQuery.session === 'function') attItemQuery = attItemQuery.session(activeSession);
        let att = await attItemQuery;

        if (att) {
          const currentWorkUnits = Number(att.work_units);
          const holidayWorkUnits = [1.5, 2, 3].includes(currentWorkUnits)
            ? normalizeHolidayMultiplier(currentWorkUnits)
            : null;

          if (request.type === 'forgot_checkout') {
            const proposedTime = request.end_time || request.start_time || workEndTime;
            const [outH, outM] = proposedTime.split(':').map(Number);
            const checkOutDate = new Date(`${d}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+07:00`);
            att.check_out_time = checkOutDate;

            // Tạm thời tổng giờ vẫn là checkout - check-in (chưa trừ nghỉ trưa).
            const metrics = calculateAttendanceMetrics(att.check_in_time, checkOutDate, {
              workEndTime,
              otStartTime,
            });
            att.total_hours = metrics.totalHours;
            att.ot_hours = metrics.otHours;
            att.is_early_leave = metrics.isEarlyLeave;
            att.early_minutes = metrics.earlyMinutes;

            att.status = 'present';
            if (att.work_units == null || att.work_units === 0) {
              att.work_units = (att.is_late && att.late_minutes > 30) ? 0.75 : 1.0;
            }
            att.notes = (att.notes ? att.notes + ' | ' : '') + `Duyệt bổ sung checkout ${proposedTime} (${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (['late', 'early_leave', 'forgot_checkin', 'other'].includes(request.type)) {
            att.is_late = false;
            att.late_minutes = 0;
            att.late_tier = 'on_time';
            att.is_early_leave = false;
            att.early_minutes = 0;
            att.work_units = holidayWorkUnits ?? 1.0;
            att.notes = `Đã duyệt đơn (${TYPE_LABELS[request.type] || request.type}: ${request.reason}) - Hoàn ${holidayWorkUnits ?? 1.0} công`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (['business_trip', 'foreign_trip'].includes(request.type)) {
            att.check_in_type = 'site';
            att.status = 'present';
            att.work_units = holidayWorkUnits ?? 1.0;
            att.is_late = false;
            att.late_minutes = 0;
            att.late_tier = 'on_time';
            att.total_hours = Math.max(att.total_hours || 0, 8.5);
            att.notes = `Đã duyệt công tác (${TYPE_LABELS[request.type] || request.type}: ${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (request.type === 'wfh') {
            att.check_in_type = 'wfh';
            att.status = 'present';
            att.work_units = holidayWorkUnits ?? 1.0;
            att.is_late = false;
            att.late_minutes = 0;
            att.late_tier = 'on_time';
            att.total_hours = Math.max(att.total_hours || 0, 8.5);
            att.notes = `Đã duyệt làm việc từ xa WFH (${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (['annual_leave', 'sick_leave'].includes(request.type)) {
            att.status = 'leave';
            att.work_units = 1.0;
            att.total_hours = 8.5;
            att.is_late = false;
            att.late_minutes = 0;
            att.late_tier = 'on_time';
            att.notes = `Đã duyệt nghỉ phép (${TYPE_LABELS[request.type] || request.type}: ${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (request.type === 'unpaid_leave') {
            att.status = 'leave';
            att.work_units = 0.0;
            att.total_hours = 0;
            att.is_late = false;
            att.late_minutes = 0;
            att.late_tier = 'on_time';
            att.notes = `Đã duyệt nghỉ không lương (KL: ${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          } else if (request.type === 'overtime') {
            // Giờ OT được Admin duyệt là giá trị cuối cùng, không cộng lặp với OT tự động.
            att.ot_hours = calculatedOtHours;
            att.notes = (att.notes ? att.notes + ' | ' : '') + `Duyệt tăng ca OT ${calculatedOtHours}h (${request.reason})`;
            await att.save(activeSession ? { session: activeSession } : undefined);
          }
        } else {
          // Chưa có bản ghi điểm danh trong ngày này -> Tạo mới
          if (['annual_leave', 'sick_leave'].includes(request.type)) {
            const createData = {
              user_id: request.user_id,
              date: d,
              check_in_type: 'office',
              status: 'leave',
              total_hours: 8.5,
              work_units: 1.0,
              is_late: false,
              late_minutes: 0,
              late_tier: 'on_time',
              notes: `Được duyệt đơn: ${TYPE_LABELS[request.type] || request.type} (${request.reason})`,
            };
            await Attendance.create(
              activeSession ? [createData] : createData,
              activeSession ? { session: activeSession } : undefined
            );
          } else if (request.type === 'unpaid_leave') {
            const createData = {
              user_id: request.user_id,
              date: d,
              check_in_type: 'office',
              status: 'leave',
              total_hours: 0,
              work_units: 0.0,
              is_late: false,
              late_minutes: 0,
              late_tier: 'on_time',
              notes: `Được duyệt đơn: ${TYPE_LABELS[request.type] || request.type} (${request.reason})`,
            };
            await Attendance.create(
              activeSession ? [createData] : createData,
              activeSession ? { session: activeSession } : undefined
            );
          } else if (['business_trip', 'foreign_trip'].includes(request.type)) {
            const createData = {
              user_id: request.user_id,
              date: d,
              check_in_type: 'site',
              status: 'present',
              total_hours: 8.5,
              work_units: 1.0,
              is_late: false,
              late_minutes: 0,
              late_tier: 'on_time',
              notes: `Được duyệt công tác: ${TYPE_LABELS[request.type] || request.type} (${request.reason})`,
            };
            await Attendance.create(
              activeSession ? [createData] : createData,
              activeSession ? { session: activeSession } : undefined
            );
          } else if (request.type === 'wfh') {
            const createData = {
              user_id: request.user_id,
              date: d,
              check_in_type: 'wfh',
              status: 'present',
              total_hours: 8.5,
              work_units: 1.0,
              is_late: false,
              late_minutes: 0,
              late_tier: 'on_time',
              notes: `Được duyệt WFH: ${request.reason}`,
            };
            await Attendance.create(
              activeSession ? [createData] : createData,
              activeSession ? { session: activeSession } : undefined
            );
          }
        }
      }

      // Cập nhật trạng thái Request và lưu snapshot_before
      request.status = 'approved';
      request.approved_by = req.user._id;
      request.approved_at = new Date();
      request.reviewer_note = reviewer_note ? reviewer_note.trim() : 'Đã duyệt';
      request.snapshot_before = {
        attendance_records: attSnapshots,
        user_vehicle: userVehicleSnapshot,
        calculated_ot_hours: calculatedOtHours,
      };
      await request.save(activeSession ? { session: activeSession } : undefined);
      updatedRequestDoc = request;
    };

    // 5. Thực thi Transaction bảo vệ nghiêm ngặt [P1]
    if (useCallbackTx && session) {
      await session.withTransaction(async () => {
        await executeMutation(session);
      });
      isCommitted = true;
    } else if (hasManualTx && session) {
      session.startTransaction();
      await executeMutation(session);
      try {
        await session.commitTransaction();
        isCommitted = true;
      } catch (commitErr) {
        if (commitErr.hasErrorLabel && commitErr.hasErrorLabel('UnknownTransactionCommitResult')) {
          try {
            await session.commitTransaction();
            isCommitted = true;
          } catch (retryErr) {
            console.error('Retry commit transaction failed:', retryErr);
            throw commitErr;
          }
        } else {
          throw commitErr;
        }
      }
    } else if (topologyStatus.isTestEnv && !session) {
      // Chỉ in-memory unit test mock không cung cấp startSession mới chạy trực tiếp
      await executeMutation(null);
      isCommitted = true;
    } else {
      return res.status(500).json({
        error: 'Lỗi bảo mật giao dịch: Hệ thống bắt buộc thực thi trong phiên giao dịch ACID (ReplicaSet). Thao tác bị hủy theo chính sách Fail-Closed.',
      });
    }
  } catch (error) {
    if (!isCommitted && session && !useCallbackTx && hasManualTx) {
      try { await session.abortTransaction(); } catch (_) {}
    }
    console.error('ApproveRequest error:', error);
    // [P2] Bảo mật thông tin: Không trả chi tiết lỗi DB nội bộ cho client ở mã lỗi 500
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Lỗi duyệt đơn: Hệ thống xử lý giao dịch gặp sự cố.' });
  } finally {
    if (session) {
      try { await session.endSession(); } catch (endErr) { console.warn('End session warning:', endErr); }
    }
  }

  // 6. [P2] Post-Commit Isolation: Không gây lỗi 500 cho client khi dữ liệu đã commit thành công
  try {
    await Notification.create({
      user_id: initialReq.user_id,
      title: '✅ Đơn của bạn đã được duyệt!',
      message: `Đơn ${TYPE_LABELS[initialReq.type] || initialReq.type} ngày ${initialReq.start_date} đã được duyệt!`,
      type: 'request',
      link: '/requests',
    });

    logAction({
      performed_by: req.user._id,
      action: 'REQUEST_APPROVED',
      target_model: 'Request',
      target_id: initialReq._id,
      description: `Duyệt đơn ${TYPE_LABELS[initialReq.type]} của nhân viên`,
      req,
    });
  } catch (postCommitErr) {
    console.error('Post-commit notification/audit error:', postCommitErr);
  }

  // [P3] Trả về đối tượng Request đã cập nhật trạng thái mới nhất
  const responseData = updatedRequestDoc
    ? (updatedRequestDoc.toObject ? updatedRequestDoc.toObject() : updatedRequestDoc)
    : { ...initialReq.toObject ? initialReq.toObject() : initialReq, status: 'approved' };

  return res.json({
    message: 'Đã duyệt đơn và cập nhật bảng công thành công ✅',
    request: responseData,
  });
};

// PUT /api/requests/:id/reject
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewer_note } = req.body;

    if (!reviewer_note || !reviewer_note.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối.' });
    }

    const request = await Request.findOne({ _id: id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hoặc đơn đã được xử lý.' });
    }

    // [P1] RBAC: Chỉ Admin mới có quyền từ chối đơn forgot_checkout
    if (request.type === 'forgot_checkout' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền từ chối đơn bổ sung giờ checkout.' });
    }

    if (isLeaderRole(req.user) && !(await canManageUserId(req.user, request.user_id))) {
      return res.status(403).json({ error: 'Bạn chỉ được từ chối đơn của nhân sự thuộc nhóm mình quản lý.' });
    }

    request.status = 'rejected';
    request.approved_by = req.user._id;
    request.approved_at = new Date();
    request.reviewer_note = reviewer_note.trim();
    await request.save();

    // Post-action notifications
    try {
      await Notification.create({
        user_id: request.user_id,
        title: '❌ Đơn của bạn bị từ chối',
        message: `Đơn ${TYPE_LABELS[request.type] || request.type} ngày ${request.start_date} đã bị từ chối. Lý do: ${reviewer_note}`,
        type: 'request',
        link: '/requests',
      });

      logAction({
        performed_by: req.user._id,
        action: 'REQUEST_REJECTED',
        target_model: 'Request',
        target_id: request._id,
        description: `Từ chối đơn ${TYPE_LABELS[request.type]}: ${reviewer_note}`,
        req,
      });
    } catch (_) {}

    const responseData = request.toObject ? request.toObject() : request;
    res.json({ message: 'Đã từ chối đơn ❌', request: responseData });
  } catch (error) {
    console.error('RejectRequest error:', error);
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Lỗi từ chối đơn: Hệ thống xử lý gặp sự cố.' });
  }
};

// PUT /api/requests/:id/revert - Hoàn tác trạng thái đơn về Chờ duyệt (Pending)
const revertRequest = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // 1. Fail-Fast: Kiểm tra trạng thái kết nối & topology trước mọi thao tác DB [P1, P2]
  const topologyStatus = getTopologyStatus();
  if (topologyStatus.requiresTransaction && (topologyStatus.readyState !== 1 || typeof mongoose.startSession !== 'function')) {
    return res.status(500).json({
      error: 'Lỗi kết nối cơ sở dữ liệu: Trạng thái kết nối MongoDB không khả dụng để thiết lập phiên giao dịch an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
    });
  }

  let session = null;
  let useCallbackTx = false;
  let hasManualTx = false;

  try {
    if (topologyStatus.requiresTransaction) {
      try {
        session = await mongoose.startSession();
        if (!session) {
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session). Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
        useCallbackTx = typeof session.withTransaction === 'function';
        hasManualTx = typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function';
        if (!useCallbackTx && !hasManualTx) {
          try { await session.endSession(); } catch (_) {}
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch thiếu phương thức transaction hợp lệ. Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
      } catch (sessInitErr) {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Không thể khởi tạo phiên giao dịch an toàn trên MongoDB Atlas. Yêu cầu bị hủy theo chính sách Fail-Closed.',
        });
      }
    } else if (topologyStatus.isTestEnv && typeof mongoose.startSession === 'function') {
      try {
        session = await mongoose.startSession();
        useCallbackTx = Boolean(session && typeof session.withTransaction === 'function');
        hasManualTx = Boolean(session && typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function');
      } catch (_) {
        session = null;
        useCallbackTx = false;
        hasManualTx = false;
      }
    } else {
      session = null;
      useCallbackTx = false;
      hasManualTx = false;
    }
  } catch (initErr) {
    console.error('Session init error in revert:', initErr);
    return res.status(500).json({ error: 'Lỗi khởi tạo phiên làm việc cơ sở dữ liệu.' });
  }

  let isCommitted = false;
  let updatedRequestDoc = null;
  let initialReq = null;

  try {
    // 2. Đọc và kiểm tra quyền trên đơn
    initialReq = await Request.findById(id);
    if (!initialReq) {
      return res.status(404).json({ error: 'Không tìm thấy đơn.' });
    }

    const isOwner = initialReq.user_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);

    // [P1] RBAC: forgot_checkout chỉ Admin được hoàn tác
    if (initialReq.type === 'forgot_checkout' && !isAdmin) {
      return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền hoàn tác đơn bổ sung giờ checkout.' });
    }

    // [P1] PHÂN QUYỀN HOÀN TÁC: Nhân viên KHÔNG ĐƯỢC tự hoàn tác đơn đã duyệt
    if (initialReq.status === 'approved') {
      if (!isAdmin && !isLeader) {
        return res.status(403).json({ error: 'Chỉ Quản lý hoặc Admin mới có quyền hoàn tác đơn đã được phê duyệt.' });
      }

      if (isLeader) {
        const targetUser = await User.findById(initialReq.user_id);
        if (targetUser && targetUser.role === 'admin') {
          return res.status(403).json({ error: 'Leader không có quyền hoàn tác đơn của Admin.' });
        }
        if (!(await canManageUserId(req.user, initialReq.user_id))) {
          return res.status(403).json({ error: 'Bạn chỉ được hoàn tác đơn của nhân sự thuộc nhóm mình quản lý.' });
        }
      }
    } else {
      if (!isOwner && !isAdmin) {
        const canManage = isLeader && await canManageUserId(req.user, initialReq.user_id);
        if (!canManage) {
          return res.status(403).json({ error: 'Bạn không có quyền hoàn tác đơn này.' });
        }
      }
    }

    const targetDates = (initialReq.type === 'forgot_checkout') ? [initialReq.start_date] : getDatesInRange(initialReq.start_date, initialReq.end_date);

    // 3. Pre-init lock documents
    await preInitTimesheetLocks(targetDates, initialReq.user_id);

    // 4. Định nghĩa khối Mutation
    const executeMutation = async (activeSession) => {
      let reqQuery = Request.findById(id);
      if (activeSession && typeof reqQuery.session === 'function') reqQuery = reqQuery.session(activeSession);
      const request = await reqQuery;

      if (!request) {
        const err = new Error('Không tìm thấy đơn.');
        err.statusCode = 404;
        throw err;
      }

      // Write-Intent Guard kiểm tra & khóa TimesheetLock trong Transaction Session [P1]
      await guardTimesheetLocksInTx(targetDates, request.user_id, activeSession);

      // Nếu đơn trước đó đã được approved: hoàn nguyên snapshot 100% [P1]
      if (request.status === 'approved') {
        await restoreRequestSnapshot(request, activeSession);
      }

      const previousStatus = request.status;
      request.status = 'pending';
      request.approved_by = null;
      request.approved_at = null;
      request.snapshot_before = null;
      request.reviewer_note = reason ? `Đã hoàn tác (Lý do: ${reason})` : 'Đã hoàn tác về chờ duyệt';
      await request.save(activeSession ? { session: activeSession } : undefined);
      updatedRequestDoc = request;
    };

    if (useCallbackTx && session) {
      await session.withTransaction(async () => {
        await executeMutation(session);
      });
      isCommitted = true;
    } else if (hasManualTx && session) {
      session.startTransaction();
      await executeMutation(session);
      try {
        await session.commitTransaction();
        isCommitted = true;
      } catch (commitErr) {
        if (commitErr.hasErrorLabel && commitErr.hasErrorLabel('UnknownTransactionCommitResult')) {
          try {
            await session.commitTransaction();
            isCommitted = true;
          } catch (retryErr) {
            console.error('Retry commit transaction failed:', retryErr);
            throw commitErr;
          }
        } else {
          throw commitErr;
        }
      }
    } else if (topologyStatus.isTestEnv && !session) {
      await executeMutation(null);
      isCommitted = true;
    } else {
      return res.status(500).json({
        error: 'Lỗi bảo mật giao dịch: Hệ thống bắt buộc thực thi trong phiên giao dịch ACID (ReplicaSet). Thao tác bị hủy theo chính sách Fail-Closed.',
      });
    }
  } catch (error) {
    if (!isCommitted && session && !useCallbackTx && hasManualTx) {
      try { await session.abortTransaction(); } catch (_) {}
    }
    console.error('RevertRequest error:', error);
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Lỗi hoàn tác đơn: Hệ thống xử lý gặp sự cố.' });
  } finally {
    if (session) {
      try { await session.endSession(); } catch (endErr) { console.warn('End session warning:', endErr); }
    }
  }

  // [P2] Post-Commit Isolation
  try {
    if (initialReq.user_id.toString() !== req.user._id.toString()) {
      await Notification.create({
        user_id: initialReq.user_id,
        title: '🔄 Đơn đã được chuyển về Chờ duyệt',
        message: `Đơn ${TYPE_LABELS[initialReq.type] || initialReq.type} ngày ${initialReq.start_date} đã được quản lý chuyển về trạng thái Chờ duyệt để xem xét lại.`,
        type: 'request',
        link: '/requests',
      });
    }

    logAction({
      performed_by: req.user._id,
      action: 'REQUEST_REVERTED',
      target_model: 'Request',
      target_id: initialReq._id,
      description: `Hoàn tác đơn ${TYPE_LABELS[initialReq.type]} từ ${initialReq.status} về pending`,
      req,
    });
  } catch (_) {}

  // [P3] Trả về đối tượng Request mới nhất
  const responseData = updatedRequestDoc
    ? (updatedRequestDoc.toObject ? updatedRequestDoc.toObject() : updatedRequestDoc)
    : { ...initialReq.toObject ? initialReq.toObject() : initialReq, status: 'pending' };

  return res.json({ message: 'Đã hoàn tác đơn về trạng thái Chờ duyệt thành công! 🔄', request: responseData });
};

// DELETE /api/requests/:id - Xóa đơn
const deleteRequest = async (req, res) => {
  const { id } = req.params;

  // 1. Fail-Fast connection & topology check
  const topologyStatus = getTopologyStatus();
  if (topologyStatus.requiresTransaction && (topologyStatus.readyState !== 1 || typeof mongoose.startSession !== 'function')) {
    return res.status(500).json({
      error: 'Lỗi kết nối cơ sở dữ liệu: Trạng thái kết nối MongoDB không khả dụng để thiết lập phiên giao dịch an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
    });
  }

  let session = null;
  let useCallbackTx = false;
  let hasManualTx = false;

  try {
    if (topologyStatus.requiresTransaction) {
      try {
        session = await mongoose.startSession();
        if (!session) {
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session). Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
        useCallbackTx = typeof session.withTransaction === 'function';
        hasManualTx = typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function';
        if (!useCallbackTx && !hasManualTx) {
          try { await session.endSession(); } catch (_) {}
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch thiếu phương thức transaction hợp lệ. Yêu cầu bị hủy theo chính sách Fail-Closed.',
          });
        }
      } catch (sessInitErr) {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Không thể khởi tạo phiên giao dịch an toàn trên MongoDB Atlas. Yêu cầu bị hủy theo chính sách Fail-Closed.',
        });
      }
    } else if (topologyStatus.isTestEnv && typeof mongoose.startSession === 'function') {
      try {
        session = await mongoose.startSession();
        useCallbackTx = Boolean(session && typeof session.withTransaction === 'function');
        hasManualTx = Boolean(session && typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function');
      } catch (_) {
        session = null;
        useCallbackTx = false;
        hasManualTx = false;
      }
    } else {
      session = null;
      useCallbackTx = false;
      hasManualTx = false;
    }
  } catch (initErr) {
    console.error('Session init error in delete:', initErr);
    return res.status(500).json({ error: 'Lỗi khởi tạo phiên làm việc cơ sở dữ liệu.' });
  }

  let isCommitted = false;
  let initialReq = null;

  try {
    // 2. Đọc và kiểm tra quyền
    initialReq = await Request.findById(id);
    if (!initialReq) {
      return res.status(404).json({ error: 'Không tìm thấy đơn.' });
    }

    const isOwner = initialReq.user_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);

    // Nhân viên chỉ được xóa đơn của mình khi chưa duyệt (pending)
    if (isOwner && !isAdmin && !isLeader && initialReq.status === 'approved') {
      return res.status(403).json({ error: 'Không thể xóa đơn đã được duyệt. Vui lòng liên hệ Quản lý để hoàn tác trước.' });
    }

    if (!isOwner && !isAdmin) {
      const canManage = isLeader && await canManageUserId(req.user, initialReq.user_id);
      if (!canManage) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa đơn này.' });
      }
    }

    const targetDates = (initialReq.type === 'forgot_checkout') ? [initialReq.start_date] : getDatesInRange(initialReq.start_date, initialReq.end_date);

    // 3. Pre-init lock documents
    if (initialReq.status === 'approved') {
      await preInitTimesheetLocks(targetDates, initialReq.user_id);
    }

    // 4. Mutation
    const executeMutation = async (activeSession) => {
      let reqQuery = Request.findById(id);
      if (activeSession && typeof reqQuery.session === 'function') reqQuery = reqQuery.session(activeSession);
      const request = await reqQuery;

      if (!request) {
        const err = new Error('Không tìm thấy đơn.');
        err.statusCode = 404;
        throw err;
      }

      // Kiểm tra Khóa Bảng Công (TimesheetLock) nếu đơn đã duyệt [P1]
      if (request.status === 'approved') {
        await guardTimesheetLocksInTx(targetDates, request.user_id, activeSession);
        await restoreRequestSnapshot(request, activeSession);
      }

      let delQuery = Request.findByIdAndDelete(id);
      if (activeSession && typeof delQuery.session === 'function') delQuery = delQuery.session(activeSession);
      await delQuery;
    };

    if (useCallbackTx && session) {
      await session.withTransaction(async () => {
        await executeMutation(session);
      });
      isCommitted = true;
    } else if (hasManualTx && session) {
      session.startTransaction();
      await executeMutation(session);
      try {
        await session.commitTransaction();
        isCommitted = true;
      } catch (commitErr) {
        if (commitErr.hasErrorLabel && commitErr.hasErrorLabel('UnknownTransactionCommitResult')) {
          try {
            await session.commitTransaction();
            isCommitted = true;
          } catch (retryErr) {
            console.error('Retry commit transaction failed:', retryErr);
            throw commitErr;
          }
        } else {
          throw commitErr;
        }
      }
    } else if (topologyStatus.isTestEnv && !session) {
      await executeMutation(null);
      isCommitted = true;
    } else {
      return res.status(500).json({
        error: 'Lỗi bảo mật giao dịch: Hệ thống bắt buộc thực thi trong phiên giao dịch ACID (ReplicaSet). Thao tác bị hủy theo chính sách Fail-Closed.',
      });
    }
  } catch (error) {
    if (!isCommitted && session && !useCallbackTx && hasManualTx) {
      try { await session.abortTransaction(); } catch (_) {}
    }
    console.error('DeleteRequest error:', error);
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Lỗi xóa đơn: Hệ thống xử lý gặp sự cố.' });
  } finally {
    if (session) {
      try { await session.endSession(); } catch (endErr) { console.warn('End session warning:', endErr); }
    }
  }

  // [P2] Post-Commit Isolation
  try {
    logAction({
      performed_by: req.user._id,
      action: 'REQUEST_DELETED',
      target_model: 'Request',
      target_id: id,
      description: `Xóa đơn ${TYPE_LABELS[initialReq.type] || initialReq.type} ngày ${initialReq.start_date}`,
      req,
    });
  } catch (_) {}

  return res.json({ message: 'Đã xóa đơn thành công! 🗑️', deleted_id: id });
};

module.exports = {
  getMyRequests,
  createRequest,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  revertRequest,
  deleteRequest,
  restoreRequestSnapshot,
  guardTimesheetLocksInTx,
  getTopologyStatus,
};
