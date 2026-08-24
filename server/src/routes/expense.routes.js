// server/src/routes/expense.routes.js
// Định tuyến API cho Module Chi Tiêu & Hoàn Ứng Công Ty

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  markAsPaid,
  toggleVat,
} = require('../controllers/expenseController');

router.use(authMiddleware);

// Xem danh sách chi tiêu & KPI (Mọi nhân viên đều có thể xem)
router.get('/', getExpenses);

// Báo cáo khoản chi mới (Mọi nhân viên)
router.post('/', createExpense);

// Sửa khoản chi (Chủ khoản chi nếu pending hoặc Admin/Leader)
router.put('/:id', updateExpense);

// Xóa khoản chi (Chủ khoản chi nếu pending hoặc Admin/Leader)
router.delete('/:id', deleteExpense);

// Duyệt chi / Từ chối (Admin / Leader)
router.put('/:id/approve', requireRole('admin', 'manager'), approveExpense);

// Xác nhận đã chuyển khoản hoàn ứng (Admin only)
router.put('/:id/pay', requireRole('admin', 'manager'), markAsPaid);

// Đổi trạng thái hóa đơn VAT (Admin hoặc Chủ khoản chi)
router.put('/:id/vat', toggleVat);

module.exports = router;
