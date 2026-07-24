// models/Correction.js - MongoDB Schema Đính chính giờ chấm công (StaffPortal feature)
const mongoose = require('mongoose');

const correctionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    field: {
      type: String,
      enum: ['check_in_time', 'check_out_time', 'both'],
      required: true,
    },
    original_check_in: { type: Date, default: null },
    original_check_out: { type: Date, default: null },
    proposed_check_in: { type: Date, default: null },
    proposed_check_out: { type: Date, default: null },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewed_at: { type: Date, default: null },
    reviewer_note: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

correctionSchema.index({ user_id: 1, date: 1 });
correctionSchema.index({ status: 1 });

module.exports = mongoose.model('Correction', correctionSchema);
