// routes/user.routes.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers, createUser, updateUser, updateAvatar, deleteUser, toggleActive,
  getUserDevices, deleteUserDevice, trustUserDevice
} = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/users — Danh bạ nhân viên / Danh sách phương tiện (Mọi nhân viên đã đăng nhập)
router.get('/', getAllUsers);

// --- CÁC ROUTE QUẢN TRỊ (ADMIN / LEADER) ---
router.use(requireRole('admin', 'manager'));

// GET /api/users/:id/devices — CHỈ ADMIN xem danh sách thiết bị
router.get('/:id/devices', requireRole('admin'), getUserDevices);

// PUT /api/users/:id/devices/:sessionId/trust — CHỈ ADMIN đặt thiết bị chính
router.put('/:id/devices/:sessionId/trust', requireRole('admin'), trustUserDevice);

// DELETE /api/users/:id/devices/:sessionId — CHỈ ADMIN xóa thiết bị
router.delete('/:id/devices/:sessionId', requireRole('admin'), deleteUserDevice);

// POST /api/users
router.post('/', createUser);

// PUT /api/users/:id
router.put('/:id', updateUser);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', toggleActive);

// PATCH /api/users/:id/avatar
router.patch('/:id/avatar', updateAvatar);

module.exports = router;
