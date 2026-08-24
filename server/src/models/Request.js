// models/Request.js - MongoDB Schema Đơn từ giải trình
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['late', 'early_leave', 'overtime', 'business_trip', 'foreign_trip', 'wfh', 'sick_leave', 'annual_leave', 'unpaid_leave', 'vehicle_update', 'other'],
      required: true,
    },
    start_date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    end_date: {
      type: String,
      default: null,
    },
    start_time: {
      type: String,
      default: null,
    },
    end_time: {
      type: String,
      default: null,
    },
    proposed_parking_location: {
      type: String,
      default: null,
    },
    proposed_vehicle_info: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      required: true,
    },
    attachment_url: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    reviewer_note: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Request', requestSchema);
