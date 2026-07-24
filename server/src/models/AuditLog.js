// models/AuditLog.js - Ghi lại mọi hành động quan trọng của admin
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    performed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      // Ví dụ: USER_CREATED, USER_UPDATED, USER_DEACTIVATED, ATTENDANCE_OVERRIDDEN,
      // REQUEST_APPROVED, REQUEST_REJECTED, LOCATION_CREATED, LOCATION_DELETED
    },
    target_model: {
      type: String,
      default: null,
      // Ví dụ: 'User', 'Attendance', 'Request', 'OfficeLocation'
    },
    target_id: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    old_values: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    new_values: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip_address: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

auditLogSchema.index({ created_at: -1 });
auditLogSchema.index({ performed_by: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
