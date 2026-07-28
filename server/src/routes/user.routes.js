// routes/user.routes.js
const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, updateAvatar, deleteUser, toggleActive } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);
router.use(requireRole('admin', 'manager'));

// GET /api/users
router.get('/', getAllUsers);

// POST /api/users
router.post('/', createUser);

// PUT /api/users/:id
router.put('/:id', updateUser);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', toggleActive);

// PATCH /api/users/:id/avatar
router.patch('/:id/avatar', updateAvatar);

module.exports = router;
