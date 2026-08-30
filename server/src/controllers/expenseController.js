// server/src/controllers/expenseController.js
// Quản lý Bảng Tổng Hợp Chi Tiêu & Hoàn Ứng Công Ty — CRUD, Duyệt chi, Hoàn tiền, Thống kê KPI

const Expense = require('../models/Expense');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');
const {
  isLeaderRole,
  getDepartmentIds,
  buildLeaderUserScope,
  combineUserFilters,
  canManageUserId,
} = require('../utils/roleScope');

const formatVND = (num) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
};

// GET /api/expenses — Lấy danh sách chi tiêu kèm bộ lọc & thống kê KPI
const getExpenses = async (req, res) => {
  try {
    const { user_id, approval_status, payment_status, has_vat, month, year, search } = req.query;
    const requestedFilter = {};

    if (user_id && user_id !== 'all') {
      requestedFilter.user_id = user_id;
    }

    if (approval_status && approval_status !== 'all') {
      requestedFilter.approval_status = approval_status;
    }

    if (payment_status && payment_status !== 'all') {
      requestedFilter.payment_status = payment_status;
    }

    if (has_vat !== undefined && has_vat !== 'all') {
      requestedFilter.has_vat_invoice = has_vat === 'true' || has_vat === true;
    }

    if (month && month !== 'all') {
      const targetYear = year || new Date().getFullYear();
      const monthStr = String(month).padStart(2, '0');
      requestedFilter.date = { $regex: `^${targetYear}-${monthStr}` };
    } else if (year && year !== 'all') {
      requestedFilter.date = { $regex: `^${year}-` };
    }

    if (search && search.trim()) {
      requestedFilter.description = { $regex: search.trim(), $options: 'i' };
    }

    const filter = requestedFilter;

    const isExport = req.query.export === 'true' || req.query.export === true;
    const hasPagination = !isExport && (req.query.page !== undefined || req.query.limit !== undefined);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = hasPagination ? Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500) : 0;
    const skip = hasPagination ? (page - 1) * limit : 0;

    // Export mode: tối giản projection, bỏ toàn bộ populate dữ liệu hiển thị & capability
    const exportSelectFields = '_id user_id date description amount has_vat_invoice notes approval_status approved_at rejection_reason payment_status paid_at payment_note created_at';
    // Normal mode: đầy đủ trường để hiển thị card, lightbox và capability buttons
    const normalSelectFields = '_id user_id date description amount has_vat_invoice receipt_url notes approval_status approved_by approved_at rejection_reason payment_status paid_by paid_at payment_note created_at';
    const selectFields = isExport ? exportSelectFields : normalSelectFields;

    let query = Expense.find(filter).select(selectFields);

    if (!isExport) {
      // Populate thông tin người chi, người duyệt & người hoàn ứng chỉ cần cho giao diện card/table, không cần cho CSV export
      query = query
        .populate('user_id', '_id full_name employee_code department_name avatar_url')
        .populate('approved_by', '_id full_name')
        .populate('paid_by', '_id full_name');
    }

    query = query.sort({ date: -1, created_at: -1 });

    if (hasPagination) {
      query = query.skip(skip).limit(limit);
    }

    // countDocuments không cần thiết khi export (không phân trang)
    const [expenses, totalFilteredCount] = await Promise.all([
      query.lean(),
      isExport ? Promise.resolve(0) : Expense.countDocuments(filter),
    ]);

    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);
    const currentUserIdStr = String(req.user._id);

    let expenseDtos;

    if (isExport) {
      // Export mode: không tính capability, không cần User.find scope, trả raw DTO
      expenseDtos = expenses.map(exp => ({ ...exp }));
    } else {
      // Normal mode: tính đầy đủ capability để điều khiển nút giao diện
      let managedSubordinateIds = new Set();
      if (isLeader && !isAdmin) {
        const managedSubordinates = await User.find(
          buildLeaderUserScope(req.user, { includeSelf: false, excludeAdmins: true })
        ).select('_id').lean();
        managedSubordinateIds = new Set(managedSubordinates.map(u => String(u._id)));
      }

      expenseDtos = expenses.map(exp => {
        const ownerId = String(exp.user_id?._id || exp.user_id || '');
        const isOwner = ownerId === currentUserIdStr;
        const isSubordinate = isLeader && managedSubordinateIds.has(ownerId);
        const isPending = exp.approval_status === 'pending';
        const isApproved = exp.approval_status === 'approved';

        const canApprove = (isAdmin || isSubordinate) && isPending;
        const canDelete = isAdmin || ((isOwner || isSubordinate) && isPending);
        const canToggleVat = isAdmin || ((isOwner || isSubordinate) && isPending);
        const canMarkPaid = isAdmin && isApproved;
        const canManage = canApprove || canDelete || canToggleVat || canMarkPaid;

        return {
          ...exp,
          can_approve: canApprove,
          can_delete: canDelete,
          can_toggle_vat: canToggleVat,
          can_mark_paid: canMarkPaid,
          can_manage: canManage,
        };
      });
    }

    // Tính toán KPIs chỉ khi xem giao diện (bỏ qua khi export để tối ưu hiệu năng)
    let totalApprovedAmount = 0;
    let totalPendingAmount = 0;
    let totalPendingCount = 0;
    let totalUnpaidAmount = 0;
    let totalPaidAmount = 0;
    let myTotalApproved = 0;
    let myTotalUnpaid = 0;

    if (!isExport) {
      const summaryDateFilter = year && year !== 'all' ? { date: { $regex: `^${year}-` } } : {};
      const allExpenses = await Expense.find(summaryDateFilter)
        .select('user_id amount approval_status payment_status date')
        .lean();

      allExpenses.forEach(exp => {
        const isMine = String(exp.user_id) === currentUserIdStr;

        if (exp.approval_status === 'approved') {
          totalApprovedAmount += exp.amount || 0;
          if (exp.payment_status === 'paid') {
            totalPaidAmount += exp.amount || 0;
          } else {
            totalUnpaidAmount += exp.amount || 0;
          }

          if (isMine) {
            myTotalApproved += exp.amount || 0;
            if (exp.payment_status !== 'paid') {
              myTotalUnpaid += exp.amount || 0;
            }
          }
        } else if (exp.approval_status === 'pending') {
          totalPendingAmount += exp.amount || 0;
          totalPendingCount += 1;
        }
      });
    }

    const exportCount = expenses.length;
    res.json({
      expenses: expenseDtos,
      summary: {
        totalApprovedAmount,
        totalPendingAmount,
        totalPendingCount,
        totalUnpaidAmount,
        totalPaidAmount,
        myTotalApproved,
        myTotalUnpaid,
        totalCount: isExport ? exportCount : totalFilteredCount,
        page: hasPagination ? page : 1,
        limit: hasPagination ? limit : exportCount,
        totalPages: hasPagination ? (Math.ceil(totalFilteredCount / limit) || 1) : 1,
      }
    });
  } catch (error) {
    console.error('GetExpenses error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách chi tiêu.' });
  }
};

// POST /api/expenses — Nhân viên báo cáo khoản chi mới
const createExpense = async (req, res) => {
  try {
    const { date, description, amount, has_vat_invoice, receipt_url, notes } = req.body;

    if (!date || !description || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ ngày giao dịch, mô tả và số tiền.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Số tiền chi phải là số dương lớn hơn 0.' });
    }

    const expense = await Expense.create({
      user_id: req.user._id,
      date: date.trim(),
      description: description.trim(),
      amount: numAmount,
      has_vat_invoice: Boolean(has_vat_invoice),
      receipt_url: receipt_url || null,
      notes: notes ? notes.trim() : null,
      approval_status: 'pending',
      payment_status: 'unpaid',
    });

    // Thông báo cho Admin và Leader trực tiếp quản lý người gửi.
    const employeeDepartmentIds = getDepartmentIds(req.user);
    const leaderRelationships = [];
    if (req.user.manager_id) leaderRelationships.push({ _id: req.user.manager_id });
    if (employeeDepartmentIds.length > 0) {
      leaderRelationships.push(
        { department_ids: { $in: employeeDepartmentIds } },
        { department_id: { $in: employeeDepartmentIds } }
      );
    }
    const reviewerConditions = [{ role: 'admin' }];
    if (leaderRelationships.length > 0) {
      reviewerConditions.push({
        role: { $in: ['leader', 'manager'] },
        $or: leaderRelationships,
      });
    }
    const admins = await User.find({
      is_active: { $ne: false },
      $or: reviewerConditions,
    }).select('_id');
    for (const admin of admins) {
      if (String(admin._id) !== String(req.user._id)) {
        await Notification.create({
          user_id: admin._id,
          title: '💵 Yêu cầu hoàn ứng / Chi tiêu mới',
          message: `${req.user.full_name} đã báo cáo khoản chi "${description.trim()}" (${formatVND(numAmount)}).`,
          type: 'request',
          link: '/expenses',
        }).catch(() => {});
      }
    }

    logAction({
      performed_by: req.user._id,
      action: 'EXPENSE_CREATED',
      target_model: 'Expense',
      target_id: expense._id,
      description: `Báo cáo chi tiêu: ${description} (${formatVND(numAmount)})`,
      req,
    });

    res.status(201).json({
      message: 'Đã gửi báo cáo chi tiêu thành công! 💵',
      expense,
    });
  } catch (error) {
    console.error('CreateExpense error:', error);
    res.status(500).json({ error: 'Lỗi tạo báo cáo chi tiêu.' });
  }
};

// PUT /api/expenses/:id — Sửa thông tin khoản chi
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description, amount, has_vat_invoice, receipt_url, notes } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ error: 'Không tìm thấy khoản chi tiêu.' });

    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);
    const isOwner = String(expense.user_id) === String(req.user._id);

    if (!isAdmin && expense.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Không thể sửa khoản chi đã được phê duyệt hoặc thanh toán.' });
    }
    if (!isOwner && !isAdmin) {
      const canManage = isLeader && await canManageUserId(req.user, expense.user_id);
      if (!canManage) {
        return res.status(403).json({ error: 'Bạn không có quyền sửa khoản chi này.' });
      }
    }

    if (date !== undefined) expense.date = date.trim();
    if (description !== undefined) expense.description = description.trim();
    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Số tiền chi phải là số dương lớn hơn 0.' });
      }
      expense.amount = numAmount;
    }
    if (has_vat_invoice !== undefined) expense.has_vat_invoice = Boolean(has_vat_invoice);
    if (receipt_url !== undefined) expense.receipt_url = receipt_url;
    if (notes !== undefined) expense.notes = notes ? notes.trim() : null;

    await expense.save();

    res.json({ message: 'Đã cập nhật khoản chi tiêu thành công! ✅', expense });
  } catch (error) {
    console.error('UpdateExpense error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật khoản chi tiêu.' });
  }
};

// DELETE /api/expenses/:id — Xóa khoản chi tiêu
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ error: 'Không tìm thấy khoản chi tiêu.' });

    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);
    const isOwner = String(expense.user_id) === String(req.user._id);

    if (!isAdmin && expense.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Không thể xóa khoản chi đã được phê duyệt hoặc thanh toán.' });
    }
    if (!isOwner && !isAdmin) {
      const canManage = isLeader && await canManageUserId(req.user, expense.user_id);
      if (!canManage) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa khoản chi này.' });
      }
    }

    await Expense.findByIdAndDelete(id);

    res.json({ message: 'Đã xóa khoản chi tiêu thành công.' });
  } catch (error) {
    console.error('DeleteExpense error:', error);
    res.status(500).json({ error: 'Lỗi xóa khoản chi tiêu.' });
  }
};

// PUT /api/expenses/:id/approve — Phê duyệt hoặc từ chối chi tiêu (Admin/Leader)
const approveExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái duyệt không hợp lệ.' });
    }

    const expense = await Expense.findById(id).populate('user_id', 'full_name');
    if (!expense) return res.status(404).json({ error: 'Không tìm thấy khoản chi tiêu.' });
    if (expense.payment_status === 'paid') {
      return res.status(400).json({ error: 'Khoản chi đã hoàn ứng. Hãy chuyển về chưa hoàn ứng trước khi thay đổi kết quả duyệt.' });
    }

    if (isLeaderRole(req.user) && !(await canManageUserId(req.user, expense.user_id?._id || expense.user_id))) {
      return res.status(403).json({ error: 'Bạn chỉ được duyệt khoản chi của nhân sự thuộc nhóm mình quản lý.' });
    }

    expense.approval_status = status;
    expense.approved_by = req.user._id;
    expense.approved_at = new Date();
    if (status === 'rejected') {
      expense.rejection_reason = rejection_reason ? rejection_reason.trim() : 'Từ chối duyệt chi';
    } else {
      expense.rejection_reason = null;
    }

    await expense.save();

    // Gửi thông báo cho nhân viên
    await Notification.create({
      user_id: expense.user_id._id,
      title: status === 'approved' ? '✅ Khoản chi tiêu đã được duyệt' : '❌ Khoản chi tiêu bị từ chối',
      message: status === 'approved'
        ? `Khoản chi "${expense.description}" (${formatVND(expense.amount)}) đã được duyệt!`
        : `Khoản chi "${expense.description}" (${formatVND(expense.amount)}) bị từ chối: ${expense.rejection_reason}`,
      type: 'request',
      link: '/expenses',
    }).catch(() => {});

    logAction({
      performed_by: req.user._id,
      action: status === 'approved' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      target_model: 'Expense',
      target_id: expense._id,
      description: `${status === 'approved' ? 'Duyệt chi' : 'Từ chối chi'}: ${expense.description} (${formatVND(expense.amount)})`,
      req,
    });

    res.json({
      message: status === 'approved' ? 'Đã duyệt khoản chi tiêu thành công! ✅' : 'Đã từ chối khoản chi tiêu.',
      expense
    });
  } catch (error) {
    console.error('ApproveExpense error:', error);
    res.status(500).json({ error: 'Lỗi duyệt khoản chi tiêu.' });
  }
};

// PUT /api/expenses/:id/pay — Xác nhận đã chi trả / hoàn ứng tiền cho nhân viên (Admin only)
const markAsPaid = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền xác nhận hoàn ứng.' });
    }

    const { id } = req.params;
    const { payment_status = 'paid', payment_note } = req.body; // 'paid' | 'unpaid'
    if (!['paid', 'unpaid'].includes(payment_status)) {
      return res.status(400).json({ error: 'Trạng thái hoàn ứng không hợp lệ.' });
    }

    const expense = await Expense.findById(id).populate('user_id', 'full_name');
    if (!expense) return res.status(404).json({ error: 'Không tìm thấy khoản chi tiêu.' });
    if (payment_status === 'paid' && expense.approval_status !== 'approved') {
      return res.status(400).json({ error: 'Chỉ được hoàn ứng sau khi khoản chi đã được phê duyệt.' });
    }

    expense.payment_status = payment_status;
    if (payment_status === 'paid') {
      expense.paid_by = req.user._id;
      expense.paid_at = new Date();
      expense.payment_note = payment_note ? payment_note.trim() : 'Đã thanh toán / chuyển khoản';
    } else {
      expense.paid_by = null;
      expense.paid_at = null;
      expense.payment_note = null;
    }

    await expense.save();

    // Gửi thông báo cho nhân viên khi thanh toán
    if (payment_status === 'paid') {
      await Notification.create({
        user_id: expense.user_id._id,
        title: '💳 Đã hoàn ứng tiền chi tiêu',
        message: `Khoản chi "${expense.description}" (${formatVND(expense.amount)}) đã được hoàn trả! Vui lòng kiểm tra tài khoản.`,
        type: 'request',
        link: '/expenses',
      }).catch(() => {});
    }

    logAction({
      performed_by: req.user._id,
      action: payment_status === 'paid' ? 'EXPENSE_PAID' : 'EXPENSE_UNPAID',
      target_model: 'Expense',
      target_id: expense._id,
      description: `Đổi trạng thái thanh toán khoản chi: ${expense.description} (${formatVND(expense.amount)}) -> ${payment_status}`,
      req,
    });

    res.json({
      message: payment_status === 'paid' ? 'Đã xác nhận thanh toán hoàn ứng thành công! 💳' : 'Đã chuyển về trạng thái chưa trả tiền.',
      expense
    });
  } catch (error) {
    console.error('MarkAsPaid error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái chi trả.' });
  }
};

// PUT /api/expenses/:id/vat — Bật/tắt nhanh trạng thái hóa đơn VAT
const toggleVat = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ error: 'Không tìm thấy khoản chi tiêu.' });

    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);
    const isOwner = String(expense.user_id) === String(req.user._id);

    if (!isAdmin && expense.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Không thể đổi trạng thái VAT của khoản chi đã được duyệt.' });
    }
    if (!isOwner && !isAdmin) {
      const canManage = isLeader && await canManageUserId(req.user, expense.user_id);
      if (!canManage) {
        return res.status(403).json({ error: 'Bạn không có quyền cập nhật hóa đơn VAT của khoản chi này.' });
      }
    }

    expense.has_vat_invoice = !expense.has_vat_invoice;
    await expense.save();

    res.json({ message: 'Đã cập nhật trạng thái hóa đơn VAT!', has_vat_invoice: expense.has_vat_invoice });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật VAT.' });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  markAsPaid,
  toggleVat,
};
