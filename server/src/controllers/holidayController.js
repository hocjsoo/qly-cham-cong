// controllers/holidayController.js — Quản lý Ngày Nghỉ Lễ & Tự Động Gửi Thông Báo
const Holiday = require('../models/Holiday');
const Notification = require('../models/Notification');

// GET /api/holidays — Lấy danh sách ngày lễ (cho cả staff & admin)
const getHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await Holiday.find({
      date: { $regex: `^${year}` }
    }).sort({ date: 1 });

    res.json(holidays);
  } catch (error) {
    console.error('GetHolidays error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách ngày nghỉ lễ.' });
  }
};

// POST /api/holidays — Admin thêm ngày nghỉ lễ & tự động thông báo
const createHoliday = async (req, res) => {
  const { name, date, end_date, is_paid = true, note } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: 'Tên ngày lễ và ngày bắt đầu là bắt buộc.' });
  }

  try {
    const holiday = await Holiday.create({
      name: name.trim(),
      date,
      end_date: end_date || date,
      is_paid: Boolean(is_paid),
      note: note?.trim() || null,
      created_by: req.user._id,
    });

    // TỰ ĐỘNG PHÁT THÔNG BÁO TOÀN CÔNG TY
    const dateText = end_date && end_date !== date ? `từ ${date} đến ${end_date}` : `ngày ${date}`;
    await Notification.create({
      user_id: null, // Broadcast all
      title: `📢 THÔNG BÁO NGHỈ LỄ: ${name.toUpperCase()}`,
      message: `Công ty ET Architects thông báo lịch nghỉ lễ "${name}" (${dateText}). Chúc toàn thể CB-NV có kỳ nghỉ an toàn & vui vẻ! 🎉`,
      type: 'announcement',
    });

    res.status(201).json({ message: 'Đã thêm ngày lễ & tự động phát thông báo toàn công ty! 🎉', holiday });
  } catch (error) {
    console.error('CreateHoliday error:', error);
    res.status(500).json({ error: 'Lỗi tạo ngày nghỉ lễ.' });
  }
};

// DELETE /api/holidays/:id — Admin xóa ngày lễ
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    await Holiday.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa ngày nghỉ lễ' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa ngày nghỉ lễ.' });
  }
};

module.exports = { getHolidays, createHoliday, deleteHoliday };
