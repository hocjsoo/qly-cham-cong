// server/src/models/Expense.js
// Model Chi Tiêu & Hoàn Ứng Công Ty — Quản lý các khoản chi hộ, hóa đơn VAT & trạng thái thanh toán

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  has_vat_invoice: {
    type: Boolean,
    default: false,
  },
  receipt_url: {
    type: String,
    default: null, // Ảnh hóa đơn / bill / phiếu thu
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approved_at: {
    type: Date,
    default: null,
  },
  rejection_reason: {
    type: String,
    default: null,
  },
  payment_status: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  },
  paid_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  paid_at: {
    type: Date,
    default: null,
  },
  payment_note: {
    type: String,
    default: null,
  },
  notes: {
    type: String,
    default: null,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

expenseSchema.index({ user_id: 1, date: -1 });
expenseSchema.index({ approval_status: 1, payment_status: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
