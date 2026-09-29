// routes/export.routes.js
const express = require('express');
const router = express.Router();
const { exportAttendanceExcel, exportExpensesExcel } = require('../controllers/exportController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/export/excel?month=7&year=2026
router.get('/excel', requireRole('admin', 'manager'), exportAttendanceExcel);

// GET /api/export/expenses
router.get('/expenses', exportExpensesExcel);

module.exports = router;
