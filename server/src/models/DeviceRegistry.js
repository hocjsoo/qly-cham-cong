// models/DeviceRegistry.js — Theo dõi thiết bị phần cứng vật lý theo ngày (chống chấm hộ nhiều nick trên 1 máy)
const mongoose = require('mongoose');

const deviceRegistrySchema = new mongoose.Schema(
  {
    hardware_uuid: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      default: 'Unknown Device',
    },
    user_agent: {
      type: String,
      default: null,
    },
    browser_family: {
      type: String,
      default: null,
    },
    screen_resolution: {
      type: String,
      default: null,
    },
    check_in_time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index kép đảm bảo truy vấn cực nhanh theo thiết bị + ngày
deviceRegistrySchema.index({ hardware_uuid: 1, date: 1 });
deviceRegistrySchema.index({ hardware_uuid: 1, user_id: 1 });

module.exports = mongoose.model('DeviceRegistry', deviceRegistrySchema);
