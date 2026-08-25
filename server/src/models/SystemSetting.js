// models/SystemSetting.js - Cài đặt quy định giờ làm & cấu hình hệ thống
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    // Thông tin công ty
    company_name: { type: String, default: 'ET Architects' },
    company_logo_url: { type: String, default: null },
    // Ca làm việc chuẩn ET Architects (09:00 - 18:30)
    work_start_time: { type: String, default: '09:00' },       // Giờ vào chuẩn
    work_end_time: { type: String, default: '18:30' },         // Giờ về chuẩn
    lunch_break_start: { type: String, default: '12:00' },     // Giờ nghỉ trưa
    lunch_break_end: { type: String, default: '13:00' },       // Giờ hết nghỉ trưa
    minor_late_mins: { type: Number, default: 30 },            // Muộn nhẹ (≤ 30p, 1.0 công nhắc nhở)
    medium_late_mins: { type: Number, default: 60 },           // Muộn vừa (> 30p, trừ 0.25 công)
    ot_start_time: { type: String, default: '18:30' },         // OT tính từ 18:30
    ot_mode: { type: String, enum: ['auto', 'manual'], default: 'manual' }, // auto=tính giờ, manual=giám đốc xét
    default_gps_radius_meters: { type: Number, default: 250 }, // Bán kính GPS mặc định (m)
    // Ngày làm việc (Mon-Sat: công ty làm cả T7, nghỉ CN)
    working_days: {
      type: [String],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
    // Cài đặt thời gian hiển thị Thông báo & Kỷ niệm
    announcement_display_days: { type: Number, default: 7 }, // Mặc định 7 ngày
    anniversary_display_mode: {
      type: String,
      enum: ['month', 'week', 'days_around', 'exact_day'],
      default: 'month', // 'month': trong tháng, 'week': trong tuần, 'days_around': ±X ngày, 'exact_day': đúng ngày
    },
    anniversary_display_days: { type: Number, default: 7 }, // Số ngày hiển thị xung quanh ngày kỷ niệm
    holidays: [{ date: String, name: String }],               // Ngày lễ nghỉ
    makeup_days: [{ date: String, name: String }],            // Ngày làm bù
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
