// routes/correction.routes.js
const express = require('express');
const router = express.Router();
const { createCorrection, getCorrections, approveCorrection, rejectCorrection } = require('../controllers/correctionController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/corrections - Lấy danh sách
router.get('/', getCorrections);

// POST /api/corrections - Gửi yêu cầu đính chính
router.post('/', createCorrection);

// PUT /api/corrections/:id/approve - Duyệt
router.put('/:id/approve', requireRole('admin', 'manager'), approveCorrection);

// PUT /api/corrections/:id/reject - Từ chối
router.put('/:id/reject', requireRole('admin', 'manager'), rejectCorrection);

module.exports = router;
