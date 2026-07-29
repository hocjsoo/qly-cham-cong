// routes/notification.routes.js
const express = require('express');
const router = express.Router();
const {
  getNotifications, markAsRead, markAllAsRead, broadcastAnnouncement, deleteNotification
} = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);
router.post('/broadcast', requireRole('admin', 'manager'), broadcastAnnouncement);
router.delete('/:id', requireRole('admin', 'manager'), deleteNotification);

module.exports = router;
