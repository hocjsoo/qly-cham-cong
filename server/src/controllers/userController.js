// controllers/userController.js - Mongoose User Management Controller
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password_hash')
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .populate('manager_id', 'full_name')
      .sort({ created_at: -1 });

    const formatted = users.map(u => {
      const obj = u.toObject();
      const deptNames = (obj.department_ids && obj.department_ids.length > 0)
        ? obj.department_ids.map(d => d.name)
        : (obj.department_id?.name ? [obj.department_id.name] : []);

      return {
        ...obj,
        id: obj._id,
        department_name: deptNames.length > 0 ? deptNames.join(', ') : '—',
        department_names: deptNames,
        manager_name: obj.manager_id?.full_name || '—',
      };
    });

    res.json(formatted);

  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách nhân viên.' });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  const { email, full_name, password, role, phone, department_id, department_ids, manager_id } = req.body;

  if (!email || !full_name || !password) {
    return res.status(400).json({ error: 'Email, họ tên và mật khẩu là bắt buộc.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải ít nhất 6 ký tự.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email đã tồn tại trong hệ thống.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const deptIds = Array.isArray(department_ids) && department_ids.length > 0
      ? department_ids
      : (department_id ? [department_id] : []);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      full_name: full_name.trim(),
      phone: phone || null,
      role: role || 'employee',
      department_id: deptIds[0] || department_id || null,
      department_ids: deptIds,
      manager_id: manager_id || null,
    });

    const userObj = user.toObject();
    delete userObj.password_hash;

    res.status(201).json({
      message: `Đã thêm nhân viên "${full_name}" thành công!`,
      user: userObj
    });

  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ error: 'Lỗi thêm nhân viên.' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, role, department_id, department_ids, manager_id, is_active, password } = req.body;

  try {
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (department_ids !== undefined && Array.isArray(department_ids)) {
      updateData.department_ids = department_ids;
      updateData.department_id = department_ids[0] || null;
    } else if (department_id !== undefined) {
      updateData.department_id = department_id || null;
      updateData.department_ids = department_id ? [department_id] : [];
    }
    if (manager_id !== undefined) updateData.manager_id = manager_id || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update password if provided
    if (password && password.length >= 6) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password_hash');

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    res.json({ message: 'Cập nhật thông tin thành công!', user });

  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật nhân viên.' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    if (user.email === 'admin@etoffice.vn') {
      return res.status(400).json({ error: 'Không thể xóa tài khoản Admin tối cao.' });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa nhân viên.' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ error: 'Lỗi xóa nhân viên.' });
  }
};

// PATCH /api/users/:id/toggle-active
const toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });

    if (user.email === 'admin@etoffice.vn' && user.is_active) {
      return res.status(400).json({ error: 'Không thể vô hiệu hóa tài khoản Admin tối cao.' });
    }
    if (user._id.toString() === req.user._id.toString() && user.is_active) {
      return res.status(400).json({ error: 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.' });
    }

    user.is_active = !user.is_active;
    await user.save();

    res.json({ message: user.is_active ? 'Đã kích hoạt' : 'Đã vô hiệu hóa', is_active: user.is_active });
  } catch (error) {
    console.error('ToggleActive error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật.' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, toggleActive };
