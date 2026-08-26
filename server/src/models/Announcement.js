// models/Announcement.js - Thong bao noi bo & ghim
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    is_pinned: { type: Boolean, default: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expires_at: { type: Date, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);


announcementSchema.index({ is_active: 1, created_at: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
