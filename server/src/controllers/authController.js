// controllers/authController.js - Mongoose Auth Controller
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

    const token = generateToken(user._id);

    const userObject = user.toObject();
    delete userObject.password_hash;
    userObject.id = userObject._id;

    res.json({
      message: `Chào mừng, ${user.full_name}! 👋`,
      token,
      user: userObject
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi server khi đăng nhập.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password_hash')
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
  // Accept both field name conventions
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
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công!' });

  } catch (error) {
    console.error('ChangePassword error:', error);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu.' });
  }
};

// PATCH /api/auth/profile — User tự cập nhật thông tin cá nhân
const updateProfile = async (req, res) => {
  const { full_name, phone } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'Họ tên không được để trống.' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { full_name: full_name.trim(), phone: phone?.trim() || null },
      { new: true }
    ).select('-password_hash').populate('department_id', 'name');

    const userObj = user.toObject();
    userObj.id = userObj._id;
    userObj.department_name = userObj.department_id?.name || null;

    res.json({ message: 'Cập nhật thông tin thành công!', user: userObj });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật thông tin.' });
  }
};

module.exports = { login, getMe, changePassword, updateProfile };
