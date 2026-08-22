// controllers/dashboardController.js - Mongoose Dashboard Controller
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Request = require('../models/Request');
const Project = require('../models/Project');

// GET /api/dashboard/today
const getTodaySummary = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Filter users (Chỉ lấy nhân viên đang làm việc, bỏ qua người đã nghỉ việc / nghỉ thai sản / nghỉ ốm / khác)
    let userFilter = {
      is_active: { $ne: false },
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] }
    };
    if (['leader', 'manager'].includes(req.user.role) && req.user.role !== 'admin') {
      const leaderDeptIds = (req.user.department_ids && req.user.department_ids.length > 0)
        ? req.user.department_ids
        : (req.user.department_id ? [req.user.department_id] : []);
      userFilter.$or = [
        { manager_id: req.user._id },
        { department_ids: { $in: leaderDeptIds } },
        { department_id: { $in: leaderDeptIds } }
      ];
    }

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
    const myProjects = await Project.find({
      is_active: { $ne: false },
      $or: [
        { members: req.user._id },
        { pm_id: req.user._id },
        { pm_name: req.user.full_name },
      ]
    })
      .populate('members', 'full_name email avatar_url employee_code position')
      .sort({ progress: -1, updated_at: -1 })
      .limit(6);

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
    } else {
      const teamUserIds = await User.find({ manager_id: req.user._id }).distinct('_id');
      pendingCount = await Request.countDocuments({ status: 'pending', user_id: { $in: teamUserIds } });
    }

    res.json({ pending_count: pendingCount });

  } catch (error) {
    console.error('GetPendingCount error:', error);
    res.status(500).json({ error: 'Lỗi lấy số đơn chờ.' });
  }
};

module.exports = { getTodaySummary, getPendingCount };
