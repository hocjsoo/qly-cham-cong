// models/TtsSchedule.js - Model Lịch Đăng Ký Tuần Của Thực Tập Sinh (TTS) & Phân Công Trực Nhật
const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  t2_morning: { type: Boolean, default: false },
  t2_afternoon: { type: Boolean, default: false },
  t3_morning: { type: Boolean, default: false },
  t3_afternoon: { type: Boolean, default: false },
  t4_morning: { type: Boolean, default: false },
  t4_afternoon: { type: Boolean, default: false },
  t5_morning: { type: Boolean, default: false },
  t5_afternoon: { type: Boolean, default: false },
  t6_morning: { type: Boolean, default: false },
  t6_afternoon: { type: Boolean, default: false },
  t7_morning: { type: Boolean, default: false },
  t7_afternoon: { type: Boolean, default: false },
}, { _id: false });

const RegistrationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  full_name: { type: String, required: true },
  phone: { type: String, default: '' },
  bank_account: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  position: { type: String, default: 'Thực tập sinh' },
  shifts: { type: ShiftSchema, default: () => ({}) },
  note: { type: String, default: '' },
  registered_at: { type: Date, default: Date.now },
}, { _id: true });

const DailyDutySchema = new mongoose.Schema({
  office_cleaning: { type: String, default: '' },
  toilet_cleaning: { type: String, default: '' },
}, { _id: false });

const TtsScheduleSchema = new mongoose.Schema({
  week_number: { type: Number, required: true },
  year: { type: Number, required: true },
  start_date: { type: String, required: true }, // YYYY-MM-DD (Thứ 2)
  end_date: { type: String, required: true },   // YYYY-MM-DD (Chủ nhật hoặc Thứ 7)
  registrations: [RegistrationSchema],
  duty_roster: {
    t2: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
    t3: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
    t4: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
    t5: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
    t6: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
    t7: { type: DailyDutySchema, default: () => ({ office_cleaning: '', toilet_cleaning: '' }) },
  },
  duty_rules: {
    type: [String],
    default: [
      '* Trước giờ làm: 1. Quét nhà | 2. Dọn bàn chung | 3. Dọn bàn Máy in',
      '* Giữa và cuối ngày: 1. Đồ dùng chung/ đồ dùng cá nhân -> dọn, rửa và cất gọn sau khi dùng | 2. Đổ rác cuối ngày',
      '* Lịch dọn nhà vệ sinh 1 tuần/ lần, vào thứ 7 hàng tuần',
      '* SÁNG: 9H-12H30 | CHIỀU: 14H-18H30'
    ]
  },
  note: { type: String, default: '' },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

TtsScheduleSchema.index({ week_number: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('TtsSchedule', TtsScheduleSchema);
