// routes/systemSetting.routes.js
const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/systemSettingController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings (Admin only)
router.put('/', requireRole('admin'), updateSettings);

module.exports = router;
