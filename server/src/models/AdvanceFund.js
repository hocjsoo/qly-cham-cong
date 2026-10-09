// server/src/models/AdvanceFund.js
// Model Sổ Quỹ Tạm Ứng Xoay Vòng — Ghi nhận các đợt nạp quỹ từ Sếp / Ban Giám Đốc

const mongoose = require('mongoose');

const advanceFundSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  sender_name: {
    type: String,
    trim: true,
    default: 'Ban Giám Đốc / Sếp',
  },
  holder_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Người giữ quỹ (Ví dụ: Anh Trường)
  },
  note: {
    type: String,
    trim: true,
    default: null,
  },
  receipt_url: {
    type: String,
    default: null, // Ảnh bill chuyển khoản
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

advanceFundSchema.index({ date: -1, created_at: -1 });
advanceFundSchema.index({ holder_id: 1 });

module.exports = mongoose.model('AdvanceFund', advanceFundSchema);
