// controllers/systemSettingController.js - He thong cai dat
const SystemSetting = require('../models/SystemSetting');

const normalizeRequestGuidelines = (guidelines) => {
  if (!guidelines || typeof guidelines !== 'object') return guidelines;
  const migrated = { ...guidelines };
  if (migrated.late && typeof migrated.late === 'object' && typeof migrated.late.desc === 'string' && migrated.late.desc.includes('08:30')) {
    migrated.late = { ...migrated.late, desc: migrated.late.desc.replace(/08:30/g, '09:00') };
  }
  if (migrated.early_leave && typeof migrated.early_leave === 'object' && typeof migrated.early_leave.desc === 'string' && migrated.early_leave.desc.includes('17:30')) {
    migrated.early_leave = { ...migrated.early_leave, desc: migrated.early_leave.desc.replace(/17:30/g, '18:30') };
  }
  return migrated;
};

// GET /api/settings - Read-only public settings
const getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findOne({ key: 'global' });
    if (settings) {
      const settingsObj = settings.toObject ? settings.toObject() : { ...settings };
      if (settingsObj.request_guidelines) {
        settingsObj.request_guidelines = normalizeRequestGuidelines(settingsObj.request_guidelines);
      }
      return res.json(settingsObj);
    }

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
      'company_name', 'company_logo_url', 'company_address', 'email_footer_note',
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
