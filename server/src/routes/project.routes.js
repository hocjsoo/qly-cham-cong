// routes/project.routes.js
const express = require('express');
const router = express.Router();
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/projectController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// GET /api/projects
router.get('/', getProjects);

// POST /api/projects (Admin only)
router.post('/', requireRole('admin'), createProject);

// PUT /api/projects/:id (Admin hoặc PM phụ trách dự án)
router.put('/:id', updateProject);

// DELETE /api/projects/:id (Admin only)
router.delete('/:id', requireRole('admin'), deleteProject);

module.exports = router;
