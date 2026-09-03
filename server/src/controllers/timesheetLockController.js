const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const TimesheetLock = require('../models/TimesheetLock');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const SystemSetting = require('../models/SystemSetting');
const Holiday = require('../models/Holiday');
const { getActiveEmploymentFilter, isInactiveEmploymentStatus } = require('../utils/employmentStatus');

// Map symbol to status / check_in_type / work_units for override
const SYMBOL_TO_STATUS_MAP = {
  '': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Chỉ tính OT / Không tính công ngày' },
  'NONE': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Chỉ tính OT / Không tính công ngày' },
  'x': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,75x': { total_hours: 6, work_units: 0.75, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0.75x': { total_hours: 6, work_units: 0.75, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,5x': { total_hours: 4, work_units: 0.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0.5x': { total_hours: 4, work_units: 0.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '1,5x': { total_hours: 8, work_units: 1.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 1,5x' },
  '1.5x': { total_hours: 8, work_units: 1.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 1,5x' },
  '2x': { total_hours: 8, work_units: 2, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 2x' },
  '2.0x': { total_hours: 8, work_units: 2, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 2x' },
  '3x': { total_hours: 8, work_units: 3, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 3x' },
  '3.0x': { total_hours: 8, work_units: 3, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present', notes: 'Công hệ số 3x' },
  'CT1': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác trong nước (CT1)' },
  'CT2': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác nước ngoài (CT2)' },
  'WFH': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'wfh', status: 'present', notes: 'Work from home (WFH)' },
  'P': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ phép năm (P)' },
  'O': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ ốm (O)' },
  'KL': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Nghỉ không lương (KL)' },
  'K': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Khác (K)' },
  'L': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'holiday', notes: 'Nghỉ Lễ (L)' },
};

const HOLIDAY_WORK_MULTIPLIERS = new Set([1.5, 2, 3]);
const formatWorkUnitSymbol = workUnits => {
  const normalized = Number(workUnits);
  if (normalized === 1.5) return '1,5x';
  if (normalized === 2) return '2x';
  if (normalized === 3) return '3x';
  return null;
};

// Resolve structured attendance fields before falling back to legacy free-text notes.
// This prevents stale notes (for example an old WFH reason) from overriding a later
// Admin-approved status/work_units value.
const resolveStructuredTimesheetSymbol = (attendance, isHoliday = false) => {
  if (!attendance) return isHoliday ? 'L' : '';

  const workUnits = Number(attendance.work_units);
  const notes = String(attendance.notes || '').toUpperCase();
  const hasRecordedWork = Boolean(attendance.check_in_time) || attendance.status === 'present';
  const multiplierSymbol = HOLIDAY_WORK_MULTIPLIERS.has(workUnits)
    ? formatWorkUnitSymbol(workUnits)
    : null;

  if (multiplierSymbol && (attendance.status !== 'holiday' || hasRecordedWork)) return multiplierSymbol;
  if (attendance.status === 'holiday') return 'L';
  if (attendance.status === 'leave') {
    if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)') || notes.includes('[KL]')) return 'KL';
    if (notes.includes('NGHỈ ỐM') || notes.includes('(O)') || notes.includes('[O]')) return 'O';
    return 'P';
  }
  if (attendance.status === 'half_day' || workUnits === 0.5) return '0,5x';
  if (attendance.check_in_type === 'client') return 'CT2';
  if (attendance.check_in_type === 'site') return 'CT1';
  if (attendance.check_in_type === 'wfh') return 'WFH';
  if (workUnits === 0.75) return '0,75x';
  if (workUnits === 1) return 'x';
  return null;
};

// Helper kiểm tra topology MongoDB:
// - ReplicaSet / Sharded / Production / Unknown: Bắt buộc ACID transaction (fail-closed nếu startSession lỗi)
// - Single (Standalone / local dev non-production): Chạy compensatory rollback
const getTopologyStatus = () => {
  try {
    const topology = mongoose.connection?.client?.topology;
    const descType = topology?.description?.type || topology?.s?.description?.type;
    // Standalone deployment ('Single'): chỉ chấp nhận fallback non-transaction khi KHÔNG PHẢI môi trường production
    if (descType === 'Single' && process.env.NODE_ENV !== 'production') {
      return { isStandalone: true, requiresTransaction: false };
    }
    // In-memory test environment (không kết nối MongoDB thực tế và ngoài production)
    if (!topology && process.env.NODE_ENV !== 'production' && mongoose.connection?.readyState !== 1) {
      return { isStandalone: true, requiresTransaction: false };
    }
  } catch {}
  // Mọi môi trường khác (Atlas, ReplicaSet, Sharded, Unknown topology, hoặc bất kỳ NODE_ENV=production nào) đều BẮT BUỘC Transaction (Fail-Closed)
  return { isStandalone: false, requiresTransaction: true };
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
    const userCandidates = await User.find(getActiveEmploymentFilter({
      is_attendance_exempt: { $ne: true }, // Miễn chấm công -> Ẩn hoàn toàn khỏi Bảng Chấm Công
    }))
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .sort({ employee_code: 1, full_name: 1 });
    // Phòng thủ thêm trước dữ liệu trạng thái cũ/không dấu chưa chuẩn hóa trong DB.
    const users = userCandidates.filter(user => !isInactiveEmploymentStatus(user.employment_status));

    // Lấy tất cả bản ghi điểm danh, lịch sử chỉnh sửa, chốt công, cấu hình và ngày nghỉ lễ
    const [attendances, auditLogsList, lockRecords, settings, holidays] = await Promise.all([
      Attendance.find({ date: { $gte: startDateStr, $lte: endDateStr } }).lean(),
      AttendanceAuditLog.find({ date: { $gte: startDateStr, $lte: endDateStr } }).sort({ modified_at: -1 }).lean(),
      TimesheetLock.find({ month, year }),
      SystemSetting.findOne({ key: 'global' }),
      Holiday.find({
        $or: [
          { date: { $gte: startDateStr, $lte: endDateStr } },
          { end_date: { $gte: startDateStr, $lte: endDateStr } },
          { date: { $lte: startDateStr }, end_date: { $gte: endDateStr } }
        ]
      }).select('name date end_date is_paid work_multiplier').lean(),
    ]);

    // Xây dựng bản đồ ngày nghỉ lễ trong tháng
    const holidayMap = {};
    holidays.forEach(h => {
      const start = h.date;
      const end = h.end_date || h.date;
      if (!start) return;
      const [sY, sM, sD] = start.split('-').map(Number);
      const [eY, eM, eD] = (end || start).split('-').map(Number);
      const startD = new Date(sY, sM - 1, sD);
      const endD = new Date(eY, eM - 1, eD);

      let curr = new Date(startD);
      while (curr <= endD) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;
        if (dStr >= startDateStr && dStr <= endDateStr) {
          holidayMap[dStr] = h;
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    const workEndTime = settings?.work_end_time || '18:30';
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
      const hol = holidayMap[dateStr];

      headerDays.push({
        day: d,
        dayStr: String(d).padStart(2, '0'),
        weekday: weekdayStr,
        dateStr,
        isSunday: dateObj.getDay() === 0,
        isSaturday: dateObj.getDay() === 6,
        isWeekend: dateObj.getDay() === 0,
        isHoliday: Boolean(hol),
        holidayName: hol ? hol.name : null,
        isPaidHoliday: hol ? Boolean(hol.is_paid) : false,
        holidayWorkMultiplier: hol
          ? (HOLIDAY_WORK_MULTIPLIERS.has(Number(hol.work_multiplier)) ? Number(hol.work_multiplier) : 1.5)
          : null,
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
          if (att.ot_hours > 0 && att.ot_status !== 'pending_approval') {
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
        }

        // Lấy toàn bộ lịch sử chỉnh sửa ngày này của nhân viên (hiển thị trong modal chi tiết ô công)
        const dayAudits = userAudits.filter(l => l.date === hd.dateStr);

        // Source of Truth: Dữ liệu chấm công hiện tại trong Attendance (bao gồm cả khi Admin đã sửa hoặc đơn từ mới duyệt)
        if (att) {
          const notes = (att.notes || '').toUpperCase();
          symbol = resolveStructuredTimesheetSymbol(att, hd.isHoliday);

          // Backward compatibility for legacy rows that encoded their category
          // only in notes. Structured status/work_units above always wins.
          if (symbol === null) {
            if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI') || notes.includes('[CT2]')) symbol = 'CT2';
            else if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || notes.includes('[CT1]')) symbol = 'CT1';
            else if (notes.includes('NGHỈ ỐM') || notes.includes('(O)') || notes.includes('[O]')) symbol = 'O';
            else if (notes.includes('NGHỈ PHÉP') || notes.includes('(P)') || notes.includes('[P]')) symbol = 'P';
            else if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)') || notes.includes('[KL]')) symbol = 'KL';
            else if (notes.includes('(K)') || notes.includes('KHÁC') || notes.includes('[K]')) symbol = 'K';
            else if (notes.includes('NGHỈ LỄ') || notes.includes('(L)') || notes.includes('[L]')) symbol = 'L';
            else if (notes.includes('WFH') || notes.includes('[WFH]')) symbol = 'WFH';
            else if (notes.includes('[0,75X]') || notes.includes('[0.75X]') || notes.includes('0,75X') || notes.includes('0.75X')) symbol = '0,75x';
            else if (notes.includes('[0,5X]') || notes.includes('[0.5X]') || notes.includes('0,5X') || notes.includes('0.5X')) symbol = '0,5x';
            else if (notes.includes('[X]') || att.total_hours >= 7.5) symbol = 'x';
            else if (att.total_hours >= 5.5) symbol = '0,75x';
            else if (att.total_hours > 0) symbol = '0,5x';
            else symbol = '';
          }

          if (symbol === 'CT2') ct_foreign += 1;
          else if (symbol === 'CT1') ct_domestic += 1;
          else if (symbol === 'WFH') wfh += 1;
          else if (symbol === 'P') annual_leave += 1;
          else if (symbol === 'O') sick_leave += 1;
          else if (symbol === 'KL') unpaid_leave += 1;
          else if (symbol === 'K') other_leave += 1;
          else if (['1,5x', '2x', '3x'].includes(symbol)) nlv_office += Number(att.work_units) || 0;
          else if (symbol === 'x') nlv_office += 1;
          else if (symbol === '0,75x') nlv_office += 0.75;
          else if (symbol === '0,5x') nlv_office += 0.5;
        } else if (hd.isHoliday) {
          // Ngày nghỉ lễ của công ty không có chấm công -> Ghi nhận ký hiệu nghỉ lễ 'L'
          symbol = 'L';
        }

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
          work_units: Number(att?.work_units) || 0,
          ot_hours: (att?.ot_status === 'pending_approval' ? 0 : (att?.ot_hours || 0)),
          ot_hours_proposed: att?.ot_hours_proposed || 0,
          ot_status: att?.ot_status || 'none',
          is_overnight: Boolean(att?.is_overnight),
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
        employee_type: u.employee_type || 'NS',
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

    const sundayCount = headerDays.filter(h => h.isSunday).length;
    const standardWorkingDays = daysInMonth - sundayCount;

    res.json({
      month,
      year,
      days_in_month: daysInMonth,
      sunday_count: sundayCount,
      standard_working_days: standardWorkingDays,
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

// POST /api/timesheet-lock/override-cell - Chỉnh sửa ô công & xác nhận giờ OT (Admin duyệt ký hiệu, lý do & giờ OT)
const overrideCell = async (req, res) => {
  const { user_id, date, new_symbol, reason, ot_hours, custom_notes } = req.body;

  if (!user_id || !date || (!reason || !reason.trim())) {
    return res.status(400).json({ error: 'Ký hiệu công và Lý do chỉnh sửa là bắt buộc.' });
  }

  // Bắt buộc new_symbol phải được truyền tường minh dưới dạng chuỗi (chuỗi ký hiệu hoặc chuỗi rỗng '' cho ngày chỉ tính OT/không công)
  if (typeof new_symbol !== 'string') {
    return res.status(400).json({
      error: 'Ký hiệu công là bắt buộc (vui lòng truyền chuỗi ký hiệu hợp lệ hoặc chuỗi rỗng "" để chỉ tính OT/không tính công).'
    });
  }

  const rawSymbol = new_symbol.trim();

  // 1. Kiểm tra tính hợp lệ của Ký hiệu công (ngăn chặn ký hiệu lạ / dữ liệu không nhất quán)
  if (rawSymbol !== '' && !SYMBOL_TO_STATUS_MAP[rawSymbol]) {
    return res.status(400).json({
      error: 'Ký hiệu công không hợp lệ. Chỉ chấp nhận: x, 0,75x, 0,5x, 1,5x, 2x, 3x, CT1, CT2, WFH, P, O, KL, K, L hoặc để trống (chỉ tính OT).'
    });
  }

  // 2. Fail-Fast: Kiểm tra trạng thái kết nối & topology MongoDB trước khi thực thi bất kỳ truy vấn DB nào (ngăn chặn Mongoose buffering timeout)
  let session = null;
  let useCallbackTx = false;
  const topologyStatus = getTopologyStatus();
  try {
    if (topologyStatus.requiresTransaction) {
      if (mongoose.connection?.readyState !== 1 || typeof mongoose.startSession !== 'function') {
        return res.status(500).json({
          error: 'Lỗi kết nối cơ sở dữ liệu: Trạng thái kết nối MongoDB không khả dụng để thiết lập phiên giao dịch an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
          integrity_warning: false,
        });
      }
      try {
        session = await mongoose.startSession();
        if (!session) {
          return res.status(500).json({
            error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session). Yêu cầu bị hủy theo chính sách Fail-Closed.',
            integrity_warning: false,
          });
        }
        useCallbackTx = typeof session.withTransaction === 'function';
      } catch (sessInitErr) {
        console.error('Session start failed on transaction-required topology:', sessInitErr);
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Không thể khởi tạo phiên giao dịch an toàn trên cơ sở dữ liệu MongoDB Atlas. Yêu cầu bị hủy để bảo vệ tính toàn vẹn dữ liệu.',
          integrity_warning: false,
        });
      }
    } else {
      // Standalone topology: Driver không hỗ trợ multi-document transactions trên Single deployment
      session = null;
      useCallbackTx = false;
    }
  } catch (err) {
    if (topologyStatus.requiresTransaction) {
      return res.status(500).json({
        error: 'Lỗi thiết lập giao dịch: Không thể khởi tạo phiên giao dịch an toàn trên cơ sở dữ liệu MongoDB Atlas. Yêu cầu bị hủy để bảo vệ tính toàn vẹn dữ liệu.',
        integrity_warning: false,
      });
    }
    session = null;
    useCallbackTx = false;
  }

  const dateParts = String(date).split('-');
  const dYear = parseInt(dateParts[0], 10);
  const dMonth = parseInt(dateParts[1], 10);

  // 3. Khởi tạo trước (ngoài transaction) các document guard bằng upsert idempotent,
  // loại bỏ hoàn toàn việc upsert và lỗi DuplicateKeyError (11000) bên trong multi-document transaction.
  if (dYear && dMonth && typeof TimesheetLock.updateOne === 'function') {
    try {
      await TimesheetLock.updateOne(
        { month: dMonth, year: dYear, user_id: null },
        {
          $setOnInsert: {
            month: dMonth,
            year: dYear,
            user_id: null,
            is_locked: false,
            guard_version: 0,
          },
        },
        { upsert: true }
      );
    } catch (initGlobalErr) {
      if (initGlobalErr.code !== 11000) {
        console.error('Pre-transaction global lock init failed:', initGlobalErr);
        if (session) {
          try { await session.endSession(); } catch (_) {}
        }
        return res.status(500).json({
          error: 'Lỗi khởi tạo bảo vệ giao dịch: Không thể thiết lập trạng thái khóa bảng công an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
          integrity_warning: false,
        });
      }
    }

    if (user_id) {
      try {
        await TimesheetLock.updateOne(
          { month: dMonth, year: dYear, user_id },
          {
            $setOnInsert: {
              month: dMonth,
              year: dYear,
              user_id,
              is_locked: false,
              guard_version: 0,
            },
          },
          { upsert: true }
        );
      } catch (initUserErr) {
        if (initUserErr.code !== 11000) {
          console.error('Pre-transaction user lock init failed:', initUserErr);
          if (session) {
            try { await session.endSession(); } catch (_) {}
          }
          return res.status(500).json({
            error: 'Lỗi khởi tạo bảo vệ giao dịch: Không thể thiết lập trạng thái khóa nhân viên an toàn. Yêu cầu bị hủy theo chính sách Fail-Closed.',
            integrity_warning: false,
          });
        }
      }
    }
  }

  let isCommitted = false;
  let attendance = null;
  let isExisting = false;
  let originalDocState = null;
  let createdAttendanceDoc = null;
  let auditLog = null;
  let displayMsg = '';

  const executeMutation = async (activeSession) => {
    // 0. Kiểm tra & khóa tranh chấp (write-intent guard) trạng thái chốt khóa bảng công ngay trong Transaction Session
    if (dYear && dMonth) {
      const lockQuery = TimesheetLock.findOne({
        month: dMonth,
        year: dYear,
        is_locked: true,
        $or: [{ user_id: null }, { user_id }]
      });
      if (activeSession && typeof lockQuery.session === 'function') {
        lockQuery.session(activeSession);
      }
      const activeLock = await lockQuery;
      if (activeLock) {
        const lockErr = new Error(
          activeLock.user_id === null
            ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục bởi Ban Giám Đốc. Vui lòng mở khóa trước khi chỉnh sửa.`
            : `Bảng công của nhân viên này trong Tháng ${dMonth}/${dYear} đã bị khóa. Vui lòng mở khóa trước khi chỉnh sửa.`
        );
        lockErr.statusCode = 403;
        throw lockErr;
      }

      // Write-Intent Guard: Thực hiện thao tác ghi thực sự ($inc guard_version, $set last_verified_at)
      // với { upsert: false } trên document TimesheetLock đã tồn tại.
      // WiredTiger bắt buộc phải giữ write lock trên document TimesheetLock cho đến khi transaction kết thúc.
      // Nếu có bất kỳ request toggleLock nào sửa document này đồng thời, WiredTiger sẽ phát sinh Write Conflict.
      if (typeof TimesheetLock.findOneAndUpdate === 'function') {
        const updateOptions = { upsert: false, new: true };
        if (activeSession) {
          updateOptions.session = activeSession;
        }

        // 1. Guard global company-wide lock document
        const globalGuard = await TimesheetLock.findOneAndUpdate(
          {
            month: dMonth,
            year: dYear,
            user_id: null,
            is_locked: { $ne: true },
          },
          {
            $inc: { guard_version: 1 },
            $set: { last_verified_at: new Date() },
          },
          updateOptions
        );
        if (!globalGuard || globalGuard.is_locked) {
          const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục bởi Ban Giám Đốc. Vui lòng mở khóa trước khi chỉnh sửa.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }

        // 2. Guard user-specific lock document (nếu có user_id)
        if (user_id) {
          const userGuard = await TimesheetLock.findOneAndUpdate(
            {
              month: dMonth,
              year: dYear,
              user_id,
              is_locked: { $ne: true },
            },
            {
              $inc: { guard_version: 1 },
              $set: { last_verified_at: new Date() },
            },
            updateOptions
          );
          if (!userGuard || userGuard.is_locked) {
            const lockErr = new Error(`Bảng công của nhân viên này trong Tháng ${dMonth}/${dYear} đã bị khóa. Vui lòng mở khóa trước khi chỉnh sửa.`);
            lockErr.statusCode = 403;
            throw lockErr;
          }
        }
      }
    }

    const attFindQuery = Attendance.findOne({ user_id, date });
    if (activeSession && typeof attFindQuery.session === 'function') {
      attFindQuery.session(activeSession);
    }
    attendance = await attFindQuery;
    isExisting = Boolean(attendance);
    const oldSymbol = attendance ? (attendance.notes || '—') : '—';
    const snapshotBefore = attendance ? {
      check_in_time: attendance.check_in_time,
      check_out_time: attendance.check_out_time,
      check_in_lat: attendance.check_in_lat,
      check_in_lng: attendance.check_in_lng,
      check_out_lat: attendance.check_out_lat,
      check_out_lng: attendance.check_out_lng,
      total_hours: attendance.total_hours,
      work_units: attendance.work_units,
      ot_hours: attendance.ot_hours,
      status: attendance.status,
      notes: attendance.notes,
      is_late: attendance.is_late,
      late_minutes: attendance.late_minutes,
      late_tier: attendance.late_tier,
      is_early_leave: attendance.is_early_leave,
      early_minutes: attendance.early_minutes,
      check_in_type: attendance.check_in_type,
      hardware_uuid: attendance.hardware_uuid,
      selfie_url: attendance.selfie_url,
      is_flagged: attendance.is_flagged,
      flag_reasons: attendance.flag_reasons,
      verification_status: attendance.verification_status,
      reviewed_by: attendance.reviewed_by,
      reviewed_at: attendance.reviewed_at,
      reviewer_note: attendance.reviewer_note,
      check_in_note: attendance.check_in_note,
      check_out_note: attendance.check_out_note,
    } : null;

    if (isExisting && attendance && !activeSession) {
      originalDocState = {
        total_hours: attendance.total_hours,
        work_units: attendance.work_units,
        ot_hours: attendance.ot_hours,
        is_late: attendance.is_late,
        late_minutes: attendance.late_minutes,
        late_tier: attendance.late_tier,
        is_early_leave: attendance.is_early_leave,
        early_minutes: attendance.early_minutes,
        check_in_time: attendance.check_in_time,
        check_out_time: attendance.check_out_time,
        check_in_type: attendance.check_in_type,
        check_in_lat: attendance.check_in_lat,
        check_in_lng: attendance.check_in_lng,
        check_out_lat: attendance.check_out_lat,
        check_out_lng: attendance.check_out_lng,
        hardware_uuid: attendance.hardware_uuid,
        selfie_url: attendance.selfie_url,
        is_flagged: attendance.is_flagged,
        flag_reasons: attendance.flag_reasons,
        status: attendance.status,
        notes: attendance.notes,
        verification_status: attendance.verification_status,
        reviewer_note: attendance.reviewer_note,
        reviewed_by: attendance.reviewed_by,
        reviewed_at: attendance.reviewed_at,
      };
    }

    const targetConfig = SYMBOL_TO_STATUS_MAP[rawSymbol] || SYMBOL_TO_STATUS_MAP[''];

    // 2. Kiểm tra tính hợp lệ của Giờ OT: Số hữu hạn, 0 <= OT <= 16, bước 0.5h
    let confirmedOtHours = attendance?.ot_hours || 0;
    if (ot_hours !== undefined && ot_hours !== null && ot_hours !== '') {
      const numOt = Number(ot_hours);
      if (!Number.isFinite(numOt) || numOt < 0 || numOt > 16 || (numOt * 2) % 1 !== 0) {
        const validationErr = new Error('Số giờ OT không hợp lệ. Vui lòng nhập số hữu hạn từ 0 đến 16 giờ theo bước 0.5h (ví dụ: 0, 0.5, 1, 1.5...).');
        validationErr.isValidationError = true;
        throw validationErr;
      }
      confirmedOtHours = numOt;
    }

    const otNotePart = confirmedOtHours > 0 ? ` (+${confirmedOtHours}h OT)` : '';
    const symbolLabel = rawSymbol ? `[${rawSymbol}]` : '[TRỐNG]';
    const noteContent = custom_notes
      ? `${custom_notes}${otNotePart} | Sửa: ${reason.trim()}`
      : `Ký hiệu: ${symbolLabel}${otNotePart} | ${targetConfig.notes || ''} | Sửa: ${reason.trim()}`;

    if (rawSymbol === '') {
      // Khi override về rỗng / không công / chỉ tính OT:
      // Xóa giờ chấm công & cờ muộn/sớm cũ; bảo toàn dữ liệu GPS/Selfie làm chứng từ forensic (snapshot gốc đã được lưu trọn vẹn vào AttendanceAuditLog)
      if (attendance) {
        attendance.total_hours = targetConfig.total_hours; // 0
        attendance.work_units = targetConfig.work_units !== undefined ? targetConfig.work_units : 0; // 0
        attendance.ot_hours = confirmedOtHours;
        attendance.ot_status = confirmedOtHours > 0 ? 'approved' : 'none';
        if (confirmedOtHours > 0) {
          attendance.ot_approved_by = req.user._id;
          attendance.ot_approved_at = new Date();
          if (!attendance.ot_hours_proposed) attendance.ot_hours_proposed = confirmedOtHours;
        }
        attendance.is_late = false;
        attendance.late_minutes = 0;
        attendance.late_tier = 'on_time';
        attendance.is_early_leave = false;
        attendance.early_minutes = 0;
        attendance.check_in_time = null;
        attendance.check_out_time = null;
        attendance.status = 'absent';
        attendance.notes = noteContent;

        // Nếu ca này đang có cờ cảnh báo / chờ duyệt -> Đánh dấu giải quyết tường minh kèm reviewer audit note
        if (attendance.is_flagged || attendance.verification_status === 'pending_review') {
          attendance.is_flagged = false;
          attendance.verification_status = 'rejected';
          attendance.reviewed_by = req.user._id;
          attendance.reviewed_at = new Date();
          attendance.reviewer_note = `Admin điều chỉnh ô công (0 công): ${reason.trim()}`;
        }

        await attendance.save(activeSession ? { session: activeSession } : undefined);
      } else {
        const createPayload = {
          user_id,
          date,
          total_hours: targetConfig.total_hours, // 0
          work_units: targetConfig.work_units !== undefined ? targetConfig.work_units : 0, // 0
          ot_hours: confirmedOtHours,
          ot_status: confirmedOtHours > 0 ? 'approved' : 'none',
          ot_approved_by: confirmedOtHours > 0 ? req.user._id : null,
          ot_approved_at: confirmedOtHours > 0 ? new Date() : null,
          ot_hours_proposed: confirmedOtHours,
          is_late: false,
          late_minutes: 0,
          late_tier: 'on_time',
          is_early_leave: false,
          early_minutes: 0,
          check_in_time: null,
          check_out_time: null,
          check_in_type: 'office',
          status: 'absent',
          notes: noteContent,
          verification_status: 'auto_approved',
        };
        const created = await Attendance.create(
          activeSession ? [createPayload] : createPayload,
          activeSession ? { session: activeSession } : undefined
        );
        attendance = Array.isArray(created) ? created[0] : created;
        if (!activeSession) createdAttendanceDoc = attendance;
      }
    } else {
      if (attendance) {
        attendance.total_hours = targetConfig.total_hours;
        attendance.work_units = targetConfig.work_units !== undefined ? targetConfig.work_units : 1.0;
        attendance.ot_hours = confirmedOtHours;
        attendance.ot_status = confirmedOtHours > 0 ? 'approved' : (attendance.is_overnight ? 'rejected' : 'none');
        if (confirmedOtHours > 0) {
          attendance.ot_approved_by = req.user._id;
          attendance.ot_approved_at = new Date();
          if (!attendance.ot_hours_proposed) attendance.ot_hours_proposed = confirmedOtHours;
        }
        attendance.is_late = targetConfig.is_late;
        attendance.late_tier = targetConfig.late_tier;
        attendance.check_in_type = targetConfig.check_in_type;
        attendance.status = targetConfig.status;
        attendance.notes = noteContent;

        // Nếu ca này đang có cờ cảnh báo / chờ duyệt -> Đánh dấu phê duyệt tường minh kèm reviewer note
        if (attendance.is_flagged || attendance.verification_status === 'pending_review') {
          attendance.is_flagged = false;
          attendance.verification_status = 'approved';
          attendance.reviewed_by = req.user._id;
          attendance.reviewed_at = new Date();
          attendance.reviewer_note = `Admin điều chỉnh & phê duyệt công [${rawSymbol}]: ${reason.trim()}`;
        }

        await attendance.save(activeSession ? { session: activeSession } : undefined);
      } else {
        const createPayload = {
          user_id,
          date,
          total_hours: targetConfig.total_hours,
          work_units: targetConfig.work_units !== undefined ? targetConfig.work_units : 1.0,
          ot_hours: confirmedOtHours,
          ot_status: confirmedOtHours > 0 ? 'approved' : 'none',
          ot_approved_by: confirmedOtHours > 0 ? req.user._id : null,
          ot_approved_at: confirmedOtHours > 0 ? new Date() : null,
          ot_hours_proposed: confirmedOtHours,
          is_late: targetConfig.is_late,
          late_tier: targetConfig.late_tier,
          check_in_type: targetConfig.check_in_type,
          status: targetConfig.status,
          notes: noteContent,
          verification_status: 'auto_approved',
        };
        const created = await Attendance.create(
          activeSession ? [createPayload] : createPayload,
          activeSession ? { session: activeSession } : undefined
        );
        attendance = Array.isArray(created) ? created[0] : created;
        if (!activeSession) createdAttendanceDoc = attendance;
      }
    }

    const userFindQuery = User.findById(user_id);
    if (activeSession && typeof userFindQuery.session === 'function') {
      userFindQuery.session(activeSession);
    }
    const user = await userFindQuery;

    // Lưu Lịch Sử Audit Log (bao gồm snapshot chi tiết trước và sau khi thay đổi)
    const auditSymbolDisplay = rawSymbol
      ? (confirmedOtHours > 0 ? `${rawSymbol} (+${confirmedOtHours}h OT)` : rawSymbol)
      : (confirmedOtHours > 0 ? `Chỉ OT (+${confirmedOtHours}h)` : 'Không công (0 công)');

    const auditLogPayload = {
      attendance_id: attendance._id,
      user_id,
      user_name: user ? user.full_name : 'Nhân viên',
      date,
      old_symbol: oldSymbol,
      new_symbol: auditSymbolDisplay,
      reason: reason.trim(),
      modified_by: req.user._id,
      modified_by_name: req.user.full_name,
      modified_at: new Date(),
      snapshot_before: snapshotBefore,
      snapshot_after: {
        check_in_time: attendance.check_in_time,
        check_out_time: attendance.check_out_time,
        total_hours: attendance.total_hours,
        work_units: attendance.work_units,
        ot_hours: attendance.ot_hours,
        status: attendance.status,
        notes: attendance.notes,
        is_late: attendance.is_late,
        late_minutes: attendance.late_minutes,
        verification_status: attendance.verification_status,
        reviewer_note: attendance.reviewer_note,
      },
    };

    const createdAudit = await AttendanceAuditLog.create(
      activeSession ? [auditLogPayload] : auditLogPayload,
      activeSession ? { session: activeSession } : undefined
    );
    auditLog = Array.isArray(createdAudit) ? createdAudit[0] : createdAudit;

    displayMsg = rawSymbol
      ? `Đã điều chỉnh ô công ngày ${date} thành [${rawSymbol}]${confirmedOtHours > 0 ? ` (+${confirmedOtHours}h OT)` : ''} ✅`
      : `Đã cập nhật ngày ${date}${confirmedOtHours > 0 ? ` (+${confirmedOtHours}h OT)` : ' (không tính công)'} ✅`;
  };

  try {
    if (useCallbackTx && session) {
      // 1. MongoDB Recommended Callback Transaction API (Tự động retry TransientTransactionError & UnknownTransactionCommitResult)
      await session.withTransaction(async () => {
        await executeMutation(session);
      });
      isCommitted = true;
    } else if (session) {
      // 2. Core Transaction API (Dành cho custom/mock session): Thủ công startTransaction, commitTransaction với retry commit & abort
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
          } catch (retryCommitErr) {
            console.error('Retry commit transaction failed:', retryCommitErr);
            throw commitErr;
          }
        } else {
          throw commitErr;
        }
      }
    } else if (topologyStatus.isStandalone && !topologyStatus.requiresTransaction) {
      // 3. Standalone MongoDB Deployment (Local Dev Non-Production Mode): Chạy trực tiếp được bảo vệ bởi Compensatory In-Memory Rollback
      await executeMutation(null);
    } else {
      return res.status(500).json({
        error: 'Lỗi bảo mật giao dịch: Phiên giao dịch không tồn tại trên môi trường yêu cầu tính nguyên tử. Yêu cầu bị hủy.',
        integrity_warning: false,
      });
    }

    return res.json({
      message: displayMsg,
      attendance,
      audit_log: auditLog,
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }

    if (error.isValidationError) {
      return res.status(400).json({ error: error.message });
    }

    if (isCommitted) {
      console.warn('Override cell committed successfully with downstream warning:', error);
      return res.json({
        message: displayMsg || `Đã cập nhật ngày ${date} ✅`,
        attendance,
        audit_log: auditLog,
      });
    }

    let rollbackSucceeded = true;
    if (session && !useCallbackTx) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        rollbackSucceeded = false;
        console.error('Abort transaction error:', abortErr);
      }
    } else if (!session) {
      // Cơ chế Rollback bù trừ (Compensatory In-Memory Rollback): Phục hồi hoàn nguyên Attendance nếu Audit Log ghi thất bại
      try {
        if (isExisting && attendance && originalDocState) {
          Object.assign(attendance, originalDocState);
          await attendance.save();
        } else if (!isExisting && (createdAttendanceDoc?._id || attendance?._id)) {
          const idToDelete = createdAttendanceDoc?._id || attendance?._id;
          if (idToDelete) {
            await Attendance.deleteOne({ _id: idToDelete });
          }
        }
      } catch (rollbackErr) {
        rollbackSucceeded = false;
        console.error('Compensatory Rollback error:', rollbackErr);
      }
    }

    console.error('OverrideCell error:', error);
    if (!rollbackSucceeded) {
      return res.status(500).json({
        error: 'Lỗi nghiêm trọng: Quá trình cập nhật thất bại và không thể hoàn nguyên dữ liệu điểm danh. Vui lòng liên hệ quản trị viên để kiểm tra tính toàn vẹn dữ liệu.',
        integrity_warning: true,
      });
    }
    return res.status(500).json({ error: 'Lỗi điều chỉnh ô công: Giao dịch không hoàn tất và đã được khôi phục trạng thái ban đầu.' });
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (endErr) {
        console.error('End session error in finally:', endErr);
      }
    }
  }
};

// GET /api/timesheet-lock/audit-logs?month=7&year=2026&page=1&limit=50
const getAuditLogs = async (req, res) => {
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const filter = {
      date: { $gte: startDateStr, $lte: endDateStr },
    };

    const total = await AttendanceAuditLog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    // DTO tóm tắt: Loại bỏ trường snapshot_before & snapshot_after (tránh phình payload khi có ảnh selfie base64)
    const logs = await AttendanceAuditLog.find(filter)
      .select('attendance_id user_id user_name date old_symbol new_symbol reason modified_by modified_by_name modified_at createdAt')
      .sort({ modified_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('GetAuditLogs error:', error);
    res.status(500).json({ error: 'Lỗi tải lịch sử chỉnh sửa.' });
  }
};

// GET /api/timesheet-lock/audit-logs/:id/snapshot - Tải chi tiết snapshot forensic theo yêu cầu
const getAuditLogDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const log = await AttendanceAuditLog.findById(id);
    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi kiểm toán.' });
    }
    res.json(log);
  } catch (error) {
    console.error('GetAuditLogDetail error:', error);
    res.status(500).json({ error: 'Lỗi tải chi tiết snapshot kiểm toán.' });
  }
};

module.exports = {
  getFullMatrix,
  toggleLock,
  overrideCell,
  getAuditLogs,
  getAuditLogDetail,
  SYMBOL_TO_STATUS_MAP,
  formatWorkUnitSymbol,
  resolveStructuredTimesheetSymbol,
};
