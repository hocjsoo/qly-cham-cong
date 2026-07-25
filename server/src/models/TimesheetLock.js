// models/TimesheetLock.js - Schema Quản Lý Trạng Thái Chốt Công Theo Tháng & Nhân Viên
const mongoose = require('mongoose');

const timesheetLockSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = chốt toàn bộ công ty
    },
    is_locked: {
      type: Boolean,
      default: true,
    },
    locked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    locked_by_name: {
      type: String,
    },
    locked_at: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

timesheetLockSchema.index({ month: 1, year: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('TimesheetLock', timesheetLockSchema);
