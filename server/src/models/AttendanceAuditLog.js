// models/AttendanceAuditLog.js - Schema Lưu Lịch Sử Chỉnh Sửa Công Có Lý Do & Thời Gian
const mongoose = require('mongoose');

const attendanceAuditLogSchema = new mongoose.Schema(
  {
    attendance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user_name: {
      type: String,
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    old_symbol: {
      type: String,
      default: '—',
    },
    new_symbol: {
      type: String,
      required: true,
    },
    reason: {
      type: String, // Bắt buộc lý do sửa
      required: true,
    },
    modified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    modified_by_name: {
      type: String,
      required: true,
    },
    modified_at: {
      type: Date,
      default: Date.now,
    },
    snapshot_before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    snapshot_after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceAuditLog', attendanceAuditLogSchema);
