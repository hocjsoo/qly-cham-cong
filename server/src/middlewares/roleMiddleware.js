// ==============================================
// middlewares/roleMiddleware.js
// Kiểm tra quyền truy cập theo role
// ==============================================

/**
 * Factory function tạo middleware kiểm tra role
 * Chấp nhận cả: requireRole('admin', 'manager') và requireRole(['admin', 'manager'])
 */
const requireRole = (...roles) => {
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này. Yêu cầu role: ${allowedRoles.join(' hoặc ')}`
      });
    }

    next();
  };
};

// Hỗ trợ cả 2 cách require:
// 1) const { requireRole } = require('../middlewares/roleMiddleware');
// 2) const roleMiddleware = require('../middlewares/roleMiddleware'); -> roleMiddleware('admin')
requireRole.requireRole = requireRole;

module.exports = requireRole;
