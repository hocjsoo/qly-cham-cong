// controllers/announcementController.js
// Quan ly thong bao noi bo (ghim) & sinh nhat nhan su
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// GET /api/announcements/birthdays?month=7
const getBirthdays = async (req, res) => {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const month = req.query.month ? parseInt(req.query.month) : (now.getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');

    // dob format: YYYY-MM-DD hoac DD/MM/YYYY
    // Tim tat ca users co sinh nhat thang nay
    const users = await User.find({
      dob: { $ne: null, $exists: true },
      employment_status: { $ne: 'Da nghi viec' },
      is_active: true,
    }).select('full_name dob position department_id avatar_url employee_code employee_type');

    const birthdays = users.filter(u => {
      if (!u.dob) return false;
      const d = u.dob;
      // Ho tro format YYYY-MM-DD va DD/MM/YYYY
      if (d.includes('-')) {
        const parts = d.split('-');
        return parts[1] === monthStr;
      } else if (d.includes('/')) {
        const parts = d.split('/');
        return parts[1] === monthStr;
      }
      return false;
    }).map(u => {
      const d = u.dob;
      let day = '';
      if (d.includes('-')) day = d.split('-')[2];
      else if (d.includes('/')) day = d.split('/')[0];
      return {
        _id: u._id,
        full_name: u.full_name,
        dob: u.dob,
        day,
        position: u.position,
        avatar_url: u.avatar_url,
        employee_code: u.employee_code,
        employee_type: u.employee_type,
      };
    }).sort((a, b) => parseInt(a.day) - parseInt(b.day));

    res.json({ month, birthdays });
  } catch (error) {
    console.error('GetBirthdays error:', error);
    res.status(500).json({ error: 'Loi lay danh sach sinh nhat.' });
  }
};

// GET /api/announcements/pinned
const getPinned = async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      is_pinned: true,
      is_active: true,
      $or: [
        { expires_at: null },
        { expires_at: { $gt: now } }
      ]
    })
      .populate('created_by', 'full_name')
      .sort({ created_at: -1 })
      .limit(10);

    res.json(announcements);
  } catch (error) {
    console.error('GetPinned error:', error);
    res.status(500).json({ error: 'Loi lay thong bao ghim.' });
  }
};

// GET /api/announcements
const getAll = async (req, res) => {
  try {
    const announcements = await Announcement.find({ is_active: true })
      .populate('created_by', 'full_name')
      .sort({ created_at: -1 });
    res.json(announcements);
  } catch (error) {
    console.error('GetAll announcements error:', error);
    res.status(500).json({ error: 'Loi lay thong bao.' });
  }
};

// POST /api/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, is_pinned, expires_at } = req.body;
    if (!title) return res.status(400).json({ error: 'Tieu de khong duoc de trong.' });

    const announcement = await Announcement.create({
      title,
      content: content || '',
      is_pinned: is_pinned !== undefined ? is_pinned : true,
      expires_at: expires_at || null,
      created_by: req.user._id,
      is_active: true,
    });

    res.status(201).json({ message: 'Da tao thong bao!', announcement });
  } catch (error) {
    console.error('CreateAnnouncement error:', error);
    res.status(500).json({ error: 'Loi tao thong bao.' });
  }
};

// PUT /api/announcements/:id
const updateAnnouncement = async (req, res) => {
  try {
    const { title, content, is_pinned, expires_at, is_active } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    if (expires_at !== undefined) updateData.expires_at = expires_at;
    if (is_active !== undefined) updateData.is_active = is_active;

    const ann = await Announcement.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!ann) return res.status(404).json({ error: 'Khong tim thay thong bao.' });

    res.json({ message: 'Da cap nhat thong bao!', announcement: ann });
  } catch (error) {
    console.error('UpdateAnnouncement error:', error);
    res.status(500).json({ error: 'Loi cap nhat thong bao.' });
  }
};

// DELETE /api/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Khong tim thay thong bao.' });
    res.json({ message: 'Da xoa thong bao.' });
  } catch (error) {
    console.error('DeleteAnnouncement error:', error);
    res.status(500).json({ error: 'Loi xoa thong bao.' });
  }
};

module.exports = { getBirthdays, getPinned, getAll, createAnnouncement, updateAnnouncement, deleteAnnouncement };
