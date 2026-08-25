// routes/report.routes.js
const express = require('express');
const router = express.Router();
const {
  getMonthlyReport,
  getTrend,
  getAttendanceStats,
  getRanking,
  getPayroll,
  getIndividualDetailReport,
  getLeaderboard,
} = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/reports/leaderboard — Bảng xếp hạng vinh danh đa chiều (Tất cả nhân viên)
router.get('/leaderboard', getLeaderboard);

// GET /api/reports/trend?months=6 — Xu hướng cho Dashboard (Admin & Leader)
router.get('/trend', requireRole('admin', 'manager'), getTrend);

// GET /api/reports/monthly?month=7&year=2026 — Bảng công tổng hợp (Tất cả nhân sự xem minh bạch)
router.get('/monthly', getMonthlyReport);

// GET /api/reports/individual-detail?user_id=...&month=6&year=2026 — Bảng chi tiết cá nhân
router.get('/individual-detail', getIndividualDetailReport);

// GET /api/reports/ranking?month=7&year=2026
router.get('/ranking', getRanking);

// GET /api/reports/stats
router.get('/stats', getAttendanceStats);

// --- CÁC BÁO CÁO NHẠY CẢM (LƯƠNG / PAYROLL) DÀNH CHO ADMIN ---
router.get('/payroll', requireRole('admin'), getPayroll);

module.exports = router;

