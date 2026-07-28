// models/SystemSetting.js - Cài đặt quy định giờ làm & cấu hình hệ thống
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    // Thông tin công ty
    company_name: { type: String, default: 'ET Architects' },
    company_logo_url: { type: String, default: null },
    // Ca làm việc
    work_start_time: { type: String, default: '08:30' },       // Giờ vào chuẩn
    work_end_time: { type: String, default: '17:30' },         // Giờ về chuẩn
    lunch_break_start: { type: String, default: '12:00' },     // Giờ nghỉ trưa
    lunch_break_end: { type: String, default: '13:00' },       // Giờ hết nghỉ trưa
    minor_late_mins: { type: Number, default: 10 },            // Muộn nhẹ
    medium_late_mins: { type: Number, default: 30 },           // Muộn vừa
    ot_start_time: { type: String, default: '18:00' },         // OT tính từ
    ot_mode: { type: String, enum: ['auto', 'manual'], default: 'manual' }, // auto=tính giờ, manual=giám đốc xét
    // Ngày làm việc (Mon-Sat: công ty làm cả T7, nghỉ CN)
    working_days: {
      type: [String],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
    holidays: [{ date: String, name: String }],               // Ngày lễ nghỉ
    makeup_days: [{ date: String, name: String }],            // Ngày làm bù
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
