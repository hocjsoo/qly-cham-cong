// controllers/reportController.js — Báo cáo chấm công + 6-month trend cho Recharts
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Request = require('../models/Request');

// GET /api/reports/monthly?month=7&year=2026&department_id=...
const getMonthlyReport = async (req, res) => {
  const { month, year, department_id } = req.query;

  try {
    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;

    let userFilter = {
      is_active: { $ne: false },
      is_attendance_exempt: { $ne: true },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (['manager', 'leader'].includes(req.user.role)) {
      const leaderDeptIds = req.user.department_ids && req.user.department_ids.length > 0 ? req.user.department_ids : (req.user.department_id ? [req.user.department_id] : []);
      userFilter.$or = [
        { manager_id: req.user._id },
        { department_ids: { $in: leaderDeptIds } },
        { department_id: { $in: leaderDeptIds } }
      ];
    }
    if (department_id) {
      userFilter.$or = [
        { department_ids: department_id },
        { department_id: department_id }
      ];
    }

    const users = await User.find(userFilter)
      .select('full_name email department_id department_ids')
      .populate('department_id', 'name')
      .sort({ full_name: 1 });

    const userIds = users.map(u => u._id);

    const dateStart = `${monthStr}-01`;
    const dateEnd = `${monthStr}-31`;

    const [attendances, approvedLeaves] = await Promise.all([
      Attendance.find({ user_id: { $in: userIds }, date: { $gte: dateStart, $lte: dateEnd } }),
      Request.find({
        user_id: { $in: userIds },
        status: 'approved',
        type: { $in: ['annual_leave', 'sick_leave'] },
        start_date: { $gte: dateStart, $lte: dateEnd }
      })
    ]);

    const attByUser = {};
    attendances.forEach(a => {
      const uid = a.user_id.toString();
      if (!attByUser[uid]) attByUser[uid] = [];
      attByUser[uid].push(a);
    });

    const leaveByUser = {};
    approvedLeaves.forEach(l => {
      const uid = l.user_id.toString();
      if (!leaveByUser[uid]) leaveByUser[uid] = [];
      leaveByUser[uid].push(l);
    });

    const report = users.map(u => {
      const uid = u._id.toString();
      const recs = attByUser[uid] || [];
      const leaves = leaveByUser[uid] || [];

      const presentDays = recs.filter(r => !r.is_late).length;
      const lateDays = recs.filter(r => r.is_late).length;
      const totalDays = recs.length;
      const totalHours = parseFloat(recs.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
      const otHours = parseFloat(recs.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));
      const totalLateMinutes = recs.reduce((s, r) => s + (r.late_minutes || 0), 0);
      const leaveDays = leaves.length;

      return {
        user_id: u._id,
        full_name: u.full_name,
        email: u.email,
        department_name: u.department_id?.name || '—',
        present_days: presentDays,
        late_days: lateDays,
        total_days: totalDays,
        absent_days: Math.max(0, 22 - totalDays - leaveDays),
        leave_days: leaveDays,
        total_hours: totalHours,
        ot_hours: otHours,
        total_late_minutes: totalLateMinutes,
      };
    });

    const summary = {
      month: monthStr,
      total_employees: report.length,
      total_attendance_days: report.reduce((s, r) => s + r.total_days, 0),
      total_hours: parseFloat(report.reduce((s, r) => s + r.total_hours, 0).toFixed(1)),
      total_ot_hours: parseFloat(report.reduce((s, r) => s + r.ot_hours, 0).toFixed(1)),
      total_late_cases: report.reduce((s, r) => s + r.late_days, 0),
    };

    res.json({ summary, report });

  } catch (error) {
    console.error('GetMonthlyReport error:', error);
    res.status(500).json({ error: 'Lỗi lấy báo cáo tháng.' });
  }
};

// GET /api/reports/trend?months=6 — Dữ liệu 6 tháng gần nhất cho Line/Bar Chart
const getTrend = async (req, res) => {
  const months = parseInt(req.query.months) || 6;

  try {
    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (req.user.role === 'manager') {
      userFilter.manager_id = req.user._id;
    }
    const userIds = await User.find(userFilter).distinct('_id');

    const now = new Date();
    const trendData = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });

      const records = await Attendance.find({
        user_id: { $in: userIds },
        date: { $regex: `^${monthStr}` }
      });

      const presentCount = records.filter(r => !r.is_late).length;
      const lateCount = records.filter(r => r.is_late).length;
      const totalHours = parseFloat(records.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
      const attendanceRate = userIds.length > 0
        ? Math.round((records.length / (userIds.length * 22)) * 100)
        : 0;

      trendData.push({
        month: monthStr,
        label,
        present: presentCount,
        late: lateCount,
        total_hours: totalHours,
        attendance_rate: Math.min(100, attendanceRate),
      });
    }

    res.json({ months: trendData });

  } catch (error) {
    console.error('GetTrend error:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu trend.' });
  }
};

// GET /api/reports/stats — Thống kê tổng hợp nhanh cho Dashboard Header
const getAttendanceStats = async (req, res) => {
  try {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (req.user.role === 'manager') {
      userFilter.manager_id = req.user._id;
    }

    const [userIds, todayRecords, monthRecords] = await Promise.all([
      User.find(userFilter).distinct('_id'),
      Attendance.find({ user_id: { $exists: true }, date: today }),
      Attendance.find({ date: { $regex: `^${monthStr}` } }),
    ]);

    const totalEmployees = userIds.length;
    const presentToday = todayRecords.filter(r => r.check_in_time).length;
    const lateToday = todayRecords.filter(r => r.is_late).length;
    const absentToday = totalEmployees - presentToday;
    const avgHoursThisMonth = monthRecords.length > 0
      ? parseFloat((monthRecords.reduce((s, r) => s + (r.total_hours || 0), 0) / monthRecords.length).toFixed(1))
      : 0;
    const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

    res.json({
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
      avgHoursThisMonth,
      attendanceRate,
      month: monthStr,
    });

  } catch (error) {
    console.error('GetAttendanceStats error:', error);
    res.status(500).json({ error: 'Lỗi lấy stats.' });
  }
};


// GET /api/reports/ranking?month=7&year=2026 — Xếp hạng nhân viên
const getRanking = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;

    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (req.user.role === 'manager') userFilter.manager_id = req.user._id;

    const users = await User.find(userFilter).select('full_name email department_id').populate('department_id', 'name');
    const userIds = users.map(u => u._id);

    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: { $regex: `^${monthStr}` },
    });

    const ranked = users.map(u => {
      const uid = u._id.toString();
      const recs = attendances.filter(a => a.user_id.toString() === uid);
      const presentDays = recs.length;
      const lateDays = recs.filter(r => r.is_late).length;
      const onTimeDays = presentDays - lateDays;
      const totalHours = parseFloat(recs.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
      const otHours = parseFloat(recs.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));
      const punctualityRate = presentDays > 0 ? Math.round((onTimeDays / presentDays) * 100) : 0;
      // Score: punctuality 50% + attendance 30% + hours 20%
      const score = Math.round((punctualityRate * 0.5) + (Math.min(presentDays / 22, 1) * 100 * 0.3) + (Math.min(totalHours / 176, 1) * 100 * 0.2));

      return {
        user_id: u._id,
        full_name: u.full_name,
        department_name: u.department_id?.name || '—',
        present_days: presentDays,
        late_days: lateDays,
        on_time_days: onTimeDays,
        total_hours: totalHours,
        ot_hours: otHours,
        punctuality_rate: punctualityRate,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    // Gán hạng
    ranked.forEach((r, i) => { r.rank = i + 1; });

    res.json({ month: monthStr, ranking: ranked });
  } catch (error) {
    console.error('GetRanking error:', error);
    res.status(500).json({ error: 'Lỗi xếp hạng nhân viên.' });
  }
};

// GET /api/reports/payroll?month=7&year=2026 — Bảng tính công chính xác
// Công thức: (Ngày công / Ngày chuẩn) + OT*1.5h - Phạt muộn
const getPayroll = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;

    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (req.user.role === 'manager') userFilter.manager_id = req.user._id;

    const users = await User.find(userFilter)
      .select('full_name email department_id')
      .populate('department_id', 'name');

    const userIds = users.map(u => u._id);
    const attendances = await Attendance.find({ user_id: { $in: userIds }, date: { $regex: `^${monthStr}` } });

    // Số ngày làm chuẩn tháng (ước tính 22 ngày)
    const STANDARD_WORK_DAYS = 22;
    const WORK_HOURS_PER_DAY = 8;
    const OT_MULTIPLIER = 1.5;

    const payroll = users.map(u => {
      const uid = u._id.toString();
      const recs = attendances.filter(a => a.user_id.toString() === uid);

      const presentDays = recs.length;
      const lateDays = recs.filter(r => r.is_late).length;
      const totalHours = parseFloat(recs.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
      const otHours = parseFloat(recs.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));
      const totalLateMinutes = recs.reduce((s, r) => s + (r.late_minutes || 0), 0);

      // Tính ngày công quy đổi
      const regularHours = Math.max(0, totalHours - otHours);
      const attendanceDays = parseFloat((regularHours / WORK_HOURS_PER_DAY).toFixed(1));
      const otEquivalentDays = parseFloat((otHours * OT_MULTIPLIER / WORK_HOURS_PER_DAY).toFixed(1));

      // Phạt muộn: muộn nhẹ(1-10p) = 0.25 ngày, muộn(11-30p) = 0.5 ngày, muộn nhiều(>30p) = 1 ngày
      let penaltyDays = 0;
      recs.filter(r => r.is_late).forEach(r => {
        if (r.late_tier === 'late_severe') penaltyDays += 1;
        else if (r.late_tier === 'late_medium') penaltyDays += 0.5;
        else if (r.late_tier === 'late_minor') penaltyDays += 0.25;
        else penaltyDays += 0.25; // fallback
      });

      const totalWorkDays = parseFloat((attendanceDays + otEquivalentDays - penaltyDays).toFixed(2));
      const attendanceRate = STANDARD_WORK_DAYS > 0
        ? parseFloat((Math.min(presentDays / STANDARD_WORK_DAYS, 1) * 100).toFixed(1))
        : 0;

      return {
        user_id: u._id,
        full_name: u.full_name,
        department_name: u.department_id?.name || '—',
        present_days: presentDays,
        absent_days: Math.max(0, STANDARD_WORK_DAYS - presentDays),
        late_days: lateDays,
        total_late_minutes: totalLateMinutes,
        regular_hours: parseFloat(regularHours.toFixed(1)),
        ot_hours: otHours,
        attendance_days: attendanceDays,
        ot_equivalent_days: otEquivalentDays,
        penalty_days: parseFloat(penaltyDays.toFixed(2)),
        total_work_days: Math.max(0, totalWorkDays),
        attendance_rate: attendanceRate,
        standard_work_days: STANDARD_WORK_DAYS,
      };
    });

    res.json({ month: monthStr, standard_work_days: STANDARD_WORK_DAYS, payroll });
  } catch (error) {
    console.error('GetPayroll error:', error);
    res.status(500).json({ error: 'Lỗi tính bảng công.' });
  }
};

// GET /api/reports/individual-detail?user_id=...&month=6&year=2026
const getIndividualDetailReport = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const userId = req.query.user_id || req.user._id;

    const userObj = await User.findById(userId)
      .select('employee_code full_name position department_id')
      .populate('department_id', 'name');

    if (!userObj) {
      return res.status(404).json({ error: 'Nhân viên không tồn tại' });
    }

    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(y, m, 0).getDate();

    const attendances = await Attendance.find({
      user_id: userId,
      date: { $regex: `^${monthStr}` },
    }).sort({ date: 1 });

    const attMap = {};
    attendances.forEach(a => { attMap[a.date] = a; });

    const weekdayNames = ['CN', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy'];

    let workHoursNormal = 0;
    let workHoursWeekend = 0;
    let ot1Hours = 0;
    let ot2Hours = 0;
    let ot3Hours = 0;
    let lateCount = 0;
    let lateMinutes = 0;
    let earlyCount = 0;
    let earlyMinutes = 0;

    const leaveCounts = { V: 0, OM: 0, TS: 0, R: 0, Ro: 0, P: 0, F: 0, CO: 0, CD: 0, H: 0, CT: 0, Le: 0 };

    const dailyLogs = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const att = attMap[dateStr];
      const formatTimeStr = (t) => {
        if (!t) return '';
        if (typeof t === 'string') {
          if (t.includes('T')) {
            const d = new Date(t);
            return isNaN(d.getTime()) ? t.slice(0, 5) : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
          }
          return t.slice(0, 5);
        }
        if (t instanceof Date) {
          return t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
        }
        return String(t);
      };
      const inStr = formatTimeStr(att?.check_in_time);
      const outStr = formatTimeStr(att?.check_out_time);

      const hrs = att?.total_hours || 0;
      const ot = att?.ot_hours || 0;
      const lateM = att?.late_minutes || 0;

      if (isWeekend) workHoursWeekend += hrs;
      else workHoursNormal += hrs;

      if (att?.is_late) {
        lateCount += 1;
        lateMinutes += lateM;
      }

      if (ot > 0) {
        if (isWeekend) ot2Hours += ot;
        else ot1Hours += ot;
      }

      let locationName = 'VP';
      if (att) {
        if (att.check_in_type === 'site') locationName = 'CT1';
        else if (att.check_in_type === 'client') locationName = 'CT2';
        else if (att.check_in_type === 'wfh') locationName = 'WFH';
        else if (att.status === 'leave') {
          locationName = 'Nghỉ';
          leaveCounts.P += 1;
        } else if (hrs === 0) {
          leaveCounts.V += 1;
        }
      }

      dailyLogs.push({
        day: d,
        dateFormatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        weekday: weekdayNames[dayOfWeek],
        isWeekend,
        shift1: { in: inStr, out: outStr },
        shift2: { in: '', out: '' },
        shift3: { in: '', out: '' },
        lateMins: lateM > 0 ? lateM : '',
        earlyMins: '',
        workCredit: hrs > 0 ? (hrs >= 7.5 ? 8 : hrs >= 5.5 ? 6.5 : hrs >= 3.5 ? 4 : hrs) : (hrs === 0 ? 0 : ''),
        totalHours: hrs,
        ot1: ot > 0 && !isWeekend ? ot : '',
        ot2: ot > 0 && isWeekend ? ot : '',
        ot3: '',
        locationName,
      });
    }

    const totalWorkHours = workHoursNormal + workHoursWeekend;

    res.json({
      user: {
        id: userObj.employee_code || `NS ${userObj._id.toString().slice(-4)}`,
        full_name: userObj.full_name,
        position: userObj.position || 'KTS',
        department_name: userObj.department_id?.name || 'Văn Phòng',
      },
      summary: {
        month: m,
        year: y,
        work_hours_normal: parseFloat(workHoursNormal.toFixed(1)),
        work_hours_weekend: parseFloat(workHoursWeekend.toFixed(1)),
        total_work_hours: parseFloat(totalWorkHours.toFixed(1)),
        ot1_hours: parseFloat(ot1Hours.toFixed(1)),
        ot2_hours: parseFloat(ot2Hours.toFixed(1)),
        ot3_hours: parseFloat(ot3Hours.toFixed(1)),
        late_count: lateCount,
        late_minutes: lateMinutes,
        early_count: earlyCount,
        early_minutes: earlyMinutes,
        leave_counts: leaveCounts,
      },
      daily_logs: dailyLogs,
    });
  } catch (error) {
    console.error('GetIndividualDetailReport error:', error);
    res.status(500).json({ error: 'Lỗi tải phiếu chấm công chi tiết.' });
  }
};

// GET /api/reports/leaderboard — Bảng xếp hạng vinh danh đa chiều (Hôm nay / Ngày / Tuần / Tháng / Năm / Toàn bộ)
const getLeaderboard = async (req, res) => {
  try {
    const {
      timeframe = 'today', // 'today' | 'day' | 'week' | 'month' | 'year' | 'all'
      category = 'early_bird', // 'early_bird' | 'work_hours' | 'ot_hours' | 'streak'
      month,
      year,
      date, // YYYY-MM-DD for timeframe === 'day'
      week_start, // YYYY-MM-DD for timeframe === 'week'
      week_end, // YYYY-MM-DD for timeframe === 'week'
      department_id,
    } = req.query;

    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    let targetDayStr = todayStr;
    let startW = null;
    let endW = null;
    let dateFilter = {};

    if (timeframe === 'today') {
      targetDayStr = todayStr;
      dateFilter = { date: todayStr };
    } else if (timeframe === 'day') {
      targetDayStr = (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : todayStr;
      dateFilter = { date: targetDayStr };
    } else if (timeframe === 'week') {
      startW = week_start;
      endW = week_end;
      if (!startW || !endW) {
        // Calculate Monday & Sunday based on provided `date` or today in Vietnam Time
        const refStr = (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : todayStr;
        const [rY, rM, rD] = refStr.split('-').map(Number);
        const refDate = new Date(rY, rM - 1, rD);
        
        // Day of week: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
        const dayOfWeek = refDate.getDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        
        const monday = new Date(refDate);
        monday.setDate(refDate.getDate() + diffToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        startW = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        endW = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      }
      dateFilter = { date: { $gte: startW, $lte: endW } };
    } else if (timeframe === 'month') {
      const monthStr = `${y}-${String(m).padStart(2, '0')}`;
      dateFilter = { date: { $regex: `^${monthStr}` } };
    } else if (timeframe === 'year') {
      dateFilter = { date: { $regex: `^${y}-` } };
    } // 'all' means all records

    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (department_id && department_id !== 'all') {
      userFilter.$or = [
        { department_ids: department_id },
        { department_id: department_id }
      ];
    }

    const users = await User.find(userFilter)
      .select('full_name employee_code avatar_url department_id department_ids role position email phone join_date start_year parking_location vehicle_info employment_status')
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .lean();

    const userIds = users.map(u => u._id);
    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      ...dateFilter,
    }).lean();

    const attByUser = {};
    attendances.forEach(a => {
      const uid = String(a.user_id);
      if (!attByUser[uid]) attByUser[uid] = [];
      attByUser[uid].push(a);
    });

    const currentUserIdStr = String(req.user._id);

    const helperParseTime = (val) => {
      if (!val) return null;
      let d = null;
      if (val instanceof Date) {
        d = val;
      } else if (typeof val === 'string') {
        if (val.includes('T') || val.includes('-')) {
          d = new Date(val);
        } else if (val.includes(':')) {
          const parts = val.trim().split(':').map(Number);
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            return {
              formatted: `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`,
              minutes: (parts[0] * 60) + parts[1]
            };
          }
        }
      }
      if (d && !isNaN(d.getTime())) {
        const formatted = d.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false
        });
        const [hh, mm] = formatted.split(':').map(Number);
        return {
          formatted,
          minutes: (hh * 60) + mm
        };
      }
      return null;
    };

    const rankings = users.map(u => {
      const uid = String(u._id);
      const userAtts = attByUser[uid] || [];

      // Calculate Metrics
      let totalWorkHours = 0;
      let totalOtHours = 0;
      let earliestCheckInStr = null;
      let earliestMinutes = 9999;
      let onTimeDays = 0;
      let lateDays = 0;
      let totalAttDays = 0;

      // Sắp xếp các bản ghi theo ngày tăng dần để tính chuỗi đúng giờ
      userAtts.sort((a, b) => (String(a.date) > String(b.date) ? 1 : -1));
      let currentStreak = 0;
      let maxStreak = 0;

      userAtts.forEach(att => {
        const hrs = Number(att.total_hours) || Number(att.work_hours) || 0;
        const ot = Number(att.ot_hours) || 0;
        totalWorkHours += hrs;
        totalOtHours += ot;

        const isPresent = att.status === 'present' || att.status === 'late' || (hrs > 0) || att.check_in_time;
        if (isPresent) totalAttDays += 1;

        if (att.check_in_time) {
          const parsed = helperParseTime(att.check_in_time);
          if (parsed && parsed.minutes < earliestMinutes) {
            earliestMinutes = parsed.minutes;
            earliestCheckInStr = parsed.formatted;
          }
        }

        const isLate = Boolean(att.is_late) || (att.late_tier && att.late_tier !== 'on_time') || att.status === 'late';
        if (isPresent) {
          if (!isLate) {
            onTimeDays += 1;
            currentStreak += 1;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
          } else {
            lateDays += 1;
            currentStreak = 0;
          }
        }
      });

      // Specific score by category
      let score = 0;
      let displayValue = '';
      let subText = '';

      if (category === 'early_bird') {
        if (timeframe === 'today' || timeframe === 'day') {
          const dayRec = userAtts.find(a => a.date === targetDayStr);
          if (dayRec && dayRec.check_in_time) {
            const parsed = helperParseTime(dayRec.check_in_time);
            if (parsed) {
              // Điểm số: càng sớm điểm càng cao (10000 trừ phút)
              score = 10000 - parsed.minutes;
              displayValue = parsed.formatted;
              const isLate = Boolean(dayRec.is_late) || (dayRec.late_tier && dayRec.late_tier !== 'on_time') || dayRec.status === 'late';
              subText = isLate
                ? (dayRec.late_minutes ? `Muộn ${dayRec.late_minutes}p` : 'Đi muộn')
                : 'Đúng giờ 🌟';
            } else {
              score = -99999;
              displayValue = 'Chưa check-in';
              subText = '—';
            }
          } else {
            score = -99999;
            displayValue = 'Chưa check-in';
            subText = '—';
          }
        } else {
          // Trong tuần / tháng / năm / toàn thời gian:
          score = (onTimeDays * 1000) + (totalAttDays * 10) - (lateDays * 500);
          displayValue = `${onTimeDays} ngày đúng giờ`;
          subText = earliestCheckInStr ? `Sớm nhất: ${earliestCheckInStr}` : (totalAttDays > 0 ? `${totalAttDays} ngày đi làm` : 'Chưa có dữ liệu');
        }
      } else if (category === 'work_hours') {
        score = parseFloat(totalWorkHours.toFixed(1));
        displayValue = `${score} giờ`;
        subText = totalAttDays > 0 ? `${totalAttDays} ngày làm việc` : 'Chưa có giờ làm';
      } else if (category === 'ot_hours') {
        score = parseFloat(totalOtHours.toFixed(1));
        displayValue = `${score}h OT`;
        subText = totalOtHours > 0 ? `Cống hiến ${totalAttDays} ngày` : 'Chưa có giờ OT';
      } else if (category === 'streak') {
        score = maxStreak;
        displayValue = `${maxStreak} ngày liên tiếp`;
        subText = `${onTimeDays} ngày đúng giờ`;
      }

      const deptNames = (u.department_ids && u.department_ids.length > 0)
        ? u.department_ids.map(dep => dep.name)
        : (u.department_id?.name ? [u.department_id.name] : []);

      return {
        user_id: u._id,
        _id: u._id,
        id: u._id,
        full_name: u.full_name,
        employee_code: u.employee_code || 'NS',
        avatar_url: u.avatar_url || null,
        department_name: deptNames.length > 0 ? deptNames.join(', ') : 'Văn Phòng',
        position: u.position || 'Nhân sự',
        role: u.role || 'employee',
        email: u.email || '',
        phone: u.phone || '',
        join_date: u.join_date ? u.join_date : (u.start_year ? `Năm ${u.start_year}` : ''),
        start_year: u.start_year || '',
        employment_status: u.employment_status || 'Đang làm việc',
        parking_location: u.parking_location || 'Tòa 17T10 Nguyễn Thị Định',
        vehicle_info: u.vehicle_info || '',
        score,
        displayValue,
        subText,
        totalWorkHours: parseFloat(totalWorkHours.toFixed(1)),
        totalOtHours: parseFloat(totalOtHours.toFixed(1)),
        onTimeDays,
        lateDays,
        isCurrentUser: uid === currentUserIdStr,
      };
    });

    // Sắp xếp giảm dần theo điểm thành tích (Tie-break: số ngày đúng giờ -> tổng giờ làm -> tên)
    rankings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.onTimeDays !== a.onTimeDays) return b.onTimeDays - a.onTimeDays;
      if (b.totalWorkHours !== a.totalWorkHours) return b.totalWorkHours - a.totalWorkHours;
      return a.full_name.localeCompare(b.full_name);
    });

    // Gán thứ hạng và danh hiệu
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
      if (r.rank === 1) r.tier = 'gold';
      else if (r.rank === 2) r.tier = 'silver';
      else if (r.rank === 3) r.tier = 'bronze';
      else if (r.rank <= 10) r.tier = 'elite';
      else if (r.rank <= 20) r.tier = 'top20';
      else r.tier = 'team';
    });

    const myRankItem = rankings.find(r => r.isCurrentUser);

    res.json({
      timeframe,
      category,
      date: targetDayStr,
      week_start: startW,
      week_end: endW,
      month: m,
      year: y,
      totalParticipants: rankings.length,
      myRank: myRankItem || null,
      top3: rankings.slice(0, 3),
      rankings,
    });
  } catch (error) {
    console.error('GetLeaderboard error:', error);
    res.status(500).json({ error: 'Lỗi tải bảng xếp hạng vinh danh.' });
  }
};

module.exports = {
  getMonthlyReport,
  getTrend,
  getAttendanceStats,
  getRanking,
  getPayroll,
  getIndividualDetailReport,
  getLeaderboard,
};



