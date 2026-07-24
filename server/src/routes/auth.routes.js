// routes/auth.routes.js - Complete
const express = require('express');
const router = express.Router();
const { login, getMe, changePassword, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (cần đăng nhập)
router.get('/me', authMiddleware, getMe);

// POST /api/auth/change-password (cần đăng nhập)
router.post('/change-password', authMiddleware, changePassword);

// PATCH /api/auth/profile (cần đăng nhập)
router.patch('/profile', authMiddleware, updateProfile);

module.exports = router;
