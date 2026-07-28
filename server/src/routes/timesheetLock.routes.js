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
} = require('../controllers/timesheetLockController');

router.use(authMiddleware);

// Xem ma trận chốt công
router.get('/full-matrix', getFullMatrix);

// Xem lịch sử chỉnh sửa ô công
router.get('/audit-logs', getAuditLogs);

// Chốt công / Mở chốt công (Admin)
router.post('/toggle', requireRole('admin'), toggleLock);

// Chỉnh sửa ô công có lưu lý do & lịch sử (Admin)
router.post('/override-cell', requireRole('admin'), overrideCell);

module.exports = router;
