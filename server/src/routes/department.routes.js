// routes/department.routes.js
const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// GET /api/departments
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (error) {
    console.error('GetDepartments error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách phòng ban.' });
  }
});

// POST /api/departments (admin only)
router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới được thêm phòng ban.' });
  }
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên phòng ban là bắt buộc.' });

    const dept = await Department.create({ name: name.trim(), description: description?.trim() || '' });
    res.status(201).json({ message: 'Đã thêm phòng ban', department: dept });
  } catch (error) {
    console.error('CreateDepartment error:', error);
    res.status(500).json({ error: 'Lỗi thêm phòng ban.' });
  }
});

// DELETE /api/departments/:id (admin only)
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin.' });
  }
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa phòng ban.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa phòng ban.' });
  }
});

module.exports = router;
