// routes/timesheetLock.routes.js - Routes Quản Lý Chốt Công & Audit Logs
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  getFullMatrix,
  toggleLock,
  overrideCell,
  getAuditLogs,
  getAuditLogDetail,
} = require('../controllers/timesheetLockController');

router.use(authMiddleware);

// GET /full-matrix — Xem bảng công toàn công ty (Tất cả nhân viên đã đăng nhập)
router.get('/full-matrix', getFullMatrix);

// Các thao tác bên dưới chỉ dành riêng cho Admin
router.use(requireRole('admin'));

// Xem lịch sử chỉnh sửa ô công (Admin)
router.get('/audit-logs', getAuditLogs);
router.get('/audit-logs/:id/snapshot', getAuditLogDetail);

// Chốt công / Mở chốt công (Admin)
router.post('/toggle', toggleLock);

// Chỉnh sửa ô công có lưu lý do & lịch sử (Admin)
router.post('/override-cell', overrideCell);

module.exports = router;
