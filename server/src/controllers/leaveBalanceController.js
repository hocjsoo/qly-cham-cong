// controllers/leaveBalanceController.js - Quản lý số ngày phép
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');

// Lấy hoặc tạo balance cho user trong năm hiện tại
const getOrCreateBalance = async (userId, year) => {
  let bal = await LeaveBalance.findOne({ user_id: userId, year });
  if (!bal) {
    bal = await LeaveBalance.create({ user_id: userId, year });
  }
  return bal;
};

// GET /api/leave-balance/me — Balance của chính tôi
const getMyBalance = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const bal = await getOrCreateBalance(req.user._id, year);

    res.json({
      year,
      annual_leave: {
        total: bal.annual_leave_total,
        used: bal.annual_leave_used,
        remaining: bal.annual_leave_total - bal.annual_leave_used,
      },
      sick_leave: {
        total: bal.sick_leave_total,
        used: bal.sick_leave_used,
        remaining: bal.sick_leave_total - bal.sick_leave_used,
      },
      unpaid_leave_used: bal.unpaid_leave_used,
    });
  } catch (error) {
    console.error('GetMyBalance error:', error);
    res.status(500).json({ error: 'Lỗi lấy số ngày phép.' });
  }
};

// GET /api/leave-balance — Tất cả nhân viên (Admin/Manager)
const getAllBalances = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const users = await User.find({ is_active: { $ne: false } }).select('full_name email department_id');
    
    const results = await Promise.all(users.map(async (u) => {
      const bal = await getOrCreateBalance(u._id, year);
      return {
        user: { id: u._id, full_name: u.full_name, email: u.email },
        year,
        annual_leave: {
          total: bal.annual_leave_total,
          used: bal.annual_leave_used,
          remaining: bal.annual_leave_total - bal.annual_leave_used,
        },
        sick_leave: {
          total: bal.sick_leave_total,
          used: bal.sick_leave_used,
          remaining: bal.sick_leave_total - bal.sick_leave_used,
        },
      };
    }));

    res.json(results);
  } catch (error) {
    console.error('GetAllBalances error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách ngày phép.' });
  }
};

// PUT /api/leave-balance/:userId — Admin chỉnh sửa số ngày phép
const updateBalance = async (req, res) => {
  const { annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, year } = req.body;

  try {
    const y = parseInt(year) || new Date().getFullYear();
    const bal = await getOrCreateBalance(req.params.userId, y);

    if (annual_leave_total !== undefined) bal.annual_leave_total = annual_leave_total;
    if (annual_leave_used !== undefined) bal.annual_leave_used = annual_leave_used;
    if (sick_leave_total !== undefined) bal.sick_leave_total = sick_leave_total;
    if (sick_leave_used !== undefined) bal.sick_leave_used = sick_leave_used;

    await bal.save();
    res.json({ message: 'Đã cập nhật số ngày phép.', balance: bal });
  } catch (error) {
    console.error('UpdateBalance error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật ngày phép.' });
  }
};

// Internal: Trừ ngày phép khi đơn được duyệt
const deductLeaveOnApproval = async (userId, type, startDate, endDate) => {
  try {
    const year = new Date(startDate).getFullYear();
    const bal = await getOrCreateBalance(userId, year);

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date((endDate || startDate) + 'T00:00:00');
    const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    if (type === 'annual_leave') {
      bal.annual_leave_used = Math.min(bal.annual_leave_total, bal.annual_leave_used + days);
    } else if (type === 'sick_leave') {
      bal.sick_leave_used = Math.min(bal.sick_leave_total, bal.sick_leave_used + days);
    }

    await bal.save();
    return { success: true, days_deducted: days };
  } catch (err) {
    console.error('DeductLeave error:', err);
    return { success: false };
  }
};

module.exports = { getMyBalance, getAllBalances, updateBalance, deductLeaveOnApproval };
