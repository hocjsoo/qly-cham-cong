// routes/holiday.routes.js
const express = require('express');
const router = express.Router();
const { getHolidays, createHoliday, deleteHoliday } = require('../controllers/holidayController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/', getHolidays);
router.post('/', requireRole('admin', 'manager'), createHoliday);
router.delete('/:id', requireRole('admin'), deleteHoliday);

module.exports = router;
