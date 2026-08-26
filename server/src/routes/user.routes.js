// routes/user.routes.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers, createUser, updateUser, updateAvatar, deleteUser, toggleActive,
  getUserDevices, deleteUserDevice, trustUserDevice, sendTestEmail, broadcastCustomEmail
} = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/users — Danh bạ nhân viên / Danh sách phương tiện (Mọi nhân viên đã đăng nhập)
router.get('/', getAllUsers);

// --- CÁC ROUTE QUẢN TRỊ (CHỈ ADMIN MỚI CÓ QUYỀN TẠO, SỬA, XÓA, ĐỔI TRẠNG THÁI VÀ QUẢN LÝ THIẾT BỊ NHÂN VIÊN) ---
router.use(requireRole('admin'));

// GET /api/users/:id/devices — CHỈ ADMIN xem danh sách thiết bị
router.get('/:id/devices', getUserDevices);

// PUT /api/users/:id/devices/:sessionId/trust — CHỈ ADMIN đặt thiết bị chính
router.put('/:id/devices/:sessionId/trust', trustUserDevice);

// DELETE /api/users/:id/devices/:sessionId — CHỈ ADMIN xóa thiết bị
router.delete('/:id/devices/:sessionId', deleteUserDevice);

// POST /api/users — CHỈ ADMIN tạo nhân viên
router.post('/', createUser);

// PUT /api/users/:id — CHỈ ADMIN sửa thông tin nhân viên
router.put('/:id', updateUser);

// DELETE /api/users/:id — CHỈ ADMIN xóa nhân viên
router.delete('/:id', deleteUser);

// PATCH /api/users/:id/toggle-active — CHỈ ADMIN kích hoạt/khóa nhân viên
router.patch('/:id/toggle-active', toggleActive);

// PATCH /api/users/:id/avatar — CHỈ ADMIN cập nhật avatar
router.patch('/:id/avatar', updateAvatar);


// POST /api/users/email/send-test — Gửi email thử nghiệm (Admin only)
router.post("/email/send-test", sendTestEmail);

// POST /api/users/email/broadcast-custom — Gửi email tùy chỉnh hàng loạt (Admin only)
router.post("/email/broadcast-custom", broadcastCustomEmail);

module.exports = router;
