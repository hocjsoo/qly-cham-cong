// controllers/ttsScheduleController.js - CRUD Lịch Hàng Tuần TTS & Phân Công Trực Nhật
const TtsSchedule = require('../models/TtsSchedule');
const User = require('../models/User');

// Helper: Lấy thông tin tuần (Thứ 2 đầu tuần và Chủ nhật cuối tuần)
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Tính số tuần trong năm ISO-8601
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);

  return {
    week_number: weekNumber,
    year: monday.getFullYear(),
    start_date: monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
    end_date: sunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  };
}

// GET /api/tts-schedules?week_number=...&year=...
const getWeeklySchedule = async (req, res) => {
  try {
    let { week_number, year } = req.query;
    const currentInfo = getWeekRange(new Date());

    week_number = week_number ? parseInt(week_number, 10) : currentInfo.week_number;
    year = year ? parseInt(year, 10) : currentInfo.year;

    let schedule = await TtsSchedule.findOne({ week_number, year })
      .populate('registrations.user_id', 'full_name phone email bank_account bank_name position avatar_url employee_code')
      .populate('updated_by', 'full_name');

    // Tự động dọn dẹp nếu bản ghi trong DB còn vướng dữ liệu mẫu thử nghiệm cũ
    if (schedule) {
      let changed = false;
      const hasDummyNames = schedule.registrations?.some(r => 
        ['tiến', 'sơn', 'hoàng'].includes(r.full_name?.trim().toLowerCase()) && (!r.user_id)
      );
      const hasDummyDuty = schedule.duty_roster?.t2?.office_cleaning === 'My, Ly' || schedule.duty_roster?.t3?.office_cleaning === 'Ninh';

      if (hasDummyNames) {
        schedule.registrations = schedule.registrations.filter(r => 
          !['tiến', 'sơn', 'hoàng'].includes(r.full_name?.trim().toLowerCase()) || r.user_id
        );
        changed = true;
      }
      if (hasDummyDuty) {
        schedule.duty_roster = {
          t2: { office_cleaning: '', toilet_cleaning: '' },
          t3: { office_cleaning: '', toilet_cleaning: '' },
          t4: { office_cleaning: '', toilet_cleaning: '' },
          t5: { office_cleaning: '', toilet_cleaning: '' },
          t6: { office_cleaning: '', toilet_cleaning: '' },
          t7: { office_cleaning: '', toilet_cleaning: '' },
        };
        changed = true;
      }
      if (changed) {
        await schedule.save();
      }
    }

    // Nếu tuần này chưa có bản ghi, tự động khởi tạo bảng trống
    if (!schedule) {
      // Tính start_date và end_date cho tuần được chọn
      const jan4 = new Date(year, 0, 4);
      const jan4Day = (jan4.getDay() + 6) % 7;
      const targetMonday = new Date(jan4.getTime() + ((week_number - 1) * 7 - jan4Day) * 86400000);
      const targetSunday = new Date(targetMonday.getTime() + 6 * 86400000);

      const emptyDutyRoster = {
        t2: { office_cleaning: '', toilet_cleaning: '' },
        t3: { office_cleaning: '', toilet_cleaning: '' },
        t4: { office_cleaning: '', toilet_cleaning: '' },
        t5: { office_cleaning: '', toilet_cleaning: '' },
        t6: { office_cleaning: '', toilet_cleaning: '' },
        t7: { office_cleaning: '', toilet_cleaning: '' },
      };

      schedule = await TtsSchedule.create({
        week_number,
        year,
        start_date: targetMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        end_date: targetSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        registrations: [],
        duty_roster: emptyDutyRoster,
      });

      schedule = await TtsSchedule.findById(schedule._id)
        .populate('registrations.user_id', 'full_name phone email bank_account bank_name position avatar_url employee_code');
    }

    // Danh sách toàn bộ nhân sự công ty phục vụ chọn gán trực nhật hoặc thêm TTS
    const allStaff = await User.find({ is_active: { $ne: false } })
      .select('full_name phone bank_account bank_name position employee_code avatar_url role')
      .sort({ full_name: 1 });

    res.json({
      schedule,
      all_staff: allStaff,
      current_week: currentInfo.week_number,
      current_year: currentInfo.year
    });
  } catch (error) {
    console.error('GetWeeklySchedule error:', error);
    res.status(500).json({ error: 'Lỗi lấy lịch tuần thực tập sinh.' });
  }
};

// POST /api/tts-schedules/register - Đăng ký / cập nhật ca làm việc của TTS
const registerSchedule = async (req, res) => {
  try {
    const { week_number, year, user_id, full_name, phone, bank_account, bank_name, shifts, note } = req.body;

    if (!week_number || !year) {
      return res.status(400).json({ error: 'Thiếu thông tin tuần và năm.' });
    }

    const currentInfo = getWeekRange(new Date());
    let schedule = await TtsSchedule.findOne({ week_number, year });

    if (!schedule) {
      const jan4 = new Date(year, 0, 4);
      const jan4Day = (jan4.getDay() + 6) % 7;
      const targetMonday = new Date(jan4.getTime() + ((week_number - 1) * 7 - jan4Day) * 86400000);
      const targetSunday = new Date(targetMonday.getTime() + 6 * 86400000);

      schedule = new TtsSchedule({
        week_number,
        year,
        start_date: targetMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        end_date: targetSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
        registrations: []
      });
    }

    // Xác định đối tượng TTS đăng ký
    const targetUserId = user_id || req.user._id;
    const targetName = full_name || req.user.full_name;

    const existingIdx = schedule.registrations.findIndex(r =>
      (r.user_id && String(r.user_id) === String(targetUserId)) ||
      (r.full_name && r.full_name.trim().toLowerCase() === targetName.trim().toLowerCase())
    );

    if (existingIdx >= 0) {
      // Cập nhật ca đã có
      schedule.registrations[existingIdx].shifts = {
        ...schedule.registrations[existingIdx].shifts,
        ...shifts
      };
      if (phone) schedule.registrations[existingIdx].phone = phone;
      if (bank_account) schedule.registrations[existingIdx].bank_account = bank_account;
      if (bank_name) schedule.registrations[existingIdx].bank_name = bank_name;
      if (note !== undefined) schedule.registrations[existingIdx].note = note;
      schedule.registrations[existingIdx].registered_at = new Date();
    } else {
      // Thêm mới vào danh sách tuần
      schedule.registrations.push({
        user_id: targetUserId,
        full_name: targetName,
        phone: phone || req.user.phone || '',
        bank_account: bank_account || req.user.bank_account || '',
        bank_name: bank_name || req.user.bank_name || 'MB',
        position: req.user.position || 'Thực tập sinh',
        shifts: shifts || {},
        note: note || '',
        registered_at: new Date()
      });
    }

    schedule.updated_by = req.user._id;
    schedule.updated_at = new Date();
    await schedule.save();

    res.json({ message: 'Đã lưu lịch đăng ký tuần thành công! ✅', schedule });
  } catch (error) {
    console.error('RegisterSchedule error:', error);
    res.status(500).json({ error: 'Lỗi đăng ký lịch làm việc.' });
  }
};

// PUT /api/tts-schedules/duty-roster - Leader Ninh / Admin phân công trực nhật
const updateDutyRoster = async (req, res) => {
  try {
    const { week_number, year, duty_roster, duty_rules } = req.body;

    if (!week_number || !year) {
      return res.status(400).json({ error: 'Thiếu thông tin tuần và năm.' });
    }

    let schedule = await TtsSchedule.findOne({ week_number, year });

    if (!schedule) {
      return res.status(404).json({ error: 'Chưa tìm thấy lịch tuần để phân công trực nhật.' });
    }

    if (duty_roster) {
      schedule.duty_roster = duty_roster;
    }
    if (duty_rules && Array.isArray(duty_rules)) {
      schedule.duty_rules = duty_rules;
    }

    schedule.updated_by = req.user._id;
    schedule.updated_at = new Date();
    await schedule.save();

    res.json({ message: 'Đã cập nhật phân công trực nhật thành công! 🧹', schedule });
  } catch (error) {
    console.error('UpdateDutyRoster error:', error);
    res.status(500).json({ error: 'Lỗi phân công trực nhật.' });
  }
};

// POST /api/tts-schedules/add-intern - Thêm TTS vào bảng tuần
const addInternToSchedule = async (req, res) => {
  try {
    const { week_number, year, user_id, full_name, phone, bank_account, bank_name } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên Thực tập sinh.' });
    }

    let schedule = await TtsSchedule.findOne({ week_number, year });
    if (!schedule) {
      return res.status(404).json({ error: 'Lịch tuần chưa khởi tạo.' });
    }

    // Kiểm tra trùng
    const exists = schedule.registrations.some(r =>
      (user_id && r.user_id && String(r.user_id) === String(user_id)) ||
      (r.full_name && r.full_name.trim().toLowerCase() === full_name.trim().toLowerCase())
    );

    if (exists) {
      return res.status(400).json({ error: 'Thực tập sinh này đã có trong bảng lịch tuần.' });
    }

    schedule.registrations.push({
      user_id: user_id || null,
      full_name: full_name.trim(),
      phone: phone || '',
      bank_account: bank_account || '',
      bank_name: bank_name || 'MB',
      position: 'Thực tập sinh',
      shifts: {}
    });

    schedule.updated_by = req.user._id;
    await schedule.save();

    res.status(201).json({ message: 'Đã thêm Thực tập sinh vào bảng tuần ✅', schedule });
  } catch (error) {
    console.error('AddInternToSchedule error:', error);
    res.status(500).json({ error: 'Lỗi thêm Thực tập sinh.' });
  }
};

// DELETE /api/tts-schedules/registration/:regId - Xóa TTS khỏi bảng tuần
const removeInternFromSchedule = async (req, res) => {
  try {
    const { regId } = req.params;
    const { week_number, year } = req.query;

    let schedule = await TtsSchedule.findOne({ week_number, year });
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch tuần.' });
    }

    schedule.registrations = schedule.registrations.filter(r => String(r._id) !== String(regId));
    schedule.updated_by = req.user._id;
    await schedule.save();

    res.json({ message: 'Đã xóa Thực tập sinh khỏi bảng tuần ✅', schedule });
  } catch (error) {
    console.error('RemoveInternFromSchedule error:', error);
    res.status(500).json({ error: 'Lỗi xóa Thực tập sinh.' });
  }
};

// POST /api/tts-schedules/reset-week - Xóa trắng toàn bộ dữ liệu tuần (Admin / Leader)
const resetWeeklySchedule = async (req, res) => {
  try {
    const { week_number, year } = req.body;
    if (!week_number || !year) {
      return res.status(400).json({ error: 'Thiếu thông tin tuần và năm.' });
    }

    let schedule = await TtsSchedule.findOne({ week_number, year });
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch tuần.' });
    }

    schedule.registrations = [];
    schedule.duty_roster = {
      t2: { office_cleaning: '', toilet_cleaning: '' },
      t3: { office_cleaning: '', toilet_cleaning: '' },
      t4: { office_cleaning: '', toilet_cleaning: '' },
      t5: { office_cleaning: '', toilet_cleaning: '' },
      t6: { office_cleaning: '', toilet_cleaning: '' },
      t7: { office_cleaning: '', toilet_cleaning: '' },
    };
    schedule.updated_by = req.user._id;
    schedule.updated_at = new Date();
    await schedule.save();

    res.json({ message: 'Đã xóa trắng dữ liệu tuần này thành công! 🧹', schedule });
  } catch (error) {
    console.error('ResetWeeklySchedule error:', error);
    res.status(500).json({ error: 'Lỗi làm mới tuần.' });
  }
};

module.exports = {
  getWeeklySchedule,
  registerSchedule,
  updateDutyRoster,
  addInternToSchedule,
  removeInternFromSchedule,
  resetWeeklySchedule,
};
