// middlewares/authMiddleware.js - Mongoose JWT Auth
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.'
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
      }
      return res.status(401).json({ error: 'Token không hợp lệ.' });
    }

    const user = await User.findById(decoded.userId).select('-password_hash');

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hoá.' });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Lỗi xác thực, thử lại sau.' });
  }
};

module.exports = authMiddleware;
