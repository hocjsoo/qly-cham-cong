// models/OfficeLocation.js - MongoDB Schema Vị trí văn phòng
const mongoose = require('mongoose');

const officeLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Văn phòng chính',
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    radius_m: {
      type: Number,
      default: 100,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at' },
  }
);

module.exports = mongoose.model('OfficeLocation', officeLocationSchema);
