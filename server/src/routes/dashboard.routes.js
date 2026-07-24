// routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const { getTodaySummary, getPendingCount } = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);
router.use(requireRole('admin', 'manager'));

// GET /api/dashboard/today
router.get('/today', getTodaySummary);

// GET /api/dashboard/pending-count
router.get('/pending-count', getPendingCount);

module.exports = router;
