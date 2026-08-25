// controllers/announcementController.js
// Quan ly thong bao noi bo (ghim) & sinh nhat nhan su
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const SystemSetting = require('../models/SystemSetting');
const User = require('../models/User');

// GET /api/announcements/birthdays?month=7
const getBirthdays = async (req, res) => {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const month = req.query.month ? parseInt(req.query.month) : (now.getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');
    const todayDay = now.getDate();

    const setting = await SystemSetting.findOne({ key: 'global' }).lean() || {};
    const displayMode = setting.anniversary_display_mode || 'month';
    const displayDays = setting.anniversary_display_days || 7;

    // dob format: YYYY-MM-DD hoac DD/MM/YYYY
    // Tim tat ca users co sinh nhat
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
      let userMonth = null;
      let userDay = null;

      if (d.includes('-')) {
        const parts = d.split('-');
        userMonth = parseInt(parts[1]);
        userDay = parseInt(parts[2]);
      } else if (d.includes('/')) {
        const parts = d.split('/');
        userMonth = parseInt(parts[1]);
        userDay = parseInt(parts[0]);
      }

      if (!userMonth || userMonth !== month) return false;

      // Filter based on Display Mode
      if (displayMode === 'exact_day') {
        return userDay === todayDay;
      } else if (displayMode === 'week' || displayMode === 'days_around') {
        const delta = Math.abs((userDay || 0) - todayDay);
        const maxDelta = displayMode === 'week' ? 3 : Math.ceil(displayDays / 2);
        return delta <= maxDelta;
      }

      return true; // 'month': trong suốt cả tháng
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
        avatar_url: u.avatar_url || '/logo.png',
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

    // Lấy thêm các broadcast notifications từ Admin còn hạn
    const broadcastNotifs = await Notification.find({
      type: 'announcement',
      user_id: null,
      $or: [
        { expires_at: null },
        { expires_at: { $gt: now } }
      ]
    }).sort({ created_at: -1 }).limit(10);

    const existingTitles = new Set(announcements.map(a => a.title.trim().toLowerCase()));

    const extraAnnouncements = broadcastNotifs
      .filter(n => !existingTitles.has(n.title.replace(/^📢\s*/, '').trim().toLowerCase()))
      .map(n => ({
        _id: n._id,
        title: n.title.replace(/^📢\s*/, ''),
        content: n.message,
        is_pinned: true,
        created_at: n.created_at,
        expires_at: n.expires_at,
        created_by: { full_name: 'Ban Giám Đốc / Admin' },
      }));

    const combined = [...announcements, ...extraAnnouncements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(combined);
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
    const todayDay = now.getDate();

    const setting = await SystemSetting.findOne({ key: 'global' }).lean() || {};
    const displayMode = setting.anniversary_display_mode || 'month';
    const displayDays = setting.anniversary_display_days || 7;

    const users = await User.find({
      employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] },
      is_active: { $ne: false },
    })
      .select('full_name email phone position start_year join_date created_at dob department_id department_ids avatar_url employee_code')
      .populate('department_id', 'name')
      .populate('department_ids', 'name');

    const targetMonth = req.query.month ? parseInt(req.query.month) : currentMonth;

    const anniversaries = [];
    for (const u of users) {
      let joinYear = null;
      let joinMonth = null;
      let joinDay = null;

      if (u.join_date && typeof u.join_date === 'string' && u.join_date.includes('-')) {
        const parts = u.join_date.split('-');
        joinYear = parseInt(parts[0]);
        joinMonth = parseInt(parts[1]);
        joinDay = parseInt(parts[2]);
      } else if (u.created_at) {
        const joinDate = new Date(u.created_at);
        joinYear = joinDate.getFullYear();
        joinMonth = joinDate.getMonth() + 1;
        joinDay = joinDate.getDate();
      } else if (u.start_year && !isNaN(parseInt(u.start_year))) {
        joinYear = parseInt(u.start_year);
      }

      // Chỉ lấy kỷ niệm gắn bó đúng trong tháng hiện tại (nếu biết tháng) và ít nhất 1 năm
      const isSameMonth = joinMonth ? joinMonth === targetMonth : true;

      if (joinYear && currentYear > joinYear && isSameMonth) {
        // Filter based on Display Mode if target month is current month
        if (targetMonth === currentMonth && joinDay) {
          if (displayMode === 'exact_day' && joinDay !== todayDay) {
            continue;
          } else if ((displayMode === 'week' || displayMode === 'days_around')) {
            const delta = Math.abs(joinDay - todayDay);
            const maxDelta = displayMode === 'week' ? 3 : Math.ceil(displayDays / 2);
            if (delta > maxDelta) continue;
          }
        }

        const yearsCount = currentYear - joinYear;
        if (yearsCount >= 1) {
          const deptNames = (u.department_ids && u.department_ids.length > 0)
            ? u.department_ids.map(dep => dep.name)
            : (u.department_id?.name ? [u.department_id.name] : []);

          anniversaries.push({
            user_id: u._id,
            id: u._id,
            _id: u._id,
            full_name: u.full_name,
            email: u.email,
            phone: u.phone || '',
            avatar_url: u.avatar_url || '/logo.png',
            employee_code: u.employee_code || 'NS-000',
            position: u.position || 'Nhân viên',
            department_name: deptNames.length > 0 ? deptNames.join(', ') : '—',
            years: yearsCount,
            years_count: yearsCount,
            start_year: joinYear,
            join_date: u.join_date || (u.start_year ? `Năm ${u.start_year}` : ''),
            anniversary_date: u.join_date ? u.join_date : `Năm ${joinYear}`,
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
