// models/Department.js - MongoDB Schema Phòng ban
const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'created_at' },
  }
);

module.exports = mongoose.model('Department', departmentSchema);
