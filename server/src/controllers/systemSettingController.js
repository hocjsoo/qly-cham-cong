// controllers/systemSettingController.js
const SystemSetting = require('../models/SystemSetting');

// GET /api/settings - Lấy cài đặt hệ thống
const getSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({ key: 'global' });
    if (!settings) {
      settings = await SystemSetting.create({ key: 'global' });
    }
    res.json(settings);
  } catch (error) {
    console.error('GetSettings error:', error);
    res.status(500).json({ error: 'Lỗi lấy cài đặt hệ thống.' });
  }
};

// PUT /api/settings - Cập nhật cài đặt hệ thống (Admin only)
const updateSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({ key: 'global' });
    if (!settings) {
      settings = new SystemSetting({ key: 'global' });
    }

    const {
      work_start_time, work_end_time, lunch_break_start, lunch_break_end,
      minor_late_mins, medium_late_mins, ot_start_time, working_days, holidays, makeup_days
    } = req.body;

    if (work_start_time) settings.work_start_time = work_start_time;
    if (work_end_time) settings.work_end_time = work_end_time;
    if (lunch_break_start) settings.lunch_break_start = lunch_break_start;
    if (lunch_break_end) settings.lunch_break_end = lunch_break_end;
    if (minor_late_mins !== undefined) settings.minor_late_mins = Number(minor_late_mins);
    if (medium_late_mins !== undefined) settings.medium_late_mins = Number(medium_late_mins);
    if (ot_start_time) settings.ot_start_time = ot_start_time;
    if (working_days) settings.working_days = working_days;
    if (holidays) settings.holidays = holidays;
    if (makeup_days) settings.makeup_days = makeup_days;

    await settings.save();
    res.json({ message: 'Đã lưu cấu hình hệ thống thành công! ✅', settings });
  } catch (error) {
    console.error('UpdateSettings error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật cài đặt hệ thống.' });
  }
};

module.exports = { getSettings, updateSettings };
