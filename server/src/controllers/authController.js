// controllers/authController.js — Production Auth: Login, Register, Forgot/Reset Password, First-time Setup
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email và mật khẩu không được để trống.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('department_id', 'name')
      .populate('manager_id', 'full_name');

    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    const token = generateToken(user._id);

    const userObject = user.toObject();
    delete userObject.password_hash;
    delete userObject.reset_token;
    delete userObject.reset_token_expires;
    userObject.id = userObject._id;

    res.json({
      message: `Chào mừng, ${user.full_name}! 👋`,
      token,
      user: userObject,
      must_change_password: user.must_change_password,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi server khi đăng nhập.' });
  }
};

// POST /api/auth/register — Admin tạo tài khoản cho nhân viên
const register = async (req, res) => {
  const { email, full_name, phone, role, department_id, position, employee_code, password } = req.body;

  if (!email || !full_name) {
    return res.status(400).json({ error: 'Email và họ tên là bắt buộc.' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được sử dụng.' });
    }

    // Admin đặt mật khẩu tạm hoặc hệ thống tự tạo
    const tempPassword = password || `ET${Math.random().toString(36).slice(-6)}`;
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password_hash,
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      role: role || 'staff',
      department_id: department_id || null,
      position: position?.trim() || null,
      employee_code: employee_code?.trim() || null,
      must_change_password: true,
      is_active: true,
    });

    const userObj = user.toObject();
    delete userObj.password_hash;
    userObj.id = userObj._id;

    res.status(201).json({
      message: `Đã tạo tài khoản cho ${full_name}. Mật khẩu tạm: ${tempPassword}`,
      user: userObj,
      temp_password: tempPassword,
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Lỗi tạo tài khoản.' });
  }
};

// POST /api/auth/forgot-password — Admin/Manager tạo mã reset cho nhân viên
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập email cần reset.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này.' });
    }

    // Tạo mã reset 6 chữ số
    const resetCode = crypto.randomInt(100000, 999999).toString();
    user.reset_token = await bcrypt.hash(resetCode, 10);
    user.reset_token_expires = new Date(Date.now() + 30 * 60 * 1000); // 30 phút
    await user.save();

    // Trả mã cho Admin/Manager (không gửi email vì quy mô nhỏ)
    res.json({
      message: `Mã reset cho ${user.full_name}: ${resetCode} (hết hạn sau 30 phút)`,
      reset_code: resetCode,
      user_name: user.full_name,
      expires_in: '30 phút',
    });

  } catch (error) {
    console.error('ForgotPassword error:', error);
    res.status(500).json({ error: 'Lỗi tạo mã reset.' });
  }
};

// POST /api/auth/reset-password — Nhân viên dùng mã reset để đặt mật khẩu mới
const resetPassword = async (req, res) => {
  const { email, reset_code, new_password } = req.body;

  if (!email || !reset_code || !new_password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email, mã reset và mật khẩu mới.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    // Kiểm tra hết hạn
    if (!user.reset_token || !user.reset_token_expires || user.reset_token_expires < new Date()) {
      return res.status(400).json({ error: 'Mã reset đã hết hạn. Vui lòng yêu cầu mã mới từ quản trị viên.' });
    }

    // Kiểm tra mã reset
    const isValidCode = await bcrypt.compare(reset_code, user.reset_token);
    if (!isValidCode) {
      return res.status(400).json({ error: 'Mã reset không đúng.' });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    user.reset_token = null;
    user.reset_token_expires = null;
    user.must_change_password = false;
    await user.save();

    res.json({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' });

  } catch (error) {
    console.error('ResetPassword error:', error);
    res.status(500).json({ error: 'Lỗi đặt lại mật khẩu.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password_hash -reset_token -reset_token_expires')
      .populate('department_id', 'name')
      .populate('manager_id', 'full_name');

    const userObj = user.toObject();
    userObj.id = userObj._id;
    res.json({ user: userObj });

  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin người dùng.' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  const currentPassword = req.body.currentPassword || req.body.old_password;
  const newPassword = req.body.newPassword || req.body.new_password;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  try {
    const user = await User.findById(req.user._id);
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công! ✅' });

  } catch (error) {
    console.error('ChangePassword error:', error);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu.' });
  }
};

// PATCH /api/auth/profile — User tự cập nhật thông tin cá nhân (bao gồm avatar, thông tin gửi xe)
const updateProfile = async (req, res) => {
  const { full_name, phone, avatar_url, parking_location, vehicle_info } = req.body;
  if (full_name !== undefined && !full_name.trim()) {
    return res.status(400).json({ error: 'Họ tên không được để trống.' });
  }

  try {
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (parking_location !== undefined) updateData.parking_location = parking_location ? parking_location.trim() : 'Tòa 17T10 Nguyễn Thị Định';
    if (vehicle_info !== undefined) updateData.vehicle_info = vehicle_info ? vehicle_info.trim() : null;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password_hash -reset_token -reset_token_expires').populate('department_id', 'name');

    const userObj = user.toObject();
    userObj.id = userObj._id;
    userObj.department_name = userObj.department_id?.name || null;

    res.json({ message: 'Cập nhật thông tin thành công! ✅', user: userObj });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật thông tin.' });
  }
};

module.exports = { login, register, forgotPassword, resetPassword, getMe, changePassword, updateProfile };
