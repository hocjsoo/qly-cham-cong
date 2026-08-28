// controllers/systemSettingController.js - He thong cai dat
const SystemSetting = require('../models/SystemSetting');

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'global' });
    if (settings) return res.json(settings);

    const defaults = new SystemSetting({ key: 'global' }).toObject();
    delete defaults._id;
    return res.json(defaults);
  } catch (error) {
    console.error('GetSettings error:', error);
    res.status(500).json({ error: 'Loi lay cai dat he thong.' });
  }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne({ key: 'global' });
    if (!settings) settings = new SystemSetting({ key: 'global' });

    const fields = [
      'work_start_time', 'work_end_time', 'lunch_break_start', 'lunch_break_end',
      'minor_late_mins', 'medium_late_mins', 'ot_start_time', 'ot_mode',
      'working_days', 'holidays', 'makeup_days',
      'company_name', 'company_logo_url',
      'announcement_display_days', 'anniversary_display_mode', 'anniversary_display_days',
      'request_guidelines',
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === 'minor_late_mins' || field === 'medium_late_mins' || field === 'announcement_display_days' || field === 'anniversary_display_days') {
          settings[field] = Number(req.body[field]);
        } else {
          settings[field] = req.body[field];
        }
      }
    }

    await settings.save();
    res.json({ message: 'Da luu cau hinh he thong thanh cong!', settings });
  } catch (error) {
    console.error('UpdateSettings error:', error);
    res.status(500).json({ error: 'Loi cap nhat cai dat he thong.' });
  }
};

module.exports = { getSettings, updateSettings };
