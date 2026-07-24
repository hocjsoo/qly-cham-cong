// controllers/correctionController.js - Xử lý đính chính giờ chấm công
const Correction = require('../models/Correction');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

// POST /api/corrections - Tạo yêu cầu đính chính
const createCorrection = async (req, res) => {
  const { date, field, proposed_check_in, proposed_check_out, reason } = req.body;

  if (!date || !field || !reason) {
    return res.status(400).json({ error: 'Ngày, trường cần sửa và lý do là bắt buộc.' });
  }

  try {
    // Tìm bản ghi chấm công ngày đó nếu có
    const att = await Attendance.findOne({ user_id: req.user._id, date });

    const correction = await Correction.create({
      user_id: req.user._id,
      attendance_id: att ? att._id : null,
      date,
      field,
      original_check_in: att ? att.check_in_time : null,
      original_check_out: att ? att.check_out_time : null,
      proposed_check_in: proposed_check_in ? new Date(proposed_check_in) : null,
      proposed_check_out: proposed_check_out ? new Date(proposed_check_out) : null,
      reason: reason.trim(),
    });

    res.status(201).json({
      message: 'Đã gửi yêu cầu đính chính giờ chấm công ⏳',
      correction,
    });
  } catch (error) {
    console.error('CreateCorrection error:', error);
    res.status(500).json({ error: 'Lỗi tạo yêu cầu đính chính.' });
  }
};

// GET /api/corrections - Lấy danh sách đính chính (User xem của mình, Admin/Manager xem tất cả)
const getCorrections = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'staff') {
      query.user_id = req.user._id;
    } else if (req.user.role === 'manager') {
      const staffIds = await User.find({ manager_id: req.user._id }).distinct('_id');
      query.user_id = { $in: [...staffIds, req.user._id] };
    }

    const corrections = await Correction.find(query)
      .populate('user_id', 'full_name email department_id')
      .populate('reviewed_by', 'full_name')
      .sort({ created_at: -1 });

    res.json(corrections);
  } catch (error) {
    console.error('GetCorrections error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đính chính.' });
  }
};

// PUT /api/corrections/:id/approve - Admin/Manager duyệt đính chính
const approveCorrection = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  try {
    const corr = await Correction.findOne({ _id: id, status: 'pending' });
    if (!corr) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu hoặc đã được xử lý.' });
    }

    corr.status = 'approved';
    corr.reviewed_by = req.user._id;
    corr.reviewed_at = new Date();
    corr.reviewer_note = reviewer_note || 'Đã chấp nhận đính chính ✅';
    await corr.save();

    // Cập nhật hoặc tạo bản ghi Attendance tương ứng
    let att = await Attendance.findOne({ user_id: corr.user_id, date: corr.date });
    const newIn = corr.proposed_check_in || (att ? att.check_in_time : null);
    const newOut = corr.proposed_check_out || (att ? att.check_out_time : null);

    let totalHours = 0;
    if (newIn && newOut) {
      totalHours = parseFloat(((new Date(newOut) - new Date(newIn)) / (1000 * 60 * 60)).toFixed(1));
    }

    if (!att) {
      att = await Attendance.create({
        user_id: corr.user_id,
        date: corr.date,
        check_in_time: newIn,
        check_out_time: newOut,
        check_in_type: 'office',
        total_hours: Math.max(0, totalHours),
        is_late: false,
        notes: `Đính chính bởi Admin: ${corr.reason}`,
      });
    } else {
      if (newIn) att.check_in_time = newIn;
      if (newOut) att.check_out_time = newOut;
      att.total_hours = Math.max(0, totalHours);
      att.notes = `${att.notes || ''} | Đính chính: ${corr.reason}`.trim();
      await att.save();
    }

    // Ghi Audit Log
    logAction({
      performed_by: req.user._id,
      action: 'CORRECTION_APPROVED',
      target_model: 'Correction',
      target_id: corr._id,
      description: `Duyệt đính chính giờ ngày ${corr.date}`,
      new_values: { proposed_check_in: newIn, proposed_check_out: newOut },
      req,
    });

    res.json({ message: 'Đã duyệt và cập nhật giờ chấm công thành công ✅', correction: corr, attendance: att });
  } catch (error) {
    console.error('ApproveCorrection error:', error);
    res.status(500).json({ error: 'Lỗi duyệt đính chính.' });
  }
};

// PUT /api/corrections/:id/reject - Admin/Manager từ chối đính chính
const rejectCorrection = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  if (!reviewer_note || !reviewer_note.trim()) {
    return res.status(400).json({ error: 'Lý do từ chối là bắt buộc.' });
  }

  try {
    const corr = await Correction.findOne({ _id: id, status: 'pending' });
    if (!corr) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu hoặc đã được xử lý.' });
    }

    corr.status = 'rejected';
    corr.reviewed_by = req.user._id;
    corr.reviewed_at = new Date();
    corr.reviewer_note = reviewer_note.trim();
    await corr.save();

    // Ghi Audit Log
    logAction({
      performed_by: req.user._id,
      action: 'CORRECTION_REJECTED',
      target_model: 'Correction',
      target_id: corr._id,
      description: `Từ chối đính chính ngày ${corr.date}: ${reviewer_note}`,
      req,
    });

    res.json({ message: 'Đã từ chối yêu cầu đính chính ❌', correction: corr });
  } catch (error) {
    console.error('RejectCorrection error:', error);
    res.status(500).json({ error: 'Lỗi từ chối đính chính.' });
  }
};

module.exports = { createCorrection, getCorrections, approveCorrection, rejectCorrection };
