// controllers/dashboardController.js - Mongoose Dashboard Controller
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Request = require('../models/Request');

// GET /api/dashboard/today
const getTodaySummary = async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Filter users
    let userFilter = { is_active: true };
    if (req.user.role !== 'admin') {
      userFilter.manager_id = req.user._id;
    }

    const users = await User.find(userFilter)
      .select('full_name email role department_id')
      .populate('department_id', 'name');

    const userIds = users.map(u => u._id);

    // Lấy attendance hôm nay
    const attendances = await Attendance.find({
      user_id: { $in: userIds },
      date: today
    });

    // Map attendance sang dictionary
    const attMap = new Map();
    attendances.forEach(a => attMap.set(a.user_id.toString(), a));

    // Tổng hợp từng nhân viên
    const staff = users.map(u => {
      const att = attMap.get(u._id.toString());
      let today_status = 'absent';
      if (att) {
        today_status = att.check_out_time ? 'checked_out' : 'checked_in';
      }

      return {
        user_id: u._id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        department_name: u.department_id?.name || '—',
        check_in_time: att?.check_in_time || null,
        check_in_type: att?.check_in_type || null,
        check_out_time: att?.check_out_time || null,
        total_hours: att?.total_hours || 0,
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
      staff
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
