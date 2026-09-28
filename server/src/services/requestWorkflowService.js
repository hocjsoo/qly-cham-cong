// server/src/services/requestWorkflowService.js
// Nghiệp vụ giao dịch an toàn, kiểm tra TimesheetLock và phục hồi Snapshot cho Request

const mongoose = require('mongoose');
const TimesheetLock = require('../models/TimesheetLock');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { revertLeaveOnUndo } = require('../controllers/leaveBalanceController');

/**
 * Kiểm tra trạng thái topology MongoDB (xác định xem có cần Transaction Fail-Closed hay không)
 */
const getTopologyStatus = () => {
  const readyState = mongoose.connection?.readyState;
  const isTestEnv = Boolean(process.env.NODE_ENV === 'test');
  const topology = mongoose.connection?.client?.topology;

  if (isTestEnv && !topology && readyState !== 1) {
    return { readyState, isTestEnv: true, requiresTransaction: false };
  }
  return { readyState, isTestEnv: false, requiresTransaction: true };
};

/**
 * Tính toán dải ngày giữa start_date và end_date (YYYY-MM-DD theo múi giờ VN)
 */
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

/**
 * Khởi tạo bảo đảm trước ngoài transaction (Idempotent Pre-Init)
 */
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

/**
 * Write-Intent Guard thực thi ngay trong Transaction Session để chống Race Condition [P1]
 */
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
      const lockQuery = TimesheetLock.findOne({
        month: dMonth,
        year: dYear,
        is_locked: true,
        $or: [{ user_id: null }, { user_id: userId }],
      });
      const locked = await lockQuery;
      if (locked) {
        const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa.`);
        lockErr.statusCode = 403;
        throw lockErr;
      }
    }
  }
};

/**
 * Hoàn nguyên snapshot 100% cho đơn đã duyệt khi revert hoặc delete [P1]
 */
const restoreRequestSnapshot = async (request, session = null) => {
  if (!request || request.status !== 'approved') return;

  if (request.snapshot_before) {
    const snap = request.snapshot_before;

    // 1. Phục hồi thông tin xe nếu là đơn đổi xe
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

    // 3. Phục hồi toàn bộ bản ghi Attendance về đúng 100% snapshot ban đầu
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
          att.is_overnight = Boolean(rec.doc.is_overnight);
          att.ot_hours_proposed = rec.doc.ot_hours_proposed || 0;
          att.ot_status = rec.doc.ot_status || 'none';
          att.ot_approved_by = rec.doc.ot_approved_by || null;
          att.ot_approved_at = rec.doc.ot_approved_at || null;
          att.ot_reviewer_note = rec.doc.ot_reviewer_note || null;
          att.ot_adjustment_reason = rec.doc.ot_adjustment_reason || null;
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
    // Legacy fallback cho đơn cũ
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

module.exports = {
  getTopologyStatus,
  getDatesInRange,
  preInitTimesheetLocks,
  guardTimesheetLocksInTx,
  restoreRequestSnapshot,
};
