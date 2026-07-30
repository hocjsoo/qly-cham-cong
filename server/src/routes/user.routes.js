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
router.use(requireRole('admin', 'manager'));

// GET /api/users
router.get('/', getAllUsers);

// GET /api/users/:id/devices — Admin/Leader xem danh sách thiết bị
router.get('/:id/devices', getUserDevices);

// PUT /api/users/:id/devices/:sessionId/trust — Admin/Leader đặt thiết bị chính
router.put('/:id/devices/:sessionId/trust', trustUserDevice);

// DELETE /api/users/:id/devices/:sessionId — Admin/Leader xóa thiết bị
router.delete('/:id/devices/:sessionId', deleteUserDevice);

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
