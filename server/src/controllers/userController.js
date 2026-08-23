// controllers/userController.js - Mongoose User Management Controller
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Ham tu sinh employee_code: NS-001, TV-001, TTS-001
const generateEmployeeCode = async (employeeType = 'NS') => {
  const prefix = employeeType;
  const count = await User.countDocuments({ employee_type: prefix });
  const seq = String(count + 1).padStart(3, '0');
  const code = `${prefix}-${seq}`;
  const existing = await User.findOne({ employee_code: code });
  if (existing) {
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
  return code;
};

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    // Leader & Admin have access to the full company employee directory
    const queryFilter = {};

    const users = await User.find(queryFilter)
      .select('-password_hash')
      .populate('department_id', 'name')
      .populate('department_ids', 'name')
      .populate('manager_id', 'full_name')
      .sort({ employee_code: 1, created_at: -1 });

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
    res.status(500).json({ error: 'Loi lay danh sach nhan vien.' });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  const {
    email, full_name, password, role, phone,
    department_id, department_ids, manager_id,
    employee_type, employee_code, position, employment_status,
    dob, join_date, bhxh_code, emergency_phone, address_current, hometown, cccd,
    bank_name, bank_account, branch, start_year, education,
  } = req.body;

  if (!email || !full_name || !password) {
    return res.status(400).json({ error: 'Email, ho ten va mat khau la bat buoc.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mat khau phai it nhat 6 ky tu.' });
  }

  // Safety check: Leader cannot create Admin account
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền tạo tài khoản Admin.' });
  }

  const deptIds = Array.isArray(department_ids) && department_ids.length > 0
    ? department_ids
    : (department_id ? [department_id] : []);

  if (['leader', 'manager'].includes(role) && deptIds.length === 0) {
    return res.status(400).json({ error: 'Khi chon vai tro Leader, bat buoc phai chon phong ban quan ly.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email da ton tai trong he thong.' });
    }

    if (employee_code && employee_code.trim()) {
      const codeExist = await User.findOne({ employee_code: employee_code.trim() });
      if (codeExist) {
        return res.status(409).json({ error: `Mã nhân sự "${employee_code.trim()}" đã tồn tại trong hệ thống.` });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const empType = employee_type || 'NS';
    const empCode = (employee_code && employee_code.trim()) ? employee_code.trim() : await generateEmployeeCode(empType);
    const derivedStartYear = join_date ? String(join_date).split('-')[0] : (start_year || null);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      full_name: full_name.trim(),
      phone: phone || null,
      role: role || 'employee',
      department_id: deptIds[0] || department_id || null,
      department_ids: deptIds,
      manager_id: manager_id || null,
      employee_type: empType,
      employee_code: empCode,
      position: position || null,
      employment_status: employment_status || 'Dang lam viec',
      dob: dob || null,
      join_date: join_date || null,
      bhxh_code: bhxh_code || null,
      emergency_phone: emergency_phone || null,
      address_current: address_current || null,
      hometown: hometown || null,
      cccd: cccd || null,
      bank_name: bank_name || null,
      bank_account: bank_account || null,
      branch: branch || null,
      start_year: derivedStartYear,
      education: education || null,
    });

    const userObj = user.toObject();
    delete userObj.password_hash;

    res.status(201).json({
      message: `Da them nhan vien "${full_name}" (${empCode}) thanh cong!`,
      user: userObj
    });
  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ error: 'Loi them nhan vien.' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    full_name, email, phone, role, department_id, department_ids, manager_id, is_active, password,
    employee_type, employee_code, position, employment_status,
    dob, join_date, bhxh_code, emergency_phone, address_current, hometown, cccd,
    bank_name, bank_account, branch, start_year, education,
  } = req.body;

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });

    // Safety Rule: Leader/Manager cannot edit Admin profiles
    if (targetUser.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Leader không có quyền sửa thông tin của tài khoản Admin.' });
    }

    // Safety Rule: Only Admin can assign Admin role
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền gán vai trò Admin.' });
    }

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (position !== undefined) updateData.position = position;
    if (employment_status !== undefined) updateData.employment_status = employment_status;
    if (employee_type !== undefined) updateData.employee_type = employee_type;
    if (employee_code !== undefined && employee_code.trim()) {
      const codeExist = await User.findOne({ employee_code: employee_code.trim(), _id: { $ne: id } });
      if (codeExist) {
        return res.status(409).json({ error: `Mã nhân sự "${employee_code.trim()}" đã được dùng bởi nhân viên khác.` });
      }
      updateData.employee_code = employee_code.trim();
    }
    if (department_ids !== undefined && Array.isArray(department_ids)) {
      updateData.department_ids = department_ids;
      updateData.department_id = department_ids[0] || null;
    } else if (department_id !== undefined) {
      updateData.department_id = department_id || null;
      updateData.department_ids = department_id ? [department_id] : [];
    }
    if (manager_id !== undefined) updateData.manager_id = manager_id || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (dob !== undefined) updateData.dob = dob;
    if (join_date !== undefined) {
      updateData.join_date = join_date;
      if (join_date) {
        updateData.start_year = String(join_date).split('-')[0];
      }
    }
    if (bhxh_code !== undefined) updateData.bhxh_code = bhxh_code;
    if (emergency_phone !== undefined) updateData.emergency_phone = emergency_phone;
    if (address_current !== undefined) updateData.address_current = address_current;
    if (hometown !== undefined) updateData.hometown = hometown;
    if (cccd !== undefined) updateData.cccd = cccd;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (bank_account !== undefined) updateData.bank_account = bank_account;
    if (branch !== undefined) updateData.branch = branch;
    if (start_year !== undefined) updateData.start_year = start_year;
    if (education !== undefined) updateData.education = education;
    if (password && password.length >= 6) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password_hash');
    if (!user) return res.status(404).json({ error: 'Khong tim thay nhan vien.' });

    res.json({ message: 'Cập nhật thông tin thành công!', user });
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật nhân viên.' });
  }
};

// PATCH /api/users/:id/avatar
const updateAvatar = async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ error: 'URL anh khong duoc de trong.' });

    const targetId = req.params.id;
    const isOwner = req.user._id.toString() === targetId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Khong co quyen cap nhat avatar nguoi khac.' });
    }

    const user = await User.findByIdAndUpdate(targetId, { avatar_url }, { new: true }).select('-password_hash');
    if (!user) return res.status(404).json({ error: 'Khong tim thay nhan vien.' });

    res.json({ message: 'Da cap nhat anh dai dien!', avatar_url: user.avatar_url });
  } catch (error) {
    console.error('UpdateAvatar error:', error);
    res.status(500).json({ error: 'Loi cap nhat avatar.' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Khong tim thay nhan vien.' });

    if (user.role === 'admin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Leader không có quyền xóa tài khoản Admin.' });
      }
      const activeAdminCount = await User.countDocuments({ role: 'admin', is_active: true });
      if (activeAdminCount <= 1) {
        return res.status(400).json({ error: 'He thong can it nhat 1 tai khoan Admin dang hoat dong.' });
      }
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Ban khong the tu xoa tai khoan cua chinh minh.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Da xoa nhan vien.' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ error: 'Loi xoa nhan vien.' });
  }
};

// PATCH /api/users/:id/toggle-active
const toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Khong tim thay nhan vien.' });

    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Leader không có quyền vô hiệu hóa tài khoản Admin.' });
    }

    if (user.role === 'admin' && user.is_active) {
      const activeAdminCount = await User.countDocuments({ role: 'admin', is_active: true });
      if (activeAdminCount <= 1) {
        return res.status(400).json({ error: 'Khong the vo hieu hoa Admin duy nhat.' });
      }
    }
    if (user._id.toString() === req.user._id.toString() && user.is_active) {
      return res.status(400).json({ error: 'Ban khong the tu vo hieu hoa tai khoan cua chinh minh.' });
    }

    user.is_active = !user.is_active;
    await user.save();

    res.json({ message: user.is_active ? 'Da kich hoat' : 'Da vo hieu hoa', is_active: user.is_active });
  } catch (error) {
    console.error('ToggleActive error:', error);
    res.status(500).json({ error: 'Loi cap nhat.' });
  }
};

const DeviceSession = require('../models/DeviceSession');
const DeviceRegistry = require('../models/DeviceRegistry');

// GET /api/users/:id/devices — Admin/Leader lấy danh sách thiết bị chính chủ đã đăng ký của nhân viên
const getUserDevices = async (req, res) => {
  const { id } = req.params;
  try {
    const [sessions, registries] = await Promise.all([
      DeviceSession.find({ user_id: id }).sort({ last_used_at: -1 }),
      DeviceRegistry.find({ user_id: id }).sort({ createdAt: -1 }).limit(10)
    ]);

    res.json({
      sessions,
      recent_registries: registries
    });
  } catch (error) {
    console.error('GetUserDevices error:', error);
    res.status(500).json({ error: 'Lỗi tải danh sách thiết bị của nhân viên.' });
  }
};

// DELETE /api/users/:id/devices/:sessionId — Admin/Leader xóa / hủy ràng buộc thiết bị của nhân viên
const deleteUserDevice = async (req, res) => {
  const { id, sessionId } = req.params;
  try {
    await DeviceSession.findOneAndDelete({ _id: sessionId, user_id: id });
    res.json({ message: 'Đã xóa thiết bị thành công! Nhân viên có thể đăng ký thiết bị mới.' });
  } catch (error) {
    console.error('DeleteUserDevice error:', error);
    res.status(500).json({ error: 'Lỗi xóa thiết bị.' });
  }
};

// PUT /api/users/:id/devices/:sessionId/trust — Admin/Leader đặt thiết bị làm thiết bị chính (Primary)
const trustUserDevice = async (req, res) => {
  const { id, sessionId } = req.params;
  try {
    // 1. Untrust all other devices for this user
    await DeviceSession.updateMany({ user_id: id }, { is_trusted: false });
    // 2. Trust target device
    const updated = await DeviceSession.findOneAndUpdate(
      { _id: sessionId, user_id: id },
      { is_trusted: true, last_used_at: new Date() },
      { new: true }
    );
    res.json({ message: 'Đã thiết lập làm Thiết bị chính (Primary Device) thành công! 📱', device: updated });
  } catch (error) {
    console.error('TrustUserDevice error:', error);
    res.status(500).json({ error: 'Lỗi thiết lập thiết bị chính.' });
  }
};

module.exports = {
  getAllUsers, createUser, updateUser, updateAvatar, deleteUser, toggleActive,
  getUserDevices, deleteUserDevice, trustUserDevice
};
