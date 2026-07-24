// models/LeaveBalance.js - Số ngày phép còn lại theo từng loại
const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },
    annual_leave_total: { type: Number, default: 12 },    // Ngày phép năm tổng
    annual_leave_used:  { type: Number, default: 0 },     // Đã dùng
    sick_leave_total:   { type: Number, default: 6 },     // Nghỉ ốm tổng
    sick_leave_used:    { type: Number, default: 0 },     // Đã dùng
    unpaid_leave_used:  { type: Number, default: 0 },     // Nghỉ không lương
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

leaveBalanceSchema.index({ user_id: 1, year: 1 }, { unique: true });

// Virtual: số ngày phép còn lại
leaveBalanceSchema.virtual('annual_leave_remaining').get(function () {
  return Math.max(0, this.annual_leave_total - this.annual_leave_used);
});

leaveBalanceSchema.virtual('sick_leave_remaining').get(function () {
  return Math.max(0, this.sick_leave_total - this.sick_leave_used);
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
