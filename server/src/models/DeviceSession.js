// models/DeviceSession.js — Thiết bị đã xác thực (chống chấm công hộ)
const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    device_fingerprint: {
      type: String,
      required: true,
    },
    device_name: {
      type: String,
      default: 'Unknown Device',
    },
    user_agent: {
      type: String,
      default: null,
    },
    screen_info: {
      type: String,
      default: null,
    },
    is_trusted: {
      type: Boolean,
      default: false,
    },
    last_used_at: {
      type: Date,
      default: Date.now,
    },
    check_in_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Mỗi user + fingerprint là unique
deviceSessionSchema.index({ user_id: 1, device_fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);
