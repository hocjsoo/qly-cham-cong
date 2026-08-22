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
    })
      .select('full_name email phone dob position department_id department_ids avatar_url employee_code employee_type')
      .populate('department_id', 'name')
      .populate('department_ids', 'name');

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

      const deptNames = (u.department_ids && u.department_ids.length > 0)
        ? u.department_ids.map(dep => dep.name)
        : (u.department_id?.name ? [u.department_id.name] : []);

      return {
        _id: u._id,
        user_id: u._id,
        id: u._id,
        full_name: u.full_name,
        email: u.email || '',
        phone: u.phone || '',
        dob: u.dob,
        day,
        position: u.position || 'Nhân viên',
        department_name: deptNames.length > 0 ? deptNames.join(', ') : '—',
        avatar_url: u.avatar_url,
        employee_code: u.employee_code || 'NS-000',
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

// GET /api/announcements/anniversaries
// Danh sách nhân sự kỷ niệm 1, 2, 3+ năm gắn bó & sinh nhật
const getAnniversaries = async (req, res) => {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthStr = String(currentMonth).padStart(2, '0');

    const users = await User.find({
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] },
      is_active: { $ne: false },
    })
      .select('full_name email phone position start_year created_at dob department_id department_ids avatar_url employee_code')
      .populate('department_id', 'name')
      .populate('department_ids', 'name');

    const targetMonth = req.query.month ? parseInt(req.query.month) : currentMonth;

    const anniversaries = [];
    for (const u of users) {
      let joinYear = null;
      let joinMonth = null;

      if (u.created_at) {
        const joinDate = new Date(u.created_at);
        joinYear = joinDate.getFullYear();
        joinMonth = joinDate.getMonth() + 1;
      } else if (u.start_year && !isNaN(parseInt(u.start_year))) {
        joinYear = parseInt(u.start_year);
      }

      // Chỉ lấy kỷ niệm gắn bó đúng trong tháng hiện tại (nếu biết tháng) và ít nhất 1 năm
      const isSameMonth = joinMonth ? joinMonth === targetMonth : true;

      if (joinYear && currentYear > joinYear && isSameMonth) {
        const yearsCount = currentYear - joinYear;
        if (yearsCount >= 1) {
          const deptNames = (u.department_ids && u.department_ids.length > 0)
            ? u.department_ids.map(dep => dep.name)
            : (u.department_id?.name ? [u.department_id.name] : []);

          anniversaries.push({
            user_id: u._id,
            id: u._id,
            full_name: u.full_name,
            email: u.email,
            avatar_url: u.avatar_url,
            employee_code: u.employee_code,
            position: u.position || 'Nhân viên',
            department_name: deptNames.length > 0 ? deptNames.join(', ') : '—',
            years_count: yearsCount,
            start_year: joinYear,
            badge: yearsCount >= 5 ? '🏆 5+ Năm Gắn Bó' : yearsCount >= 3 ? '🎖️ 3+ Năm Cống Hiến' : `${yearsCount} Năm Đồng Hành`,
          });
        }
      }
    }

    // Sắp xếp người gắn bó nhiều năm nhất lên đầu
    anniversaries.sort((a, b) => b.years_count - a.years_count);

    res.json({
      current_year: currentYear,
      current_month: currentMonth,
      anniversaries,
    });
  } catch (error) {
    console.error('GetAnniversaries error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách kỷ niệm.' });
  }
};

// DELETE /api/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
    res.json({ message: 'Đã xóa thông báo.' });
  } catch (error) {
    console.error('DeleteAnnouncement error:', error);
    res.status(500).json({ error: 'Lỗi xóa thông báo.' });
  }
};

module.exports = { getBirthdays, getAnniversaries, getPinned, getAll, createAnnouncement, updateAnnouncement, deleteAnnouncement };
