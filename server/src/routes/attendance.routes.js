// routes/attendance.routes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  checkIn, checkOut, getTodayStatus, getHistory, getRecordByUserAndDate,
  overrideAttendance, deleteAttendance, getFlaggedAttendance, verifyFlaggedAttendance
} = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

const attendanceActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => process.env.NODE_ENV !== 'production' || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip),
  message: { error: 'Thao tác chấm công quá nhanh, vui lòng chờ 1 phút.' },
});

// Tất cả routes cần authMiddleware
router.use(authMiddleware);

// POST /api/attendance/checkin
router.post('/checkin', attendanceActionLimiter, checkIn);

// POST /api/attendance/checkout
router.post('/checkout', attendanceActionLimiter, checkOut);

// GET /api/attendance/today
router.get('/today', getTodayStatus);

// GET /api/attendance/history?month=7&year=2026
router.get('/history', getHistory);

// GET /api/attendance/record?user_id=...&date=YYYY-MM-DD
router.get('/record', getRecordByUserAndDate);

// GET /api/attendance/flagged — Admin/Leader lấy danh sách nghi vấn & selfie chờ duyệt
router.get('/flagged', requireRole('admin', 'manager'), getFlaggedAttendance);

// PUT /api/attendance/flagged/verify/:id & /approve-flagged/:id — Admin/Leader duyệt / từ chối selfie & cảnh báo
router.put('/flagged/verify/:id', requireRole('admin', 'manager'), verifyFlaggedAttendance);
router.put('/approve-flagged/:id', requireRole('admin', 'manager'), verifyFlaggedAttendance);

// PUT /api/attendance/override/:id — CHỈ ADMIN có quyền sửa giờ công
router.put('/override/:id', requireRole('admin'), overrideAttendance);

// DELETE /api/attendance/:id — CHỈ ADMIN có quyền xóa bản ghi chấm công
router.delete('/:id', requireRole('admin'), deleteAttendance);

module.exports = router;
