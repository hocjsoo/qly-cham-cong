// controllers/timesheetLockController.js - Chốt Công & Bảng Công Mẫu Thủ Công ET_Staff 2026

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const TimesheetLock = require('../models/TimesheetLock');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const SystemSetting = require('../models/SystemSetting');

// Map symbol to status / check_in_type for override
const SYMBOL_TO_STATUS_MAP = {
  'x': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,75x': { total_hours: 6, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,5x': { total_hours: 4, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  'CT1': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác trong nước (CT1)' },
  'CT2': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác nước ngoài (CT2)' },
  'WFH': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'wfh', status: 'present', notes: 'Work from home (WFH)' },
  'P': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ phép năm (P)' },
  'O': { total_hours: 8, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ ốm (O)' },
  'KL': { total_hours: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Nghỉ không lương (KL)' },
  'K': { total_hours: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Khác (K)' },
};

// GET /api/timesheet-lock/full-matrix?month=7&year=2026
const getFullMatrix = async (req, res) => {
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();

  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Lấy danh sách nhân viên đang làm việc (bỏ qua người miễn chấm công, đã nghỉ việc, nghỉ thai sản, nghỉ ốm, khác)
    const users = await User.find({
      is_active: { $ne: false },
      is_attendance_exempt: { $ne: true }, // Miễn chấm công -> Ẩn hoàn toàn khỏi Bảng Chấm Công
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    })
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .sort({ employee_code: 1, full_name: 1 });

    // Lấy tất cả bản ghi điểm danh và lịch sử chỉnh sửa tháng này
    const [attendances, auditLogsList] = await Promise.all([
      Attendance.find({ date: { $gte: startDateStr, $lte: endDateStr } }).lean(),
      AttendanceAuditLog.find({ date: { $gte: startDateStr, $lte: endDateStr } }).sort({ modified_at: -1 }).lean(),
    ]);

    // Lấy danh sách chốt công tháng này và cấu hình giờ làm việc
    const [lockRecords, settings] = await Promise.all([
      TimesheetLock.find({ month, year }),
      SystemSetting.findOne({ key: 'global' }),
    ]);
    const workEndTime = settings?.work_end_time || '17:30';
    const [endH, endM] = workEndTime.split(':').map(Number);
    const endMinutesLimit = endH * 60 + endM;

    const globalLock = lockRecords.find(l => l.user_id === null && l.is_locked);
    const userLockMap = {};
    lockRecords.forEach(l => {
      if (l.user_id) userLockMap[l.user_id.toString()] = l;
    });

    // Xây dựng Header Ngày & Thứ (T2..CN)
    const headerDays = [];
    const weekdayVN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const weekdayStr = weekdayVN[dateObj.getDay()];

      headerDays.push({
        day: d,
        dayStr: String(d).padStart(2, '0'),
        weekday: weekdayStr,
        dateStr,
        isSunday: dateObj.getDay() === 0,
        isSaturday: dateObj.getDay() === 6,
        isWeekend: dateObj.getDay() === 0,
      });
    }

    // Xây dựng Bảng Tổng Hợp Nhân Sự Khớp 100% ET_Staff 2026
    const staffRows = users.map((u, idx) => {
      const uIdStr = String(u._id);
      const userAtts = attendances.filter(a => String(a.user_id) === uIdStr);
      const attDateMap = {};
      userAtts.forEach(a => { attDateMap[a.date] = a; });

      const userAudits = auditLogsList.filter(l => String(l.user_id) === uIdStr);

      let nlv_office = 0;
      let ct_domestic = 0;
      let ct_foreign = 0;
      let wfh = 0;
      let annual_leave = 0;
      let sick_leave = 0;
      let unpaid_leave = 0;
      let other_leave = 0;
      let total_ot_hours = 0;
      let late_count = 0;
      let total_late_minutes = 0;
      let early_count = 0;
      let total_early_minutes = 0;

      const daysData = headerDays.map(hd => {
        const att = attDateMap[hd.dateStr];
        let symbol = '';
        let is_early_leave = false;
        let early_minutes = 0;

        if (att) {
          if (att.ot_hours > 0) {
            total_ot_hours += Number(att.ot_hours) || 0;
          }
          if (att.is_late) {
            late_count += 1;
            total_late_minutes += Number(att.late_minutes) || 0;
          }

          // Kiểm tra về sớm (is_early_leave)
          if (att.is_early_leave) {
            is_early_leave = true;
            early_minutes = Number(att.early_minutes) || 0;
          } else if (att.check_out_time) {
            const coDate = new Date(att.check_out_time);
            if (!isNaN(coDate.getTime())) {
              const coVN = new Date(coDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
              const coMinutes = coVN.getHours() * 60 + coVN.getMinutes();
              if (coMinutes < endMinutesLimit - 4) {
                is_early_leave = true;
                early_minutes = endMinutesLimit - coMinutes;
              }
            }
          }

          if (is_early_leave) {
            early_count += 1;
            total_early_minutes += early_minutes;
          }

          const notes = (att.notes || '').toUpperCase();
          if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI')) {
            symbol = 'CT2';
            ct_foreign += 1;
          } else if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || (att.check_in_type === 'site')) {
            symbol = 'CT1';
            ct_domestic += 1;
          } else if (att.check_in_type === 'wfh' || notes.includes('WFH')) {
            symbol = 'WFH';
            wfh += 1;
          } else if (att.status === 'leave' || notes.includes('NGHỈ PHÉP') || notes.includes('(P)')) {
            symbol = 'P';
            annual_leave += 1;
          } else if (notes.includes('NGHỈ ỐM') || notes.includes('(O)')) {
            symbol = 'O';
            sick_leave += 1;
          } else if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)')) {
            symbol = 'KL';
            unpaid_leave += 1;
          } else if (notes.includes('(K)') || notes.includes('KHÁC')) {
            symbol = 'K';
            other_leave += 1;
          } else if (att.total_hours >= 7.5) {
            symbol = 'x';
            nlv_office += 1;
          } else if (att.total_hours >= 5.5) {
            symbol = '0,75x';
            nlv_office += 0.75;
          } else if (att.total_hours >= 3.5) {
            symbol = '0,5x';
            nlv_office += 0.5;
          } else if (att.total_hours > 0) {
            symbol = '0,5x';
            nlv_office += 0.5;
          }
        }

        // Lấy toàn bộ lịch sử chỉnh sửa ngày này của nhân viên
        const dayAudits = userAudits.filter(l => l.date === hd.dateStr);

        const formatTimeHHMM = (val) => {
          if (!val) return null;
          if (typeof val === 'string' && val.length === 5 && val.includes(':')) return val;
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
            }
          } catch {}
          return String(val);
        };

        return {
          day: hd.day,
          dateStr: hd.dateStr,
          symbol,
          attendance_id: att?._id || null,
          check_in_time: formatTimeHHMM(att?.check_in_time),
          check_out_time: formatTimeHHMM(att?.check_out_time),
          total_hours: att?.total_hours || 0,
          ot_hours: att?.ot_hours || 0,
          is_late: Boolean(att?.is_late),
          late_minutes: att?.late_minutes || 0,
          is_early_leave: Boolean(is_early_leave),
          early_minutes: early_minutes,
          status: att?.status || (att ? 'present' : 'none'),
          notes: att?.notes || '',
          check_in_type: att?.check_in_type || 'office',
          is_modified: dayAudits.length > 0,
          audit_logs: dayAudits.map(a => ({
            old_symbol: a.old_symbol,
            new_symbol: a.new_symbol,
            reason: a.reason,
            modified_by_name: a.modified_by_name || 'Admin',
            modified_at: a.modified_at,
          })),
        };
      });

      const userLockObj = userLockMap[u._id.toString()];
      const isLocked = Boolean(globalLock || (userLockObj && userLockObj.is_locked));

      return {
        id: u._id,
        code: u.employee_code || `NS ${String(idx + 1).padStart(2, '0')}`,
        full_name: u.full_name,
        avatar_url: u.avatar_url || null,
        role_label: u.position || u.department_id?.name || (u.role === 'admin' ? 'Quản trị' : (u.role === 'leader' || u.role === 'manager') ? 'Trưởng nhóm' : 'Nhân sự'),
        department_name: u.department_id?.name || 'KTS',
        nlv_office: parseFloat(nlv_office.toFixed(2)),
        ct_domestic: parseFloat(ct_domestic.toFixed(2)),
        ct_foreign: parseFloat(ct_foreign.toFixed(2)),
        wfh: parseFloat(wfh.toFixed(2)),
        annual_leave: parseFloat(annual_leave.toFixed(2)),
        sick_leave: parseFloat(sick_leave.toFixed(2)),
        unpaid_leave: parseFloat(unpaid_leave.toFixed(2)),
        other_leave: parseFloat(other_leave.toFixed(2)),
        total_ot_hours: parseFloat(total_ot_hours.toFixed(1)),
        late_count: late_count,
        total_late_minutes: total_late_minutes,
        early_count: early_count,
        total_early_minutes: total_early_minutes,
        days: daysData,
        is_locked: isLocked,
        is_attendance_exempt: Boolean(u.is_attendance_exempt),
        locked_info: isLocked ? (globalLock || userLockObj) : null,
      };
    });

    res.json({
      month,
      year,
      days_in_month: daysInMonth,
      header_days: headerDays,
      staff_rows: staffRows,
      global_locked: Boolean(globalLock),
      global_lock_info: globalLock || null,
    });

  } catch (error) {
    console.error('GetFullMatrix error:', error);
    res.status(500).json({ error: 'Lỗi tải Bảng Chấm Công 31 ngày.' });
  }
};

// POST /api/timesheet-lock/toggle - Chốt / Mở chốt công
const toggleLock = async (req, res) => {
  const { month, year, user_id, is_locked, note } = req.body;

  if (!month || !year) {
    return res.status(400).json({ error: 'Tháng và Năm là bắt buộc.' });
  }

  try {
    const filter = {
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      user_id: user_id || null,
    };

    const record = await TimesheetLock.findOneAndUpdate(
      filter,
      {
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        user_id: user_id || null,
        is_locked: Boolean(is_locked),
        locked_by: req.user._id,
        locked_by_name: req.user.full_name,
        locked_at: new Date(),
        note: note || (is_locked ? 'Chốt công' : 'Mở chốt công'),
      },
      { upsert: true, new: true }
    );

    res.json({
      message: is_locked ? 'Đã chốt bảng công thành công 🔒' : 'Đã mở chốt bảng công 🔓',
      lock_record: record,
    });
  } catch (error) {
    console.error('ToggleLock error:', error);
    res.status(500).json({ error: 'Lỗi chốt/mở chốt công.' });
  }
};

// POST /api/timesheet-lock/override-cell - Chỉnh sửa ô công có lưu lý do, giờ vào/ra & thời gian
const overrideCell = async (req, res) => {
  const { user_id, date, new_symbol, reason, check_in_time, check_out_time, custom_notes } = req.body;

  if (!user_id || !date || !new_symbol || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'Tất cả thông tin và Lý do chỉnh sửa là bắt buộc.' });
  }

  try {
    let attendance = await Attendance.findOne({ user_id, date });
    const oldSymbol = attendance ? (attendance.notes || '—') : '—';
    const targetConfig = SYMBOL_TO_STATUS_MAP[new_symbol] || SYMBOL_TO_STATUS_MAP['x'];

    const checkInDate = check_in_time ? (check_in_time.includes('T') ? new Date(check_in_time) : new Date(`${date}T${check_in_time}:00+07:00`)) : (attendance?.check_in_time || null);
    const checkOutDate = check_out_time ? (check_out_time.includes('T') ? new Date(check_out_time) : new Date(`${date}T${check_out_time}:00+07:00`)) : (attendance?.check_out_time || null);

    const noteContent = custom_notes ? `${custom_notes} | Sửa: ${reason.trim()}` : `Ký hiệu: [${new_symbol}] | ${targetConfig.notes || ''} | Sửa: ${reason.trim()}`;

    if (attendance) {
      attendance.total_hours = targetConfig.total_hours;
      attendance.is_late = targetConfig.is_late;
      attendance.late_tier = targetConfig.late_tier;
      attendance.check_in_type = targetConfig.check_in_type;
      attendance.status = targetConfig.status;
      if (check_in_time !== undefined) attendance.check_in_time = checkInDate;
      if (check_out_time !== undefined) attendance.check_out_time = checkOutDate;
      attendance.notes = noteContent;
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        user_id,
        date,
        total_hours: targetConfig.total_hours,
        is_late: targetConfig.is_late,
        late_tier: targetConfig.late_tier,
        check_in_type: targetConfig.check_in_type,
        status: targetConfig.status,
        check_in_time: checkInDate,
        check_out_time: checkOutDate,
        notes: noteContent,
      });
    }

    const user = await User.findById(user_id);

    // Lưu Lịch Sử Audit Log
    const auditLog = await AttendanceAuditLog.create({
      attendance_id: attendance._id,
      user_id,
      user_name: user ? user.full_name : 'Nhân viên',
      date,
      old_symbol: oldSymbol,
      new_symbol,
      reason: reason.trim(),
      modified_by: req.user._id,
      modified_by_name: req.user.full_name,
      modified_at: new Date(),
    });

    res.json({
      message: `Đã chỉnh sửa ô công ngày ${date} thành [${new_symbol}] ✅`,
      attendance,
      audit_log: auditLog,
    });
  } catch (error) {
    console.error('OverrideCell error:', error);
    res.status(500).json({ error: 'Lỗi điều chỉnh ô công.' });
  }
};

// GET /api/timesheet-lock/audit-logs?month=7&year=2026
const getAuditLogs = async (req, res) => {
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();

  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const logs = await AttendanceAuditLog.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    }).sort({ modified_at: -1 });

    res.json(logs);
  } catch (error) {
    console.error('GetAuditLogs error:', error);
    res.status(500).json({ error: 'Lỗi tải lịch sử chỉnh sửa.' });
  }
};

module.exports = {
  getFullMatrix,
  toggleLock,
  overrideCell,
  getAuditLogs,
};
