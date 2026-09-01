// controllers/holidayController.js - Quan ly Ngay Nghi Le & Tu Dong Gui Thong Bao
const Holiday = require('../models/Holiday');
const Notification = require('../models/Notification');

const ALLOWED_WORK_MULTIPLIERS = new Set([1.5, 2, 3]);
const normalizeHolidayMultiplier = value => {
  const parsed = Number(value);
  return ALLOWED_WORK_MULTIPLIERS.has(parsed) ? parsed : null;
};

// GET /api/holidays
const getHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? String(req.query.month).padStart(2, '0') : null;
    const periodStart = month ? `${year}-${month}-01` : `${year}-01-01`;
    const periodEnd = month
      ? `${year}-${month}-${String(new Date(year, Number(month), 0).getDate()).padStart(2, '0')}`
      : `${year}-12-31`;
    // Match every holiday range that overlaps the requested period. These range
    // predicates can use the date/end_date indexes and avoid per-document regex scans.
    const query = {
      $or: [
        { date: { $gte: periodStart, $lte: periodEnd } },
        { end_date: { $gte: periodStart, $lte: periodEnd } },
        { date: { $lte: periodStart }, end_date: { $gte: periodEnd } },
      ],
    };
    const holidays = await Holiday.find(query)
      .select('name date end_date is_paid work_multiplier note created_by created_at updated_at')
      .sort({ date: 1 })
      .lean();
    // Legacy documents may not contain work_multiplier. Expose the safe default
    // in the DTO without writing to the database from this GET request.
    res.json(holidays.map(holiday => {
      const value = typeof holiday.toObject === 'function' ? holiday.toObject() : holiday;
      return {
        ...value,
        work_multiplier: normalizeHolidayMultiplier(value.work_multiplier) || 1.5,
      };
    }));
  } catch (error) {
    console.error('GetHolidays error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách ngày nghỉ lễ.' });
  }
};

// POST /api/holidays
const createHoliday = async (req, res) => {
  const { name, date, end_date, is_paid = false, work_multiplier = 1.5, note, send_notification = true } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Tên ngày lễ và ngày bắt đầu là bắt buộc.' });
  const normalizedMultiplier = normalizeHolidayMultiplier(work_multiplier);
  if (normalizedMultiplier === null) {
    return res.status(400).json({ error: 'Hệ số công ngày lễ chỉ chấp nhận 1.5, 2 hoặc 3.' });
  }

  try {
    const holiday = await Holiday.create({
      name: name.trim(), date, end_date: end_date || date,
      is_paid: Boolean(is_paid), work_multiplier: normalizedMultiplier,
      note: note?.trim() || null, created_by: req.user._id,
    });

    if (send_notification) {
      const dateText = end_date && end_date !== date ? `từ ${date} đến ${end_date}` : `ngày ${date}`;
      const fullMessage = note && note.trim()
        ? note.trim()
        : `Công ty thông báo lịch nghỉ lễ "${name}" (${dateText}).`;

      const upperName = name.toUpperCase().trim();
      const notifTitle = upperName.startsWith('THÔNG BÁO')
        ? `📢 ${upperName}`
        : `📢 THÔNG BÁO NGHỈ LỄ: ${upperName}`;

      await Notification.create({
        user_id: null,
        title: notifTitle,
        message: fullMessage,
        type: 'announcement',
      });
    }

    res.status(201).json({
      message: send_notification ? 'Đã thêm ngày lễ & phát thông báo!' : 'Đã thêm ngày lễ (không phát thông báo)!',
      holiday
    });
  } catch (error) {
    console.error('CreateHoliday error:', error);
    res.status(500).json({ error: 'Lỗi tạo ngày nghỉ lễ.' });
  }
};

// PUT /api/holidays/:id
const updateHoliday = async (req, res) => {
  const { name, date, end_date, is_paid, work_multiplier, note, send_notification = false } = req.body;
  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (date) updateData.date = date;
    if (end_date !== undefined) updateData.end_date = end_date || date;
    if (is_paid !== undefined) updateData.is_paid = Boolean(is_paid);
    if (work_multiplier !== undefined) {
      const normalizedMultiplier = normalizeHolidayMultiplier(work_multiplier);
      if (normalizedMultiplier === null) {
        return res.status(400).json({ error: 'Hệ số công ngày lễ chỉ chấp nhận 1.5, 2 hoặc 3.' });
      }
      updateData.work_multiplier = normalizedMultiplier;
    }
    if (note !== undefined) updateData.note = note?.trim() || null;

    const holiday = await Holiday.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!holiday) return res.status(404).json({ error: 'Không tìm thấy ngày lễ.' });

    if (send_notification) {
      const dateText = holiday.end_date && holiday.end_date !== holiday.date ? `từ ${holiday.date} đến ${holiday.end_date}` : `ngày ${holiday.date}`;
      const fullMessage = holiday.note && holiday.note.trim()
        ? holiday.note.trim()
        : `Công ty cập nhật lịch nghỉ lễ "${holiday.name}" (${dateText}).`;

      const upperName = holiday.name.toUpperCase().trim();
      const notifTitle = upperName.startsWith('THÔNG BÁO') || upperName.startsWith('CẬP NHẬT')
        ? `📢 ${upperName}`
        : `📢 CẬP NHẬT LỊCH NGHỈ LỄ: ${upperName}`;

      await Notification.create({
        user_id: null,
        title: notifTitle,
        message: fullMessage,
        type: 'announcement',
      });
    }

    res.json({ message: 'Đã cập nhật ngày nghỉ lễ thành công!', holiday });
  } catch (error) {
    console.error('UpdateHoliday error:', error);
    res.status(500).json({ error: 'Lỗi sửa ngày nghỉ lễ.' });
  }
};

// DELETE /api/holidays/:id
const deleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa ngày nghỉ lễ' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa ngày nghỉ lễ.' });
  }
};

// POST /api/holidays/seed-vietnam - Nap tu dong ngay le Viet Nam theo nam (khong huong luong)
const seedVietnamHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const fixedHolidays = [
      { date: `${year}-01-01`, end_date: `${year}-01-01`, name: 'Tet Duong lich', is_paid: false, work_multiplier: 1.5 },
      { date: `${year}-04-30`, end_date: `${year}-05-01`, name: 'Ngay Giai phong mien Nam & Quoc te Lao dong', is_paid: false, work_multiplier: 1.5 },
      { date: `${year}-09-02`, end_date: `${year}-09-02`, name: 'Quoc khanh', is_paid: false, work_multiplier: 1.5 },
    ];

    const tetDates = {
      2024: { start: '2024-02-08', end: '2024-02-14' },
      2025: { start: '2025-01-28', end: '2025-02-02' },
      2026: { start: '2026-02-17', end: '2026-02-22' },
      2027: { start: '2027-02-06', end: '2027-02-12' },
    };
    if (tetDates[year]) {
      fixedHolidays.push({ date: tetDates[year].start, end_date: tetDates[year].end, name: 'Tet Nguyen Dan', is_paid: false, work_multiplier: 1.5 });
    }

    const giotoHV = { 2024: '2024-04-18', 2025: '2025-04-07', 2026: '2026-03-28', 2027: '2027-04-15' };
    if (giotoHV[year]) {
      fixedHolidays.push({ date: giotoHV[year], end_date: giotoHV[year], name: 'Gio To Hung Vuong', is_paid: false, work_multiplier: 1.5 });
    }

    let added = 0, skipped = 0;
    for (const h of fixedHolidays) {
      const exists = await Holiday.findOne({ date: h.date });
      if (!exists) {
        await Holiday.create({ ...h, note: 'Tu dong nap', created_by: req.user._id });
        added++;
      } else { skipped++; }
    }

    res.json({ message: `Da nap ${added} ngay le cho nam ${year} (bo qua ${skipped} ngay da co).`, added, skipped });
  } catch (error) {
    console.error('SeedVietnamHolidays error:', error);
    res.status(500).json({ error: 'Loi nap ngay le.' });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  seedVietnamHolidays,
  normalizeHolidayMultiplier,
};
