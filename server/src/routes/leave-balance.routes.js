// routes/leave-balance.routes.js
const express = require('express');
const router = express.Router();
const { getMyBalance, getAllBalances, updateBalance } = require('../controllers/leaveBalanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/leave-balance/me
router.get('/me', getMyBalance);

// GET /api/leave-balance (admin/manager)
router.get('/', requireRole('admin', 'manager'), getAllBalances);

// PUT /api/leave-balance/:userId (admin only)
router.put('/:userId', requireRole('admin'), updateBalance);

module.exports = router;
