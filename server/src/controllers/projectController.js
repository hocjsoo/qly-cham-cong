// controllers/projectController.js - CRUD Quản Lý Dự Án / Công Trình (ET Architects)
const Project = require('../models/Project');

// GET /api/projects
const getProjects = async (req, res) => {
  try {
    const { active_only, search, category, status, sort, my_only } = req.query;
    let filter = { is_active: { $ne: false } };

    if (active_only === 'true') {
      filter.status = { $in: ['active', 'Đang tiến hành', 'Cần thực hiện'] };
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { client_name: { $regex: q, $options: 'i' } },
        { pm_name: { $regex: q, $options: 'i' } },
      ];
    }

    // Chỉ Admin mới xem được toàn bộ dự án công ty; Tất cả Nhân sự (Leader, Employee, Staff...) chỉ xem dự án mình tham gia hoặc phụ trách
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin || my_only === 'true') {
      const userConditions = [
        { members: req.user._id },
        { pm_id: req.user._id },
      ];
      // Chỉ dùng pm_name đầy đủ (exact match) cho dữ liệu dự án cũ chưa có pm_id
      if (req.user.full_name) {
        const cleanName = req.user.full_name.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        userConditions.push({ pm_name: { $regex: `^${cleanName}$`, $options: 'i' } });
      }

      if (filter.$or) {
        const searchOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: searchOr },
          { $or: userConditions }
        ];
      } else {
        filter.$or = userConditions;
      }
    }

    let sortOption = { created_at: -1 };
    if (sort === 'name_asc') sortOption = { name: 1 };
    else if (sort === 'name_desc') sortOption = { name: -1 };
    else if (sort === 'date_asc') sortOption = { created_at: 1 };
    else if (sort === 'date_desc') sortOption = { created_at: -1 };
    else if (sort === 'progress_desc') sortOption = { progress: -1 };

    let projects = await Project.find(filter)
      .populate('members', 'full_name email avatar_url employee_code position phone')
      .populate('pm_id', 'full_name email avatar_url employee_code position phone')
      .sort(sortOption);

    // Seeding dự án mẫu nếu trống (chỉ khi là admin)
    if (projects.length === 0 && req.user?.role === 'admin' && !active_only && !search && (!category || category === 'all')) {
      projects = await Project.insertMany([
        { name: 'Văn phòng ET Architects Hà Nội', code: 'DA-ETHN', category: 'Kiến trúc', client_name: 'ET Group', address: 'Tầng 5, Hà Nội', status: 'Đang tiến hành', pm_name: 'KTS. Nguyễn Hoàng', progress: 75, deadline: '2026-12-31' },
        { name: 'Biệt thự Palm City', code: 'DA-PALM', category: 'Nội thất', client_name: 'Anh Minh', address: 'Quận 2, TP.HCM', status: 'Đang tiến hành', pm_name: 'KTS. Trần Nam', progress: 40, deadline: '2026-10-15' },
        { name: 'Khu đô thị Sol Forest', code: 'DA-SOL', category: 'Quy hoạch&Kiến trúc', client_name: 'Ecopark', address: 'Hưng Yên', status: 'Cần thực hiện', pm_name: 'KTS. Lê Anh', progress: 15, deadline: '2026-11-30' },
      ]);
      projects = await Project.find(filter)
        .populate('members', 'full_name email avatar_url employee_code position phone')
        .populate('pm_id', 'full_name email avatar_url employee_code position phone');
    }

    res.json(projects);
  } catch (error) {
    console.error('GetProjects error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách dự án.' });
  }
};

// POST /api/projects - Tạo dự án
const createProject = async (req, res) => {
  const { name, code, category, sub_project, avatar_url, address, client_name, pm_id, pm_name, note, status, members, deadline, start_date, progress } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên dự án là bắt buộc.' });
  }

  try {
    const project = await Project.create({
      name: name.trim(),
      code: code ? code.trim() : `DA-${Date.now().toString().slice(-4)}`,
      category: category || 'Kiến trúc',
      sub_project: sub_project ? sub_project.trim() : null,
      avatar_url: avatar_url || null,
      address: address ? address.trim() : null,
      client_name: client_name ? client_name.trim() : null,
      pm_id: pm_id || null,
      pm_name: pm_name ? pm_name.trim() : null,
      note: note ? note.trim() : null,
      status: status || 'Đang tiến hành',
      members: Array.isArray(members) ? members : [],
      deadline: deadline || null,
      start_date: start_date || null,
      progress: typeof progress === 'number' ? progress : 0,
    });

    const populatedProject = await Project.findById(project._id)
      .populate('members', 'full_name email avatar_url employee_code position phone')
      .populate('pm_id', 'full_name email avatar_url employee_code position phone');
    res.status(201).json({ message: 'Tạo dự án thành công ✅', project: populatedProject });
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ error: 'Lỗi tạo dự án.' });
  }
};

// PUT /api/projects/:id - Cập nhật thông tin dự án
const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, code, category, sub_project, avatar_url, address, client_name, pm_id, pm_name, note, status, members, deadline, start_date, progress } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Không tìm thấy dự án.' });
    }

    // Phân quyền: Chỉ Admin hoặc PM phụ trách dự án mới có quyền sửa
    const isAdmin = req.user.role === 'admin';
    const isPM = (project.pm_id && project.pm_id.toString() === req.user._id.toString()) ||
                 (project.pm_name && req.user.full_name && project.pm_name.trim().toLowerCase() === req.user.full_name.trim().toLowerCase());

    if (!isAdmin && !isPM) {
      return res.status(403).json({ error: 'Chỉ Admin hoặc PM phụ trách dự án này mới có quyền chỉnh sửa thông tin dự án.' });
    }

    if (name !== undefined) project.name = name.trim();
    if (code !== undefined) project.code = code.trim();
    if (category !== undefined) project.category = category;
    if (sub_project !== undefined) project.sub_project = sub_project ? sub_project.trim() : null;
    if (avatar_url !== undefined) project.avatar_url = avatar_url || null;
    if (address !== undefined) project.address = address ? address.trim() : null;
    if (client_name !== undefined) project.client_name = client_name ? client_name.trim() : null;
    if (pm_id !== undefined) project.pm_id = pm_id || null;
    if (pm_name !== undefined) project.pm_name = pm_name ? pm_name.trim() : null;
    if (note !== undefined) project.note = note ? note.trim() : null;
    if (status !== undefined) project.status = status;
    if (members !== undefined && Array.isArray(members)) project.members = members;
    if (deadline !== undefined) project.deadline = deadline;
    if (start_date !== undefined) project.start_date = start_date;
    if (progress !== undefined) project.progress = Number(progress) || 0;

    await project.save();
    const populatedProject = await Project.findById(project._id)
      .populate('members', 'full_name email avatar_url employee_code position phone')
      .populate('pm_id', 'full_name email avatar_url employee_code position phone');
    res.json({ message: 'Đã cập nhật dự án thành công ✅', project: populatedProject });
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
