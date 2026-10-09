// server/src/routes/fund.routes.js
// Định tuyến API cho Module Sổ Quỹ Tạm Ứng Xoay Vòng (Advance Fund)

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  getFunds,
  createFundDeposit,
  updateFundDeposit,
  deleteFundDeposit,
} = require('../controllers/fundController');

router.use(authMiddleware);

// Lấy danh sách nạp quỹ & số dư dòng tiền (Mọi nhân sự có thể xem minh bạch)
router.get('/', getFunds);

// Ghi nhận đợt nạp quỹ mới từ Sếp (Admin & Leader/Manager)
router.post('/', requireRole('admin', 'manager'), createFundDeposit);

// Sửa thông tin đợt nạp quỹ (Admin only)
router.put('/:id', requireRole('admin'), updateFundDeposit);

// Xóa đợt nạp quỹ (Admin only)
router.delete('/:id', requireRole('admin'), deleteFundDeposit);

module.exports = router;
