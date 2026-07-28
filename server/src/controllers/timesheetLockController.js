// controllers/timesheetLockController.js - Chốt Công & Bảng Công Mẫu Thủ Công ET_Staff 2026

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const TimesheetLock = require('../models/TimesheetLock');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');

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

    // Lấy danh sách nhân viên active
    const users = await User.find({ is_active: { $ne: false } })
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .sort({ employee_code: 1, full_name: 1 });

    // Lấy tất cả bản ghi điểm danh tháng này
    const attendances = await Attendance.find({
      date: { $gte: startDateStr, $lte: endDateStr },
    });

    // Lấy danh sách chốt công tháng này
    const lockRecords = await TimesheetLock.find({ month, year });
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
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }

    // Xây dựng Bảng Tổng Hợp Nhân Sự Khớp 100% ET_Staff 2026
    const staffRows = users.map((u, idx) => {
      const userAtts = attendances.filter(a => a.user_id.toString() === u._id.toString());
      const attDateMap = {};
      userAtts.forEach(a => { attDateMap[a.date] = a; });

      let nlv_office = 0;
      let ct_domestic = 0;
      let ct_foreign = 0;
      let wfh = 0;
      let annual_leave = 0;
      let sick_leave = 0;
      let unpaid_leave = 0;
      let other_leave = 0;

      const daysData = headerDays.map(hd => {
        const att = attDateMap[hd.dateStr];
        let symbol = '';

        if (att) {
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

        return {
          day: hd.day,
          dateStr: hd.dateStr,
          symbol,
          attendance_id: att?._id || null,
        };
      });

      const userLockObj = userLockMap[u._id.toString()];
      const isLocked = Boolean(globalLock || (userLockObj && userLockObj.is_locked));

      return {
        id: u._id,
        code: u.employee_code || `NS ${String(idx + 1).padStart(2, '0')}`,
        full_name: u.full_name,
        role_label: u.role === 'admin' ? 'KTS-PGD' : u.role === 'manager' ? 'KTS NT - QL' : 'KTS',
        department_name: u.department_id?.name || 'KTS',
        nlv_office: parseFloat(nlv_office.toFixed(2)),
        ct_domestic: parseFloat(ct_domestic.toFixed(2)),
        ct_foreign: parseFloat(ct_foreign.toFixed(2)),
        wfh: parseFloat(wfh.toFixed(2)),
        annual_leave: parseFloat(annual_leave.toFixed(2)),
        sick_leave: parseFloat(sick_leave.toFixed(2)),
        unpaid_leave: parseFloat(unpaid_leave.toFixed(2)),
        other_leave: parseFloat(other_leave.toFixed(2)),
        days: daysData,
        is_locked: isLocked,
        locked_info: isLocked ? (globalLock || userLockObj) : null,
      };
    });

    res.json({
      month,
      year,
      days_in_month: daysInMonth,
      header_days: headerDays,
      global_locked: Boolean(globalLock),
      global_lock_info: globalLock || null,
      staff_rows: staffRows,
    });

  } catch (error) {
    console.error('GetFullMatrix error:', error);
    res.status(500).json({ error: 'Lỗi tải bảng chốt công tổng hợp.' });
  }
};

// POST /api/timesheet-lock/toggle - Chốt công / Mở chốt công (Toàn bộ hoặc Theo từng NV)
const toggleLock = async (req, res) => {
  const { month, year, user_id, is_locked, note } = req.body;

  if (!month || !year) {
    return res.status(400).json({ error: 'Tháng và năm là bắt buộc.' });
  }

  try {
    const filter = { month: parseInt(month, 10), year: parseInt(year, 10), user_id: user_id || null };
    const update = {
      is_locked: is_locked !== undefined ? is_locked : true,
      locked_by: req.user._id,
      locked_by_name: req.user.full_name,
      locked_at: new Date(),
      note: note || (is_locked ? 'Chốt công bảng lương' : 'Mở chốt công'),
    };

    const record = await TimesheetLock.findOneAndUpdate(filter, update, { upsert: true, new: true });

    res.json({
      message: is_locked ? '🔒 Đã chốt công thành công!' : '🔓 Đã mở chốt công!',
      lock_record: record,
    });
  } catch (error) {
    console.error('ToggleLock error:', error);
    res.status(500).json({ error: 'Lỗi chốt/mở chốt công.' });
  }
};

// POST /api/timesheet-lock/override-cell - Chỉnh sửa ô công có lưu lý do & thời gian
const overrideCell = async (req, res) => {
  const { user_id, date, new_symbol, reason } = req.body;

  if (!user_id || !date || !new_symbol || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'Tất cả thông tin và Lý do chỉnh sửa là bắt buộc.' });
  }

  try {
    let attendance = await Attendance.findOne({ user_id, date });
    const oldSymbol = attendance ? (attendance.notes || '—') : '—';
    const targetConfig = SYMBOL_TO_STATUS_MAP[new_symbol] || SYMBOL_TO_STATUS_MAP['x'];

    if (attendance) {
      attendance.total_hours = targetConfig.total_hours;
      attendance.is_late = targetConfig.is_late;
      attendance.late_tier = targetConfig.late_tier;
      attendance.check_in_type = targetConfig.check_in_type;
      attendance.status = targetConfig.status;
      attendance.notes = `Ký hiệu: [${new_symbol}] | ${targetConfig.notes || ''} | Sửa: ${reason.trim()}`;
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
        notes: `Ký hiệu: [${new_symbol}] | ${targetConfig.notes || ''} | Sửa: ${reason.trim()}`,
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
