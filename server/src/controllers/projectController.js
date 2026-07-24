// controllers/projectController.js - CRUD Dự án / Công trình
const Project = require('../models/Project');

// GET /api/projects?active_only=true
const getProjects = async (req, res) => {
  try {
    const { active_only } = req.query;
    let filter = { is_active: { $ne: false } };
    if (active_only === 'true') {
      filter.status = 'active';
    }

    let projects = await Project.find(filter).sort({ created_at: -1 });

    // Seeding dự án mẫu nếu trống
    if (projects.length === 0 && !active_only) {
      projects = await Project.insertMany([
        { name: 'Biệt thự Palm City', code: 'CT-PALM', address: 'Quận 2, TP.HCM', status: 'active' },
        { name: 'Văn phòng ET Tower', code: 'CT-ETTOWER', address: 'Quận 1, TP.HCM', status: 'active' },
        { name: 'Khu đô thị Sol Forest', code: 'CT-SOL', address: 'Ecopark, Hưng Yên', status: 'paused' },
      ]);
    }

    res.json(projects);
  } catch (error) {
    console.error('GetProjects error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách dự án.' });
  }
};

// POST /api/projects - Tạo dự án
const createProject = async (req, res) => {
  const { name, code, address, client_name, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên dự án là bắt buộc.' });
  }

  try {
    const project = await Project.create({
      name: name.trim(),
      code: code ? code.trim() : `DA-${Date.now().toString().slice(-4)}`,
      address: address ? address.trim() : null,
      client_name: client_name ? client_name.trim() : null,
      status: status || 'active',
    });

    res.status(201).json({ message: 'Tạo dự án thành công ✅', project });
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ error: 'Lỗi tạo dự án.' });
  }
};

// PUT /api/projects/:id - Cập nhật trạng thái / thông tin dự án
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, code, address, client_name, status } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Không tìm thấy dự án.' });
    }

    if (name) project.name = name.trim();
    if (code) project.code = code.trim();
    if (address !== undefined) project.address = address ? address.trim() : null;
    if (client_name !== undefined) project.client_name = client_name ? client_name.trim() : null;
    if (status) project.status = status;

    await project.save();
    res.json({ message: 'Đã cập nhật dự án thành công ✅', project });
  } catch (error) {
    console.error('UpdateProject error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật dự án.' });
  }
};

// DELETE /api/projects/:id - Xóa dự án
const deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ message: 'Đã xóa dự án.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa dự án.' });
  }
};

module.exports = { getProjects, createProject, updateProject, deleteProject };
