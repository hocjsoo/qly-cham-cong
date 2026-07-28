// routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const {
  checkIn, checkOut, getTodayStatus, getHistory, getRecordByUserAndDate, overrideAttendance
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

// GET /api/attendance/record?user_id=...&date=YYYY-MM-DD
router.get('/record', getRecordByUserAndDate);

// PUT /api/attendance/override/:id — Admin override
router.put('/override/:id', requireRole('admin'), overrideAttendance);

module.exports = router;
