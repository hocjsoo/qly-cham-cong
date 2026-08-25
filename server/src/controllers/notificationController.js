// controllers/notificationController.js - Notification Engine
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Request = require('../models/Request');
const Holiday = require('../models/Holiday');

const TYPE_LABELS = {
  late: 'Đi muộn', early_leave: 'Về sớm', overtime: 'Tăng ca',
  business_trip: 'Công tác/WFH', sick_leave: 'Nghỉ ốm', annual_leave: 'Nghỉ phép', other: 'Đơn từ'
};

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tự động kiểm tra & đồng bộ đơn từ chưa có thông báo cho người dùng
    const userRequests = await Request.find({
      $or: [{ user_id: userId }, { status: 'pending' }]
    }).populate('user_id', 'full_name').limit(20);

    for (const r of userRequests) {
      const typeLabel = TYPE_LABELS[r.type] || 'Đơn từ';
      
      // Nếu là đơn của chính user
      if (r.user_id && (r.user_id._id || r.user_id).toString() === userId.toString()) {
        const notifTitle = r.status === 'approved' ? '✅ Đơn của bạn đã được duyệt'
          : r.status === 'rejected' ? '❌ Đơn của bạn bị từ chối'
          : '📝 Đã gửi đơn thành công';
          
        const notifMsg = r.status === 'approved' ? `Đơn "${typeLabel}" ngày ${r.start_date} đã được duyệt!`
          : r.status === 'rejected' ? `Đơn "${typeLabel}" ngày ${r.start_date} bị từ chối. Lý do: "${r.reviewer_note || ''}"`
          : `Đơn "${typeLabel}" ngày ${r.start_date} đã được gửi thành công và đang chờ duyệt.`;

        await Notification.updateOne(
          { user_id: userId, title: notifTitle, message: notifMsg },
          { $setOnInsert: { user_id: userId, title: notifTitle, message: notifMsg, type: 'request', link: '/requests', is_read: false, created_at: r.created_at || new Date() } },
          { upsert: true }
        );
      } else if (['admin', 'manager'].includes(req.user.role) && r.status === 'pending') {
        // Nếu user là Admin/Manager và có đơn chờ duyệt
        const senderName = r.user_id?.full_name || 'Nhân viên';
        const notifTitle = `📝 Đơn từ mới cần duyệt: ${senderName}`;
        const notifMsg = `${senderName} vừa gửi đơn "${typeLabel}" ngày ${r.start_date}. Lý do: "${r.reason}"`;

        await Notification.updateOne(
          { user_id: userId, title: notifTitle },
          { $setOnInsert: { user_id: userId, title: notifTitle, message: notifMsg, type: 'request', link: '/requests', is_read: false, created_at: r.created_at || new Date() } },
          { upsert: true }
        );
      }
    }

    // Fetch notifications for user or broadcast (user_id = null)
    let notifications = await Notification.find({
      $or: [{ user_id: userId }, { user_id: null }],
    })
      .sort({ created_at: -1 })
      .limit(30);

    // Auto-enrich holiday announcement notifications with full Holiday note if missing
    try {
      const holidays = await Holiday.find().lean();
      if (holidays && holidays.length > 0) {
        for (const n of notifications) {
          if (n.type === 'announcement' && n.title && (n.title.includes('NGHỈ LỄ') || n.title.includes('THÔNG BÁO'))) {
            const cleanTitle = n.title.replace(/^📢\s*(THÔNG BÁO|CẬP NHẬT LỊCH)?\s*(NGHỈ LỄ:?)?\s*/i, '').trim().toUpperCase();
            const matchedHoliday = holidays.find(h => 
              h.name.toUpperCase().includes(cleanTitle) ||
              cleanTitle.includes(h.name.toUpperCase()) ||
              (n.message && n.message.includes(h.name))
            );

            if (matchedHoliday && matchedHoliday.note && matchedHoliday.note.trim()) {
              const fullMessage = matchedHoliday.note.trim();
              
              if (n.message !== fullMessage) {
                n.message = fullMessage;
                await Notification.findByIdAndUpdate(n._id, { message: fullMessage }).catch(() => {});
              }
            }
          }
        }
      }
    } catch {
      // Non-blocking enrichment
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    res.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    console.error('GetNotifications error:', error);
    res.status(500).json({ error: 'Lỗi lấy thông báo.' });
  }
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { is_read: true });
    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật thông báo.' });
  }
};

// POST /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany(
      { $or: [{ user_id: userId }, { user_id: null }], is_read: false },
      { is_read: true }
    );
    res.json({ message: 'Đã đánh dấu tất cả là đã đọc' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật thông báo.' });
  }
};

// POST /api/notifications/broadcast — Admin phát thông báo cho toàn công ty
const broadcastAnnouncement = async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc.' });
  }
  try {
    const notification = await Notification.create({
      user_id: null,
      title: `📢 ${title}`,
      message,
      type: 'announcement',
    });

    // Đồng bộ sang Announcement để hiển thị nổi bật trên Trang chủ
    await Announcement.create({
      title: title.replace(/^📢\s*/, ''),
      content: message,
      is_pinned: true,
      created_by: req.user._id,
      is_active: true,
    }).catch(() => {});

    res.status(201).json({ message: 'Đã phát thông báo thành công!', notification });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi phát thông báo.' });
  }
};

// DELETE /api/notifications/:id - Xóa thông báo
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa thông báo thành công' });
  } catch (error) {
    console.error('DeleteNotification error:', error);
    res.status(500).json({ error: 'Lỗi xóa thông báo.' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, broadcastAnnouncement, deleteNotification };
