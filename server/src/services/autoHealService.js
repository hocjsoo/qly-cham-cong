// server/src/services/autoHealService.js
// Nghiệp vụ Auto-Heal & Đóng Ca Quá Khứ Tự Động (Bàn tròn 17)

const Attendance = require('../models/Attendance');
const Request = require('../models/Request');
const TimesheetLock = require('../models/TimesheetLock');
const SystemSetting = require('../models/SystemSetting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getVnDateString, calculateAttendanceMetrics } = require('../utils/attendanceCalculations');

const normalizeWorkEndTime = (value) => (
  /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim())
    ? String(value).trim()
    : '18:30'
);

const AUTO_HEAL_NOTE = 'RT17-AUTO-HEAL: Tự động khép tạm do quên checkout — chờ giải trình & Admin hậu kiểm';

/**
 * Khép ca quá khứ đã được Admin duyệt nhưng chưa ghi nhận giờ ra
 */
const closePastShiftApprovedByAdmin = async (
  attendance,
  { reviewerRole = null, save = true } = {}
) => {
  if (
    !attendance ||
    attendance.check_out_time ||
    !attendance.check_in_time ||
    attendance.date >= getVnDateString(new Date()) ||
    attendance.verification_status !== 'approved'
  ) {
    return false;
  }

  let effectiveReviewerRole = reviewerRole;
  if (!effectiveReviewerRole && attendance.reviewed_by) {
    let reviewerQuery = User.findById(attendance.reviewed_by);
    if (reviewerQuery && typeof reviewerQuery.select === 'function') reviewerQuery = reviewerQuery.select('role');
    if (reviewerQuery && typeof reviewerQuery.lean === 'function') reviewerQuery = reviewerQuery.lean();
    const reviewer = await reviewerQuery;
    effectiveReviewerRole = reviewer?.role;
  }
  if (effectiveReviewerRole !== 'admin') return false;

  const [shiftYear, shiftMonth] = String(attendance.date).split('-').map(Number);
  let lockQuery = TimesheetLock.findOne({
    month: shiftMonth,
    year: shiftYear,
    is_locked: true,
    $or: [{ user_id: null }, { user_id: attendance.user_id }],
  });
  if (lockQuery && typeof lockQuery.select === 'function') lockQuery = lockQuery.select('_id');
  if (lockQuery && typeof lockQuery.lean === 'function') lockQuery = lockQuery.lean();
  if (await lockQuery) return false;

  let settingsQuery = SystemSetting.findOne({ key: 'global' });
  if (settingsQuery && typeof settingsQuery.select === 'function') settingsQuery = settingsQuery.select('work_end_time');
  if (settingsQuery && typeof settingsQuery.lean === 'function') settingsQuery = settingsQuery.lean();
  const settings = await settingsQuery;
  const workEndTime = normalizeWorkEndTime(settings?.work_end_time);

  const checkInTime = new Date(attendance.check_in_time);
  let checkOutTime = new Date(`${attendance.date}T${workEndTime}:00+07:00`);
  if (Number.isNaN(checkInTime.getTime())) return false;

  if (Number.isNaN(checkOutTime.getTime()) || checkOutTime <= checkInTime) {
    checkOutTime = new Date(checkInTime.getTime() + 60 * 1000);
  }

  const metrics = calculateAttendanceMetrics(checkInTime, checkOutTime, {
    workEndTime,
    otStartTime: workEndTime,
  });

  attendance.check_out_time = checkOutTime;
  attendance.check_out_note = `Tự động chốt ca lúc ${workEndTime} do Admin đã duyệt ngày công`;
  attendance.total_hours = metrics.totalHours;
  attendance.is_early_leave = false;
  attendance.early_minutes = 0;
  attendance.is_overnight = metrics.isOvernight;
  attendance.auto_checkout = true;
  attendance.ot_hours = 0;
  attendance.ot_hours_proposed = 0;
  attendance.ot_status = 'none';

  if (save) await attendance.save();
  return true;
};

/**
 * Tự động khép tạm ca hôm trước bị quên checkout, sinh đơn giải trình để Admin hậu kiểm
 */
const healUnclosedShiftForCheckin = async (shift, now) => {
  const shiftDateStr = String(shift?.date || '');
  const [shiftYear, shiftMonth] = shiftDateStr.split('-').map(Number);
  if (!shift || shift.check_out_time || !shift.check_in_time || !shiftYear || !shiftMonth) return 'closed';

  let pendingHealQuery = Request.findOne({
    source_attendance_id: shift._id,
    type: 'forgot_checkout',
    status: 'pending',
  });
  if (pendingHealQuery && typeof pendingHealQuery.lean === 'function') pendingHealQuery = pendingHealQuery.lean();
  const existingHealRequest = await pendingHealQuery;

  let lockQuery = TimesheetLock.findOne({
    month: shiftMonth,
    year: shiftYear,
    is_locked: true,
    $or: [{ user_id: null }, { user_id: shift.user_id }],
  });
  if (lockQuery && typeof lockQuery.select === 'function') lockQuery = lockQuery.select('_id');
  if (lockQuery && typeof lockQuery.lean === 'function') lockQuery = lockQuery.lean();
  const monthLocked = await lockQuery;

  let healSettingsQuery = SystemSetting.findOne({ key: 'global' });
  if (healSettingsQuery && typeof healSettingsQuery.select === 'function') healSettingsQuery = healSettingsQuery.select('work_end_time');
  if (healSettingsQuery && typeof healSettingsQuery.lean === 'function') healSettingsQuery = healSettingsQuery.lean();
  const healSettings = await healSettingsQuery;
  const workEndTime = normalizeWorkEndTime(healSettings?.work_end_time);

  const checkInTime = new Date(shift.check_in_time);
  const workEndDateTime = new Date(`${shiftDateStr}T${workEndTime}:00+07:00`);
  let checkOutTime = (!Number.isNaN(workEndDateTime.getTime()) && checkInTime < workEndDateTime)
    ? workEndDateTime
    : new Date(now.getTime());
  if (checkOutTime > now) checkOutTime = new Date(now.getTime());
  if (Number.isNaN(checkInTime.getTime()) || Number.isNaN(checkOutTime.getTime()) || checkOutTime <= checkInTime) {
    checkOutTime = new Date(checkInTime.getTime() + 60 * 1000);
  }
  const proposedHHMM = checkOutTime.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit',
  });
  const outDayStr = checkOutTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  const notifyAdminsAutoHeal = async (message) => {
    try {
      const admins = await User.find({ role: 'admin', _id: { $ne: shift.user_id } });
      if (admins.length > 0) {
        await Notification.insertMany(admins.map((a) => ({
          user_id: a._id,
          title: '🩹 Auto-heal ca chưa checkout',
          message,
          type: 'request',
          link: '/requests',
        })));
      }
    } catch (_) {}
  };

  if (monthLocked) {
    if (!existingHealRequest) {
      try {
        await Request.create({
          user_id: shift.user_id,
          type: 'forgot_checkout',
          start_date: shiftDateStr,
          end_date: shiftDateStr,
          start_time: null,
          end_time: null,
          reason: 'Hệ thống tự ghi nhận: ca hôm trước chưa khép nhưng tháng công đã chốt. Vui lòng Admin mở khóa và xử lý giờ bằng Override — nhân viên được chấm công bình thường.',
          status: 'pending',
          source_attendance_id: shift._id,
        });
        await notifyAdminsAutoHeal(`Ca ${shiftDateStr} chưa khép, tháng công đã chốt. Nhân viên được cho qua check-in mới (sổ công không bị sửa).`);
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }
    return 'bypassed';
  }

  if (existingHealRequest) return 'healed';

  const healMetrics = calculateAttendanceMetrics(checkInTime, checkOutTime, {
    workEndTime,
    otStartTime: workEndTime,
  });

  const closedShift = await Attendance.findOneAndUpdate(
    { _id: shift._id, check_out_time: null },
    {
      $set: {
        check_out_time: checkOutTime,
        check_out_note: AUTO_HEAL_NOTE,
        total_hours: healMetrics.totalHours,
        is_overnight: healMetrics.isOvernight,
        is_early_leave: false,
        early_minutes: 0,
        ot_hours: 0,
        ot_hours_proposed: 0,
        ot_status: 'none',
        auto_checkout: true,
        verification_status: 'pending_review',
        is_flagged: true,
        flag_reason: 'AUTO_HEAL_FORGOT_CHECKOUT',
      },
    },
    { new: true }
  );
  if (!closedShift) return 'closed';

  try {
    await Request.create({
      user_id: shift.user_id,
      type: 'forgot_checkout',
      start_date: shiftDateStr,
      end_date: outDayStr > shiftDateStr ? outDayStr : shiftDateStr,
      start_time: null,
      end_time: proposedHHMM,
      reason: `Hệ thống tự sinh: nhân viên quên checkout ca ${shiftDateStr}. Giờ tạm khép ${proposedHHMM} (0 OT) để không cản trở đi làm — đề nghị giải trình giờ thực tế để Admin hậu kiểm.`,
      status: 'pending',
      source_attendance_id: shift._id,
    });
    await notifyAdminsAutoHeal(`Ca ${shiftDateStr} vừa được auto-heal khép tạm lúc ${proposedHHMM} (0 OT). Đơn giải trình đang chờ — duyệt là chốt giờ thật, hoặc Override.`);
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  return 'healed';
};

module.exports = {
  AUTO_HEAL_NOTE,
  normalizeWorkEndTime,
  closePastShiftApprovedByAdmin,
  healUnclosedShiftForCheckin,
};
