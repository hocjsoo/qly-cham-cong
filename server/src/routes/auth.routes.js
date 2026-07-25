// routes/auth.routes.js — Complete Auth Routes
const express = require('express');
const router = express.Router();
const { login, register, forgotPassword, resetPassword, getMe, changePassword, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Public routes
router.post('/login', login);
router.post('/reset-password', resetPassword);

// Protected routes (cần đăng nhập)
router.get('/me', authMiddleware, getMe);
router.post('/change-password', authMiddleware, changePassword);
router.patch('/profile', authMiddleware, updateProfile);

// Admin/Manager only
router.post('/register', authMiddleware, requireRole('admin', 'manager'), register);
router.post('/forgot-password', authMiddleware, requireRole('admin', 'manager'), forgotPassword);

module.exports = router;
