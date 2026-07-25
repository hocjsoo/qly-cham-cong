// controllers/requestController.js - Request Controller với xử lý tác động bảng công & điểm danh
const Request = require('../models/Request');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');
const { deductLeaveOnApproval } = require('./leaveBalanceController');

const VALID_TYPES = ['late', 'early_leave', 'overtime', 'business_trip', 'sick_leave', 'annual_leave', 'other'];

const TYPE_LABELS = {
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  overtime: 'Tăng ca',
  business_trip: 'Đi công tác / WFH',
  sick_leave: 'Nghỉ ốm',
  annual_leave: 'Nghỉ phép',
  other: 'Lý do khác',
};

// GET /api/requests
const getMyRequests = async (req, res) => {
  const { status, type } = req.query;

  try {
    const filter = { user_id: req.user._id };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const requests = await Request.find(filter)
      .populate('approved_by', 'full_name')
      .sort({ created_at: -1 });

    res.json(requests);
  } catch (error) {
    console.error('GetMyRequests error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn.' });
  }
};

// POST /api/requests
const createRequest = async (req, res) => {
  const { type, start_date, end_date, start_time, end_time, reason, project_id, project_name } = req.body;
  const userId = req.user._id;

  if (!type || !start_date || !reason) {
    return res.status(400).json({ error: 'Thiếu thông tin: loại đơn, ngày bắt đầu và lý do là bắt buộc.' });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Loại đơn không hợp lệ.` });
  }

  if (reason.trim().length < 3) {
    return res.status(400).json({ error: 'Lý do giải trình quá ngắn.' });
  }

  try {
    // Kiểm tra trùng đơn ngày này
    const existing = await Request.findOne({
      user_id: userId,
      type,
      start_date,
      status: { $in: ['pending', 'approved'] },
    });

    if (existing) {
      return res.status(409).json({ error: `Bạn đã có đơn "${TYPE_LABELS[type]}" cho ngày ${start_date} đang chờ hoặc đã duyệt.` });
    }

    const request = await Request.create({
      user_id: userId,
      type,
      start_date,
      end_date: end_date || start_date,
      start_time: start_time || null,
      end_time: end_time || null,
      reason: reason.trim(),
      attachment_url: project_id || null,
    });

    // Gửi thông báo đến tất cả Admin & Trưởng phòng để duyệt đơn
    const managers = await User.find({ role: { $in: ['admin', 'manager'] } }).select('_id');
    const senderName = req.user.full_name || 'Nhân viên';
    
    for (const m of managers) {
      if (m._id.toString() !== userId.toString()) {
        await Notification.create({
          user_id: m._id,
          title: `📝 Đơn từ mới cần duyệt: ${senderName}`,
          message: `${senderName} vừa gửi đơn "${TYPE_LABELS[type]}" ngày ${start_date}. Lý do: "${reason.trim()}"`,
          type: 'request',
          link: '/requests',
        });
      }
    }

    // Thông báo xác nhận cho chính nhân viên tạo đơn
    await Notification.create({
      user_id: userId,
      title: `📝 Đã gửi đơn thành công`,
      message: `Đơn "${TYPE_LABELS[type]}" ngày ${start_date} của bạn đã được gửi và đang chờ quản lý duyệt.`,
      type: 'request',
      link: '/requests',
    });

    res.status(201).json({
      message: `Gửi đơn "${TYPE_LABELS[type]}" thành công! Đang chờ duyệt.`,
      request,
    });

  } catch (error) {
    console.error('CreateRequest error:', error);
    res.status(500).json({ error: 'Lỗi tạo đơn.' });
  }
};

// GET /api/requests/pending (Manager xem team, Admin xem tất cả)
const getPendingRequests = async (req, res) => {
  try {
    let requests;
    if (req.user.role === 'admin') {
      requests = await Request.find({ status: 'pending' })
        .populate('user_id', 'full_name email department_id')
        .sort({ created_at: -1 });
    } else {
      const teamUserIds = await User.find({
        $or: [
          { manager_id: req.user._id },
          { department_id: req.user.department_id }
        ]
      }).distinct('_id');

      requests = await Request.find({ status: 'pending', user_id: { $in: teamUserIds } })
        .populate('user_id', 'full_name email department_id')
        .sort({ created_at: -1 });
    }

    const formatted = requests.map(r => {
      const obj = r.toObject();
      return {
        ...obj,
        id: obj._id,
        user_name: obj.user_id?.full_name,
        email: obj.user_id?.email,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('GetPendingRequests error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn chờ duyệt.' });
  }
};

// PUT /api/requests/:id/approve
const approveRequest = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  try {
    const request = await Request.findOne({ _id: id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hoặc đơn đã được xử lý.' });
    }

    request.status = 'approved';
    request.approved_by = req.user._id;
    request.approved_at = new Date();
    request.reviewer_note = reviewer_note || 'Đã duyệt ✅';
    await request.save();

    // 1. Trừ ngày phép nếu là đơn nghỉ
    if (['annual_leave', 'sick_leave'].includes(request.type)) {
      await deductLeaveOnApproval(request.user_id, request.type, request.start_date, request.end_date);
    }

    // 2. Tự động xóa phạt muộn & cập nhật bảng công nếu duyệt đơn giải trình đi muộn/công tác
    let att = await Attendance.findOne({ user_id: request.user_id, date: request.start_date });
    if (att) {
      if (['late', 'business_trip'].includes(request.type)) {
        att.is_late = false;
        att.late_tier = 'on_time';
        att.notes = `Đã duyệt đơn giải trình (${request.reason})`;
        await att.save();
      }
    } else if (['annual_leave', 'sick_leave', 'business_trip'].includes(request.type)) {
      // Tạo bản ghi điểm danh phép/công tác để tính công đủ
      await Attendance.create({
        user_id: request.user_id,
        date: request.start_date,
        check_in_type: request.type === 'business_trip' ? 'wfh' : 'office',
        status: request.type === 'business_trip' ? 'present' : 'leave',
        total_hours: 8,
        is_late: false,
        late_tier: 'on_time',
        notes: `Được duyệt đơn ${TYPE_LABELS[request.type]}`,
      });
    }

    // 3. Gửi thông báo cho Nhân viên
    await Notification.create({
      user_id: request.user_id,
      title: '✅ Đơn của bạn đã được duyệt',
      message: `Đơn ${TYPE_LABELS[request.type] || request.type} ngày ${request.start_date} đã được duyệt!`,
      type: 'request',
      link: '/requests',
    });

    // Audit log
    logAction({
      performed_by: req.user._id,
      action: 'REQUEST_APPROVED',
      target_model: 'Request',
      target_id: request._id,
      description: `Duyệt đơn ${TYPE_LABELS[request.type]} của nhân viên`,
      req,
    });

    res.json({ message: 'Đã duyệt đơn và cập nhật bảng công thành công ✅', request });

  } catch (error) {
    console.error('ApproveRequest error:', error);
    res.status(500).json({ error: 'Lỗi duyệt đơn.' });
  }
};

// PUT /api/requests/:id/reject
const rejectRequest = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  if (!reviewer_note || !reviewer_note.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối.' });
  }

  try {
    const request = await Request.findOne({ _id: id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hoặc đơn đã được xử lý.' });
    }

    request.status = 'rejected';
    request.approved_by = req.user._id;
    request.approved_at = new Date();
    request.reviewer_note = reviewer_note.trim();
    await request.save();

    // Gửi thông báo cho Nhân viên
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

    res.json({ message: 'Đã từ chối đơn ❌', request });
  } catch (error) {
    console.error('RejectRequest error:', error);
    res.status(500).json({ error: 'Lỗi từ chối đơn.' });
  }
};

module.exports = { getMyRequests, createRequest, getPendingRequests, approveRequest, rejectRequest };
