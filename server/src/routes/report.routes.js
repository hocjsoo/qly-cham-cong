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

// GET /api/reports/leaderboard — Bảng xếp hạng vinh danh (Ẩn cho nhân viên: số liệu chưa chuẩn
// đến khi máy chấm công vật lý chạy, chỉ Admin xem trong thời gian này)
router.get('/leaderboard', requireRole('admin'), getLeaderboard);

// GET /api/reports/trend?months=6 — Xu hướng cho Dashboard (Admin & Leader)
router.get('/trend', requireRole('admin', 'manager'), getTrend);

// GET /api/reports/monthly?month=7&year=2026 — Bảng công tổng hợp (Admin only: client tab overview đã gate isAdmin)
router.get('/monthly', requireRole('admin'), getMonthlyReport);

// GET /api/reports/individual-detail?user_id=...&month=6&year=2026 — Bảng chi tiết cá nhân
router.get('/individual-detail', getIndividualDetailReport);

// GET /api/reports/ranking?month=7&year=2026 — Bảng xếp hạng theo điểm (Admin only: cùng dữ liệu /leaderboard đã ẩn)
router.get('/ranking', requireRole('admin'), getRanking);

// GET /api/reports/stats
router.get('/stats', getAttendanceStats);

// --- CÁC BÁO CÁO NHẠY CẢM (LƯƠNG / PAYROLL) DÀNH CHO ADMIN ---
router.get('/payroll', requireRole('admin'), getPayroll);

module.exports = router;

