// models/Notification.js — Schema Thông báo hệ thống
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = Thông báo chung toàn công ty (Broadcast)
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['system', 'request', 'attendance', 'announcement'],
      default: 'system',
    },
    link: {
      type: String,
      default: null,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
