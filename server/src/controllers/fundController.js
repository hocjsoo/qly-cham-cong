// server/src/controllers/fundController.js
// Quản lý Sổ Quỹ Tạm Ứng Xoay Vòng (Petty Cash Fund) — Nạp quỹ, đối soát và tính số dư dòng tiền

const AdvanceFund = require('../models/AdvanceFund');
const Expense = require('../models/Expense');
const User = require('../models/User');

const formatVND = (num) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
};

// GET /api/funds — Lấy lịch sử nạp quỹ và số dư dòng tiền
const getFunds = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = {};

    if (month && month !== 'all') {
      const targetYear = year || new Date().getFullYear();
      const monthStr = String(month).padStart(2, '0');
      filter.date = { $regex: `^${targetYear}-${monthStr}` };
    } else if (year && year !== 'all') {
      filter.date = { $regex: `^${year}-` };
    }

    const [funds, allFundDeposits, paidFundExpenses] = await Promise.all([
      AdvanceFund.find(filter)
        .populate('holder_id', 'full_name employee_code position avatar_url bank_name bank_account branch')
        .populate('created_by', 'full_name')
        .sort({ date: -1, created_at: -1 })
        .lean(),
      AdvanceFund.find().select('amount date').lean(),
      Expense.find({ payment_status: 'paid' }).select('amount date').lean(),
    ]);

    const totalFundIn = allFundDeposits.reduce((acc, f) => acc + (f.amount || 0), 0);
    const totalFundOut = paidFundExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const fundBalance = totalFundIn - totalFundOut;

    // Lọc theo kỳ hiện tại nếu có lọc tháng/năm
    const periodFundIn = funds.reduce((acc, f) => acc + (f.amount || 0), 0);

    res.json({
      funds,
      stats: {
        totalFundIn,
        totalFundOut,
        fundBalance,
        periodFundIn,
        paidFundCount: paidFundExpenses.length,
        isFiltered: Boolean(month && month !== 'all'),
        periodLabel: month && month !== 'all' ? `Tháng ${month}/${year || new Date().getFullYear()}` : (year && year !== 'all' ? `Năm ${year}` : 'Toàn bộ'),
      },
    });
  } catch (error) {
    console.error('GetFunds error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách sổ quỹ tạm ứng.' });
  }
};

// POST /api/funds — Ghi nhận đợt nạp quỹ mới từ Ban Giám Đốc / Sếp
const createFundDeposit = async (req, res) => {
  try {
    const { date, amount, sender_name, holder_id, note, receipt_url } = req.body;

    if (!date || amount === undefined || amount === null || !holder_id) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ ngày nạp, số tiền và người giữ quỹ.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Số tiền nạp quỹ phải là số dương lớn hơn 0.' });
    }

    const holder = await User.findById(holder_id).select('full_name');
    if (!holder) {
      return res.status(400).json({ error: 'Không tìm thấy người giữ quỹ.' });
    }

    const deposit = await AdvanceFund.create({
      date: date.trim(),
      amount: numAmount,
      sender_name: sender_name ? sender_name.trim() : 'Ban Giám Đốc / Sếp',
      holder_id,
      note: note ? note.trim() : null,
      receipt_url: receipt_url || null,
      created_by: req.user._id,
    });

    const populated = await AdvanceFund.findById(deposit._id)
      .populate('holder_id', 'full_name employee_code position avatar_url bank_name bank_account branch')
      .populate('created_by', 'full_name')
      .lean();

    res.status(201).json({
      message: `Đã ghi nhận nạp quỹ ${formatVND(numAmount)} thành công! 💵`,
      deposit: populated,
    });
  } catch (error) {
    console.error('CreateFundDeposit error:', error);
    res.status(500).json({ error: 'Lỗi ghi nhận đợt nạp quỹ.' });
  }
};

// PUT /api/funds/:id — Cập nhật thông tin đợt nạp quỹ
const updateFundDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, amount, sender_name, holder_id, note, receipt_url } = req.body;

    const deposit = await AdvanceFund.findById(id);
    if (!deposit) {
      return res.status(404).json({ error: 'Không tìm thấy đợt nạp quỹ.' });
    }

    if (date !== undefined) deposit.date = date.trim();
    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Số tiền nạp quỹ phải là số dương lớn hơn 0.' });
      }
      deposit.amount = numAmount;
    }
    if (sender_name !== undefined) deposit.sender_name = sender_name ? sender_name.trim() : 'Ban Giám Đốc / Sếp';
    if (holder_id !== undefined) deposit.holder_id = holder_id;
    if (note !== undefined) deposit.note = note ? note.trim() : null;
    if (receipt_url !== undefined) deposit.receipt_url = receipt_url || null;

    await deposit.save();

    const populated = await AdvanceFund.findById(deposit._id)
      .populate('holder_id', 'full_name employee_code position avatar_url bank_name bank_account branch')
      .populate('created_by', 'full_name')
      .lean();

    res.json({
      message: 'Đã cập nhật thông tin đợt nạp quỹ! ✅',
      deposit: populated,
    });
  } catch (error) {
    console.error('UpdateFundDeposit error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật đợt nạp quỹ.' });
  }
};

// DELETE /api/funds/:id — Xóa đợt nạp quỹ (Admin only)
const deleteFundDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const deposit = await AdvanceFund.findById(id);
    if (!deposit) {
      return res.status(404).json({ error: 'Không tìm thấy đợt nạp quỹ.' });
    }

    await AdvanceFund.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa đợt nạp quỹ thành công! 🗑️' });
  } catch (error) {
    console.error('DeleteFundDeposit error:', error);
    res.status(500).json({ error: 'Lỗi xóa đợt nạp quỹ.' });
  }
};

module.exports = {
  getFunds,
  createFundDeposit,
  updateFundDeposit,
  deleteFundDeposit,
};
