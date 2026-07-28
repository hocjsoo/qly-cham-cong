// controllers/holidayController.js - Quan ly Ngay Nghi Le & Tu Dong Gui Thong Bao
const Holiday = require('../models/Holiday');
const Notification = require('../models/Notification');

// GET /api/holidays
const getHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await Holiday.find({ date: { $regex: `^${year}` } }).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    console.error('GetHolidays error:', error);
    res.status(500).json({ error: 'Loi lay danh sach ngay nghi le.' });
  }
};

// POST /api/holidays
const createHoliday = async (req, res) => {
  const { name, date, end_date, is_paid = false, note } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Ten ngay le va ngay bat dau la bat buoc.' });

  try {
    const holiday = await Holiday.create({
      name: name.trim(), date, end_date: end_date || date,
      is_paid: Boolean(is_paid), note: note?.trim() || null, created_by: req.user._id,
    });
    const dateText = end_date && end_date !== date ? `tu ${date} den ${end_date}` : `ngay ${date}`;
    await Notification.create({
      user_id: null,
      title: `THONG BAO NGHI LE: ${name.toUpperCase()}`,
      message: `Cong ty thong bao lich nghi le "${name}" (${dateText}).`,
      type: 'announcement',
    });
    res.status(201).json({ message: 'Da them ngay le & tu dong phat thong bao!', holiday });
  } catch (error) {
    console.error('CreateHoliday error:', error);
    res.status(500).json({ error: 'Loi tao ngay nghi le.' });
  }
};

// DELETE /api/holidays/:id
const deleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: 'Da xoa ngay nghi le' });
  } catch (error) {
    res.status(500).json({ error: 'Loi xoa ngay nghi le.' });
  }
};

// POST /api/holidays/seed-vietnam - Nap tu dong ngay le Viet Nam theo nam (khong huong luong)
const seedVietnamHolidays = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const fixedHolidays = [
      { date: `${year}-01-01`, end_date: `${year}-01-01`, name: 'Tet Duong lich', is_paid: false },
      { date: `${year}-04-30`, end_date: `${year}-05-01`, name: 'Ngay Giai phong mien Nam & Quoc te Lao dong', is_paid: false },
      { date: `${year}-09-02`, end_date: `${year}-09-02`, name: 'Quoc khanh', is_paid: false },
    ];

    const tetDates = {
      2024: { start: '2024-02-08', end: '2024-02-14' },
      2025: { start: '2025-01-28', end: '2025-02-02' },
      2026: { start: '2026-02-17', end: '2026-02-22' },
      2027: { start: '2027-02-06', end: '2027-02-12' },
    };
    if (tetDates[year]) {
      fixedHolidays.push({ date: tetDates[year].start, end_date: tetDates[year].end, name: 'Tet Nguyen Dan', is_paid: false });
    }

    const giotoHV = { 2024: '2024-04-18', 2025: '2025-04-07', 2026: '2026-03-28', 2027: '2027-04-15' };
    if (giotoHV[year]) {
      fixedHolidays.push({ date: giotoHV[year], end_date: giotoHV[year], name: 'Gio To Hung Vuong', is_paid: false });
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

module.exports = { getHolidays, createHoliday, deleteHoliday, seedVietnamHolidays };
