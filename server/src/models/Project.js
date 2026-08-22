// models/Project.js - MongoDB Schema Dự án / Công trình (Theo mẫu thực tế ET_Staff)
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    code: {
      type: String, // Mã dự án (NO)
      required: true,
      trim: true,
    },
    name: {
      type: String, // Tên dự án
      required: true,
      trim: true,
    },
    sub_project: {
      type: String, // DA Thành phần
      trim: true,
      default: null,
    },
    category: {
      type: String, // Phân loại: Kiến trúc, Nội thất, Thiết kế&Thi công...
      enum: [
        'Kiến trúc',
        'Nội thất',
        'Kiến trúc&Nội thất',
        'Thiết kế&Thi công',
        'Cuộc thi',
        'Quy hoạch',
        'Quy hoạch&Kiến trúc',
        'Truyền thông',
        'Khác'
      ],
      default: 'Kiến trúc',
    },
    pm_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pm_name: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    client_name: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'Chưa bắt đầu',
        'Chờ',
        'Cần thực hiện',
        'Đang tiến hành',
        'Đã hoàn thành',
        'Đã lưu trữ',
        'Backlog',
        'Khác'
      ],
      default: 'Đang tiến hành',
    },
    // Danh sách thành viên tham gia dự án
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Hạn chót & Tiến độ
    deadline: {
      type: String, // YYYY-MM-DD
      default: null,
    },
    start_date: {
      type: String, // YYYY-MM-DD
      default: null,
    },
    progress: {
      type: Number, // 0 - 100
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Project', projectSchema);
