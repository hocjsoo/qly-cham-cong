// routes/announcement.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  getBirthdays,
  getAnniversaries,
  getPinned,
  getAll,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/announcementController');

// Tat ca users dang nhap deu co the xem
router.get('/birthdays', authMiddleware, getBirthdays);
router.get('/anniversaries', authMiddleware, getAnniversaries);
router.get('/pinned', authMiddleware, getPinned);
router.get('/', authMiddleware, getAll);

// Chi admin (va leader) moi duoc tao/sua/xoa
router.post('/', authMiddleware, requireRole('admin', 'manager'), createAnnouncement);
router.put('/:id', authMiddleware, requireRole('admin', 'manager'), updateAnnouncement);
router.delete('/:id', authMiddleware, requireRole('admin', 'manager'), deleteAnnouncement);

module.exports = router;
