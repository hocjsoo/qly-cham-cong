// models/Holiday.js — Schema Ngày Nghỉ Lễ Công Ty
const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    end_date: {
      type: String, // Format YYYY-MM-DD (dành cho nghỉ lễ nhiều ngày)
      default: null,
    },
    is_paid: {
      type: Boolean,
      default: true, // Nghỉ lễ hưởng nguyên lương
    },
    note: {
      type: String,
      default: null,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

holidaySchema.index({ date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
