// routes/project.routes.js
const express = require('express');
const router = express.Router();
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/projectController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/projects
router.get('/', getProjects);

// POST /api/projects (Admin/Manager)
router.post('/', requireRole('admin', 'manager'), createProject);

// PUT /api/projects/:id (Admin/Manager)
router.put('/:id', requireRole('admin', 'manager'), updateProject);

// DELETE /api/projects/:id (Admin/Manager)
router.delete('/:id', requireRole('admin', 'manager'), deleteProject);

module.exports = router;
