// models/Attendance.js - MongoDB Schema Chấm công
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    check_in_time: {
      type: Date,
      default: null,
    },
    check_in_lat: {
      type: Number,
      default: null,
    },
    check_in_lng: {
      type: Number,
      default: null,
    },
    check_in_type: {
      type: String,
      enum: ['office', 'site', 'client', 'wfh'],
      required: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    project_name: {
      type: String,
      default: null,
    },
    check_in_note: {
      type: String,
      default: null,
    },
    check_out_time: {
      type: Date,
      default: null,
    },
    check_out_lat: {
      type: Number,
      default: null,
    },
    check_out_lng: {
      type: Number,
      default: null,
    },
    check_out_note: {
      type: String,
      default: null,
    },
    total_hours: {
      type: Number,
      default: 0,
    },
    ot_hours: {
      type: Number,
      default: 0,
    },
    is_late: {
      type: Boolean,
      default: false,
    },
    late_minutes: {
      type: Number,
      default: 0,
    },
    late_tier: {
      type: String,
      enum: ['on_time', 'late_minor', 'late_medium', 'late_severe'],
      default: 'on_time',
    },
    is_early_leave: {
      type: Boolean,
      default: false,
    },
    early_minutes: {
      type: Number,
      default: 0,
    },
    auto_checkout: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['present', 'late', 'half_day', 'absent', 'leave'],
      default: 'present',
    },
    notes: {
      type: String,
      default: null,
    },
    // Số công tính thực tế (1.0 hoặc 0.75 khi muộn > 30p)
    work_units: {
      type: Number,
      default: 1.0,
    },
    // Chế độ check-in (gps | photo | manual)
    check_in_mode: {
      type: String,
      enum: ['gps', 'photo', 'manual'],
      default: 'gps',
    },
    // Các trường chống gian lận & xác thực phần cứng
    hardware_uuid: {
      type: String,
      default: null,
      index: true,
    },
    is_flagged: {
      type: Boolean,
      default: false,
    },
    flag_reasons: [{
      type: String, // 'MULTI_ACCOUNT_SAME_DEVICE', 'SUSPICIOUS_LOCATION', 'GPS_OUTSIDE_PHOTO_FALLBACK'
    }],
    selfie_url: {
      type: String,
      default: null,
    },
    verification_status: {
      type: String,
      enum: ['auto_approved', 'pending_review', 'rejected'],
      default: 'auto_approved',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Ràng buộc 1 user chỉ 1 bản ghi/ngày
attendanceSchema.index({ user_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
