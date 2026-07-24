// routes/location.routes.js
const express = require('express');
const router = express.Router();
const { getLocations, createLocation, updateLocation, deleteLocation } = require('../controllers/locationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/locations
router.get('/', getLocations);

// POST /api/locations (Admin)
router.post('/', requireRole('admin'), createLocation);

// PUT /api/locations/:id (Admin)
router.put('/:id', requireRole('admin'), updateLocation);

// DELETE /api/locations/:id (Admin)
router.delete('/:id', requireRole('admin'), deleteLocation);

module.exports = router;
