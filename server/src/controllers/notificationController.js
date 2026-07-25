// controllers/notificationController.js - Notification Engine
const Notification = require('../models/Notification');
const User = require('../models/User');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    // Fetch notifications for user or broadcast (user_id = null)
    const notifications = await Notification.find({
      $or: [{ user_id: userId }, { user_id: null }],
    })
      .sort({ created_at: -1 })
      .limit(30);

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

    res.status(201).json({ message: 'Đã phát thông báo thành công!', notification });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi phát thông báo.' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, broadcastAnnouncement };
