const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  date: { type: String, required: true },
  morning: { type: Boolean, default: false },
  afternoon: { type: Boolean, default: false },
}, { _id: false });

const registrationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slots: { type: [slotSchema], default: [] },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  adjusted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adjusted_at: { type: Date, default: null },
  submitted_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false });

const dutySchema = new mongoose.Schema({
  date: { type: String, required: true },
  office_cleaning_user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  restroom_cleaning_user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  note: { type: String, trim: true, maxlength: 500, default: '' },
}, { _id: false });

const ttsWeeklyScheduleSchema = new mongoose.Schema({
  week_start: { type: String, required: true, unique: true, index: true },
  week_end: { type: String, required: true },
  registration_deadline: { type: Date, required: true },
  status: { type: String, enum: ['open', 'locked'], default: 'open' },
  registrations: { type: [registrationSchema], default: [] },
  duties: { type: [dutySchema], default: [] },
  instructions: {
    before_work: { type: String, default: 'Quét nhà\nDọn bàn chung\nDọn bàn máy in' },
    during_day: { type: String, default: 'Dọn, rửa và cất gọn đồ dùng sau khi sử dụng\nĐổ rác cuối ngày' },
    weekly: { type: String, default: 'Dọn nhà vệ sinh 1 tuần/lần, vào Thứ 7 hằng tuần' },
  },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('TtsWeeklySchedule', ttsWeeklyScheduleSchema);
