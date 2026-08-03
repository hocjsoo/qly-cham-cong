// routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const {
  checkIn, checkOut, getTodayStatus, getHistory, getRecordByUserAndDate,
  overrideAttendance, deleteAttendance, getFlaggedAttendance, verifyFlaggedAttendance
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

// GET /api/attendance/flagged — Admin duy nhất lấy danh sách nghi vấn & selfie chờ duyệt
router.get('/flagged', requireRole('admin'), getFlaggedAttendance);

// PUT /api/attendance/approve-flagged/:id — Admin duy nhất duyệt / từ chối selfie & cảnh báo
router.put('/approve-flagged/:id', requireRole('admin'), verifyFlaggedAttendance);

// PUT /api/attendance/override/:id — Admin override
router.put('/override/:id', requireRole('admin', 'manager'), overrideAttendance);

// DELETE /api/attendance/:id — Admin/Leader xóa bản ghi chấm công
router.delete('/:id', requireRole('admin', 'manager'), deleteAttendance);

module.exports = router;
