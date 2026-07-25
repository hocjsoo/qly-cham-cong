// routes/report.routes.js
const express = require('express');
const router = express.Router();
const { getMonthlyReport, getTrend, getAttendanceStats, getRanking, getPayroll, getIndividualDetailReport } = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/reports/individual-detail?user_id=...&month=6&year=2026
router.get('/individual-detail', getIndividualDetailReport);

router.use(requireRole('admin', 'manager'));

// GET /api/reports/monthly?month=7&year=2026
router.get('/monthly', getMonthlyReport);

// GET /api/reports/trend?months=6
router.get('/trend', getTrend);

// GET /api/reports/stats
router.get('/stats', getAttendanceStats);

// GET /api/reports/ranking?month=7&year=2026
router.get('/ranking', getRanking);

// GET /api/reports/payroll?month=7&year=2026
router.get('/payroll', getPayroll);

module.exports = router;
