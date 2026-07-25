// routes/timesheetLock.routes.js - Routes Quản Lý Chốt Công & Audit Logs
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
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

// Chốt công / Mở chốt công (Admin / Manager)
router.post('/toggle', roleMiddleware(['admin', 'manager']), toggleLock);

// Chỉnh sửa ô công có lưu lý do & lịch sử (Admin / Manager)
router.post('/override-cell', roleMiddleware(['admin', 'manager']), overrideCell);

module.exports = router;
