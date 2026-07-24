// ==============================================
// middlewares/roleMiddleware.js
// Kiểm tra quyền truy cập theo role
// ==============================================

/**
 * Factory function tạo middleware kiểm tra role
 *
 * Cách dùng:
 *   // Chỉ Admin
 *   router.delete('/users/:id', authMiddleware, requireRole('admin'), controller)
 *
 *   // Admin hoặc Manager
 *   router.get('/dashboard', authMiddleware, requireRole('admin', 'manager'), controller)
 *
 * @param {...string} roles - Các role được phép truy cập
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    // authMiddleware phải chạy trước để có req.user
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này. Yêu cầu role: ${roles.join(' hoặc ')}`
      });
    }

    next();
  };
};

module.exports = { requireRole };
