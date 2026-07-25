// controllers/projectController.js - CRUD Quản Lý Dự Án / Công Trình (ET Architects)
const Project = require('../models/Project');

// GET /api/projects
const getProjects = async (req, res) => {
  try {
    const { active_only } = req.query;
    let filter = { is_active: { $ne: false } };
    if (active_only === 'true') {
      filter.status = { $in: ['active', 'Đang tiến hành', 'Cần thực hiện'] };
    }

    let projects = await Project.find(filter).sort({ created_at: -1 });

    // Seeding dự án mẫu nếu trống
    if (projects.length === 0 && !active_only) {
      projects = await Project.insertMany([
        { name: 'Văn phòng ET Architects Hà Nội', code: 'DA-ETHN', category: 'Kiến trúc', client_name: 'ET Group', address: 'Tầng 5, Hà Nội', status: 'Đang tiến hành', pm_name: 'KTS. Nguyễn Hoàng' },
        { name: 'Biệt thự Palm City', code: 'DA-PALM', category: 'Nội thất', client_name: 'Anh Minh', address: 'Quận 2, TP.HCM', status: 'Đang tiến hành', pm_name: 'KTS. Trần Nam' },
        { name: 'Khu đô thị Sol Forest', code: 'DA-SOL', category: 'Quy hoạch&Kiến trúc', client_name: 'Ecopark', address: 'Hưng Yên', status: 'Cần thực hiện', pm_name: 'KTS. Lê Anh' },
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
  const { name, code, category, sub_project, address, client_name, pm_name, note, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên dự án là bắt buộc.' });
  }

  try {
    const project = await Project.create({
      name: name.trim(),
      code: code ? code.trim() : `DA-${Date.now().toString().slice(-4)}`,
      category: category || 'Kiến trúc',
      sub_project: sub_project ? sub_project.trim() : null,
      address: address ? address.trim() : null,
      client_name: client_name ? client_name.trim() : null,
      pm_name: pm_name ? pm_name.trim() : null,
      note: note ? note.trim() : null,
      status: status || 'Đang tiến hành',
    });

    res.status(201).json({ message: 'Tạo dự án thành công ✅', project });
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ error: 'Lỗi tạo dự án.' });
  }
};

// PUT /api/projects/:id - Cập nhật thông tin dự án
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, code, category, sub_project, address, client_name, pm_name, note, status } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Không tìm thấy dự án.' });
    }

    if (name) project.name = name.trim();
    if (code) project.code = code.trim();
    if (category) project.category = category;
    if (sub_project !== undefined) project.sub_project = sub_project ? sub_project.trim() : null;
    if (address !== undefined) project.address = address ? address.trim() : null;
    if (client_name !== undefined) project.client_name = client_name ? client_name.trim() : null;
    if (pm_name !== undefined) project.pm_name = pm_name ? pm_name.trim() : null;
    if (note !== undefined) project.note = note ? note.trim() : null;
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
