// routes/holiday.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { getHolidays, createHoliday, deleteHoliday, seedVietnamHolidays } = require('../controllers/holidayController');

router.get('/', authMiddleware, getHolidays);
router.post('/seed-vietnam', authMiddleware, requireRole('admin'), seedVietnamHolidays);
router.post('/', authMiddleware, requireRole('admin'), createHoliday);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteHoliday);

module.exports = router;
