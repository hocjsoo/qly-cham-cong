// models/SystemSetting.js - Cài đặt quy định giờ làm & cấu hình hệ thống
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    work_start_time: { type: String, default: '09:00' },       // Giờ vào chuẩn (09:00)
    work_end_time: { type: String, default: '18:00' },         // Giờ về chuẩn (18:00)
    lunch_break_start: { type: String, default: '12:00' },     // Giờ nghỉ trưa
    lunch_break_end: { type: String, default: '13:00' },       // Giờ hết nghỉ trưa
    minor_late_mins: { type: Number, default: 10 },            // Muộn nhẹ (09:01–09:10)
    medium_late_mins: { type: Number, default: 30 },           // Muộn vừa (09:11–09:30)
    ot_start_time: { type: String, default: '18:00' },         // OT tính từ 18:00
    working_days: {
      type: [String],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
    holidays: [{ date: String, name: String }],               // Ngày lễ nghỉ
    makeup_days: [{ date: String, name: String }],            // Ngày làm bù
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
