// routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const {
  checkIn, checkOut, getTodayStatus, getHistory, overrideAttendance
} = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Tất cả routes cần authMiddleware
router.use(authMiddleware);

// POST /api/attendance/checkin
router.post('/checkin', checkIn);

// POST /api/attendance/checkout
router.post('/checkout', checkOut);

// GET /api/attendance/today
router.get('/today', getTodayStatus);

// GET /api/attendance/history?month=7&year=2026
router.get('/history', getHistory);

// PUT /api/attendance/override/:id — Admin/Manager override
router.put('/override/:id', requireRole('admin', 'manager'), overrideAttendance);

module.exports = router;
