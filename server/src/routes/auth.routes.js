// routes/auth.routes.js — Complete Auth Routes with scoped rate limiters
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, register, forgotPassword, resetPassword, getMe, changePassword, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Rate limiter riêng cho đăng nhập & reset mật khẩu (Chống dò quét Brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Tối đa 15 lần thử đăng nhập/15 phút/IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.ip === '127.0.0.1' ||
    req.ip === '::1' ||
    req.ip === '::ffff:127.0.0.1' ||
    process.env.NODE_ENV !== 'production',
  message: { error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút để bảo vệ tài khoản.' }
});

const forgotPassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.ip === '127.0.0.1' ||
    req.ip === '::1' ||
    req.ip === '::ffff:127.0.0.1' ||
    process.env.NODE_ENV !== 'production',
  message: { error: 'Thao tác tạo mã reset mật khẩu quá nhanh, vui lòng thử lại sau.' }
});

// Public routes (có rate limit chống tấn công dò mật khẩu)
router.post('/login', loginLimiter, login);
router.post('/reset-password', loginLimiter, resetPassword);

// Protected routes (không bị rate limit đăng nhập can thiệp)
router.get('/me', authMiddleware, getMe);
router.post('/change-password', authMiddleware, changePassword);
router.patch('/profile', authMiddleware, updateProfile);

// Admin/Manager only
router.post('/register', authMiddleware, requireRole('admin', 'manager'), register);
router.post('/forgot-password', authMiddleware, requireRole('admin', 'manager'), forgotPassLimiter, forgotPassword);

module.exports = router;
