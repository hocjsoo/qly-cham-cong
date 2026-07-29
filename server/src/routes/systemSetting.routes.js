// routes/systemSetting.routes.js
const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/systemSettingController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// GET /api/settings (Public - for company name & logo on login/portal)
router.get('/', getSettings);

// PUT /api/settings (Admin only)
router.put('/', authMiddleware, requireRole('admin'), updateSettings);

module.exports = router;
