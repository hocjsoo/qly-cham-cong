// controllers/dashboardController.js - Mongoose Dashboard Controller
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Request = require('../models/Request');
const Project = require('../models/Project');
const {
  isLeaderRole,
  buildLeaderUserScope,
  combineUserFilters,
} = require('../utils/roleScope');

// GET /api/dashboard/today
const getTodaySummary = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Filter users (Chỉ lấy nhân viên cần điểm danh đang làm việc, bỏ qua người miễn chấm công / đã nghỉ việc / nghỉ thai sản / nghỉ ốm / khác)
    const activeUserFilter = {
      is_active: { $ne: false },
      is_attendance_exempt: { $ne: true },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    const userFilter = isLeaderRole(req.user)
      ? combineUserFilters(activeUserFilter, buildLeaderUserScope(req.user, { includeSelf: true }))
      : activeUserFilter;

    const users = await User.find(userFilter)
      .select('full_name email role department_id department_ids avatar_url employee_code phone')
      .populate('department_id', 'name')
      .populate('department_ids', 'name');

    const userIds = users.map(u => u._id);

    // Lấy attendance hôm nay
    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: today
    });

    // Map attendance sang dictionary
    const attMap = new Map();
    attendances.forEach(a => attMap.set(a.user_id.toString(), a));

    // Lấy danh sách dự án của người dùng hiện tại (là PM hoặc là thành viên)
    const userFullName = (req.user.full_name || '').trim();
    const escapedName = userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexName = userFullName ? new RegExp(escapedName, 'i') : null;

    let orConditions = [
      { members: req.user._id },
      { pm_id: req.user._id },
    ];
    if (regexName) {
      orConditions.push({ pm_name: regexName });
    }

    let myProjects = await Project.find({
      is_active: { $ne: false },
      ...(req.user.role === 'admin' ? {} : { $or: orConditions })
    })
      .select('name code category avatar_url status progress deadline start_date pm_id pm_name members updated_at created_at')
      .sort({ progress: -1, updated_at: -1 })
      .limit(6)
      .lean();

    // Fallback chỉ dành cho Admin nếu chưa gán dự án riêng
    if (myProjects.length === 0 && req.user.role === 'admin') {
      myProjects = await Project.find({
        is_active: { $ne: false },
        status: { $nin: ['Đã hoàn thành', 'Đã lưu trữ', 'cancelled'] }
      })
        .select('name code category avatar_url status progress deadline start_date pm_id pm_name members updated_at created_at')
        .sort({ progress: -1, updated_at: -1 })
        .limit(6)
        .lean();
    }

    // Tổng hợp từng nhân viên
    const staff = users.map(u => {
      const att = attMap.get(u._id.toString());
      let today_status = 'absent';
      if (att) {
        today_status = att.check_out_time ? 'checked_out' : 'checked_in';
      }

      const deptNames = (u.department_ids && u.department_ids.length > 0)
        ? u.department_ids.map(d => d.name)
        : (u.department_id?.name ? [u.department_id.name] : []);

      return {
        user_id: u._id,
        id: u._id,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone || '',
        employee_code: u.employee_code || '—',
        avatar_url: u.avatar_url || null,
        role: u.role,
        department_name: deptNames.length > 0 ? deptNames.join(', ') : '—',
        check_in_time: att?.check_in_time || null,
        check_in_type: att?.check_in_type || null,
        check_out_time: att?.check_out_time || null,
        total_hours: att?.total_hours || 0,
        work_units: att?.work_units || 1.0,
        status: att?.status || 'absent',
        today_status,
      };
    });

    const summary = {
      total: staff.length,
      checked_in: staff.filter(s => s.today_status === 'checked_in').length,
      checked_out: staff.filter(s => s.today_status === 'checked_out').length,
      absent: staff.filter(s => s.today_status === 'absent').length,
      present_total: staff.filter(s => s.today_status !== 'absent').length,
    };

    res.json({
      date: today,
      summary,
      staff,
      my_projects: myProjects,
    });

  } catch (error) {
    console.error('GetTodaySummary error:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu dashboard.' });
  }
};

// GET /api/dashboard/pending-count
const getPendingCount = async (req, res) => {
  try {
    let pendingCount = 0;
    if (req.user.role === 'admin') {
      pendingCount = await Request.countDocuments({ status: 'pending' });
    } else if (isLeaderRole(req.user)) {
      const teamUserIds = await User.find(
        buildLeaderUserScope(req.user, { includeSelf: false })
      ).distinct('_id');
      pendingCount = await Request.countDocuments({ status: 'pending', user_id: { $in: teamUserIds } });
    }

    res.json({ pending_count: pendingCount });

  } catch (error) {
    console.error('GetPendingCount error:', error);
    res.status(500).json({ error: 'Lỗi lấy số đơn chờ.' });
  }
};

module.exports = { getTodaySummary, getPendingCount };
