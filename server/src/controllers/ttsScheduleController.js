const TtsWeeklySchedule = require('../models/TtsWeeklySchedule');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getActiveEmploymentFilter, isInactiveEmploymentStatus } = require('../utils/employmentStatus');

const DAY_MS = 86400000;

const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const getMonday = (value = new Date()) => {
  const base = value instanceof Date
    ? new Date(`${value.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}T12:00:00.000Z`)
    : parseDate(value);
  if (!base) return null;
  const day = base.getUTCDay() || 7;
  return addDays(base, 1 - day);
};

const buildWeekMeta = (weekStartValue) => {
  const monday = getMonday(weekStartValue);
  if (!monday || formatDate(monday) !== weekStartValue) return null;
  const saturday = addDays(monday, 5);
  const deadlineDate = formatDate(addDays(monday, -1));
  return {
    week_start: formatDate(monday),
    week_end: formatDate(saturday),
    registration_deadline: new Date(`${deadlineDate}T23:59:59.999+07:00`),
    allowed_dates: Array.from({ length: 6 }, (_, index) => formatDate(addDays(monday, index))),
  };
};

const isScheduleAdmin = user => Boolean(user && user.role === 'admin');
const canManageDuties = user => Boolean(isScheduleAdmin(user) || user?.can_manage_tts_schedule === true);

const sanitizeSlots = (slots, allowedDates) => {
  if (!Array.isArray(slots)) return [];
  const byDate = new Map();
  slots.forEach((slot) => {
    if (!slot || !allowedDates.includes(slot.date)) return;
    byDate.set(slot.date, {
      date: slot.date,
      morning: slot.morning === true,
      afternoon: slot.afternoon === true,
    });
  });
  return allowedDates.map(date => byDate.get(date) || { date, morning: false, afternoon: false });
};

const getOrCreateSchedule = async (meta, actorId) => {
  let schedule = await TtsWeeklySchedule.findOne({ week_start: meta.week_start });
  if (schedule) return schedule;
  try {
    schedule = await TtsWeeklySchedule.create({
      week_start: meta.week_start,
      week_end: meta.week_end,
      registration_deadline: meta.registration_deadline,
      updated_by: actorId || null,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    schedule = await TtsWeeklySchedule.findOne({ week_start: meta.week_start });
  }
  return schedule;
};

const populateSchedule = (query) => query
  .populate('registrations.user_id', 'full_name employee_code employee_type avatar_url position')
  .populate('registrations.adjusted_by', 'full_name')
  .populate('duties.office_cleaning_user_ids', 'full_name employee_code employee_type avatar_url')
  .populate('duties.restroom_cleaning_user_ids', 'full_name employee_code employee_type avatar_url')
  .populate('updated_by', 'full_name');

// GET /api/tts-schedules?week_start=YYYY-MM-DD
const getWeeklySchedule = async (req, res) => {
  try {
    const requested = req.query.week_start || formatDate(getMonday(new Date()));
    const meta = buildWeekMeta(requested);
    if (!meta) return res.status(400).json({ error: 'week_start phải là ngày Thứ 2 hợp lệ (YYYY-MM-DD).' });

    const [schedule, ttsCandidates, peopleCandidates] = await Promise.all([
      populateSchedule(TtsWeeklySchedule.findOne({ week_start: meta.week_start })),
      User.find(getActiveEmploymentFilter({ employee_type: 'TTS' }))
        .select('full_name employee_code employee_type avatar_url position employment_status email phone role department_id join_date is_attendance_exempt is_duty_exempt parking_location vehicle_info license_plate bank_name bank_account branch')
        .populate('department_id', 'name')
        .sort({ employee_code: 1, full_name: 1 }),
      User.find(getActiveEmploymentFilter())
        .select('full_name employee_code employee_type avatar_url position role can_manage_tts_schedule is_duty_exempt employment_status')
        .sort({ employee_code: 1, full_name: 1 }),
    ]);
    const ttsUsers = ttsCandidates
      .filter(user => !isInactiveEmploymentStatus(user.employment_status))
      .map((user) => {
        const profile = user.toObject();
        if (!isScheduleAdmin(req.user)) {
          delete profile.bank_name;
          delete profile.bank_account;
          delete profile.branch;
        }
        return profile;
      });
    const people = peopleCandidates.filter(user => !isInactiveEmploymentStatus(user.employment_status));

    const deadlinePassed = new Date() > meta.registration_deadline;
    res.json({
      schedule: schedule || {
        week_start: meta.week_start,
        week_end: meta.week_end,
        registration_deadline: meta.registration_deadline,
        status: 'open',
        registrations: [],
        duties: [],
        instructions: {
          before_work: 'Quét nhà\nDọn bàn chung\nDọn bàn máy in',
          during_day: 'Dọn, rửa và cất gọn đồ dùng sau khi sử dụng\nĐổ rác cuối ngày',
          weekly: 'Dọn nhà vệ sinh 1 tuần/lần, vào Thứ 7 hằng tuần',
        },
      },
      tts_users: ttsUsers,
      people,
      allowed_dates: meta.allowed_dates,
      is_registration_locked: Boolean(schedule?.status === 'locked' || deadlinePassed),
      can_manage: isScheduleAdmin(req.user),
      can_manage_duties: canManageDuties(req.user),
    });
  } catch (error) {
    console.error('GetWeeklySchedule error:', error);
    res.status(500).json({ error: 'Lỗi tải lịch tuần TTS.' });
  }
};

// PUT /api/tts-schedules/my-registration
const updateMyRegistration = async (req, res) => {
  const { week_start, slots, note = '' } = req.body;
  const meta = buildWeekMeta(week_start);
  if (!meta) return res.status(400).json({ error: 'Tuần đăng ký không hợp lệ.' });
  if (req.user.employee_type !== 'TTS') {
    return res.status(403).json({ error: 'Chỉ tài khoản Thực tập sinh mới được tự đăng ký lịch tuần.' });
  }
  if (new Date() > meta.registration_deadline) {
    return res.status(403).json({ error: 'Lịch tuần này đã hết hạn đăng ký. Vui lòng liên hệ người phụ trách.' });
  }
  try {
    const schedule = await getOrCreateSchedule(meta, req.user._id);
    if (schedule.status === 'locked') return res.status(403).json({ error: 'Lịch tuần này đã được khóa.' });
    const normalizedSlots = sanitizeSlots(slots, meta.allowed_dates);
    const index = schedule.registrations.findIndex(item => String(item.user_id) === String(req.user._id));
    const registration = {
      user_id: req.user._id,
      slots: normalizedSlots,
      note: String(note).trim().slice(0, 500),
      adjusted_by: null,
      adjusted_at: null,
      submitted_at: index >= 0 ? schedule.registrations[index].submitted_at : new Date(),
      updated_at: new Date(),
    };
    if (index >= 0) schedule.registrations[index] = registration;
    else schedule.registrations.push(registration);
    schedule.updated_by = req.user._id;
    await schedule.save();
    res.json({ message: 'Đã lưu lịch tuần của bạn.', registration });
  } catch (error) {
    console.error('UpdateMyRegistration error:', error);
    res.status(500).json({ error: 'Lỗi lưu lịch đăng ký.' });
  }
};

// PUT /api/tts-schedules/:weekStart/registration/:userId
const updateRegistrationByManager = async (req, res) => {
  if (!isScheduleAdmin(req.user)) return res.status(403).json({ error: 'Chỉ Admin được điều chỉnh lịch đăng ký của TTS.' });
  const meta = buildWeekMeta(req.params.weekStart);
  if (!meta) return res.status(400).json({ error: 'Tuần đăng ký không hợp lệ.' });
  try {
    const target = await User.findById(req.params.userId).select('full_name employee_type');
    if (!target || target.employee_type !== 'TTS') return res.status(404).json({ error: 'Không tìm thấy tài khoản TTS.' });
    const schedule = await getOrCreateSchedule(meta, req.user._id);
    const normalizedSlots = sanitizeSlots(req.body.slots, meta.allowed_dates);
    const index = schedule.registrations.findIndex(item => String(item.user_id) === String(target._id));
    const registration = {
      user_id: target._id,
      slots: normalizedSlots,
      note: String(req.body.note || '').trim().slice(0, 500),
      adjusted_by: req.user._id,
      adjusted_at: new Date(),
      submitted_at: index >= 0 ? schedule.registrations[index].submitted_at : new Date(),
      updated_at: new Date(),
    };
    if (index >= 0) schedule.registrations[index] = registration;
    else schedule.registrations.push(registration);
    schedule.updated_by = req.user._id;
    await schedule.save();
    await Notification.create({
      user_id: target._id,
      title: 'Lịch TTS đã được điều chỉnh',
      message: `${req.user.full_name} đã cập nhật lịch tuần ${meta.week_start} của bạn.`,
      type: 'system',
      link: '/tts-schedule',
    });
    res.json({ message: `Đã cập nhật lịch của ${target.full_name}.`, registration });
  } catch (error) {
    console.error('UpdateRegistrationByManager error:', error);
    res.status(500).json({ error: 'Lỗi điều chỉnh lịch TTS.' });
  }
};

// PUT /api/tts-schedules/:weekStart/duties
const updateDuties = async (req, res) => {
  if (!canManageDuties(req.user)) return res.status(403).json({ error: 'Bạn không có quyền phân công trực nhật.' });
  const meta = buildWeekMeta(req.params.weekStart);
  if (!meta) return res.status(400).json({ error: 'Tuần phân công không hợp lệ.' });
  try {
    const duties = Array.isArray(req.body.duties) ? req.body.duties : [];
    const normalized = meta.allowed_dates.map((date) => {
      const duty = duties.find(item => item?.date === date) || {};
      return {
        date,
        office_cleaning_user_ids: Array.isArray(duty.office_cleaning_user_ids) ? duty.office_cleaning_user_ids : [],
        restroom_cleaning_user_ids: Array.isArray(duty.restroom_cleaning_user_ids) ? duty.restroom_cleaning_user_ids : [],
        note: String(duty.note || '').trim().slice(0, 500),
      };
    });
    const schedule = await getOrCreateSchedule(meta, req.user._id);
    schedule.duties = normalized;
    schedule.updated_by = req.user._id;
    await schedule.save();

    const assignedIds = [...new Set(normalized.flatMap(d => [
      ...d.office_cleaning_user_ids.map(String),
      ...d.restroom_cleaning_user_ids.map(String),
    ]))];
    if (assignedIds.length) {
      await Notification.insertMany(assignedIds.map(userId => ({
        user_id: userId,
        title: 'Bạn có lịch trực nhật mới',
        message: `Lịch trực nhật tuần ${meta.week_start} vừa được ${req.user.full_name} cập nhật.`,
        type: 'system',
        link: '/tts-schedule',
      })));
    }
    res.json({ message: 'Đã lưu phân công trực nhật.', duties: normalized });
  } catch (error) {
    console.error('UpdateDuties error:', error);
    res.status(500).json({ error: 'Lỗi lưu phân công trực nhật.' });
  }
};

const updateInstructions = async (req, res) => {
  if (!isScheduleAdmin(req.user)) return res.status(403).json({ error: 'Chỉ Admin được sửa nội dung trực nhật.' });
  const meta = buildWeekMeta(req.params.weekStart);
  if (!meta) return res.status(400).json({ error: 'Tuần không hợp lệ.' });
  try {
    const schedule = await getOrCreateSchedule(meta, req.user._id);
    schedule.instructions = {
      before_work: String(req.body.before_work || '').slice(0, 2000),
      during_day: String(req.body.during_day || '').slice(0, 2000),
      weekly: String(req.body.weekly || '').slice(0, 2000),
    };
    schedule.updated_by = req.user._id;
    await schedule.save();
    res.json({ message: 'Đã cập nhật nội dung trực nhật.', instructions: schedule.instructions });
  } catch (error) {
    console.error('UpdateInstructions error:', error);
    res.status(500).json({ error: 'Lỗi lưu nội dung trực nhật.' });
  }
};

const toggleLock = async (req, res) => {
  if (!isScheduleAdmin(req.user)) return res.status(403).json({ error: 'Chỉ Admin được khóa hoặc mở lịch.' });
  const meta = buildWeekMeta(req.params.weekStart);
  if (!meta) return res.status(400).json({ error: 'Tuần không hợp lệ.' });
  try {
    const schedule = await getOrCreateSchedule(meta, req.user._id);
    schedule.status = req.body.locked === false ? 'open' : 'locked';
    schedule.updated_by = req.user._id;
    await schedule.save();
    res.json({ message: schedule.status === 'locked' ? 'Đã khóa lịch tuần.' : 'Đã mở lại lịch tuần.', status: schedule.status });
  } catch (error) {
    console.error('ToggleTtsScheduleLock error:', error);
    res.status(500).json({ error: 'Lỗi thay đổi trạng thái lịch.' });
  }
};

module.exports = {
  getWeeklySchedule,
  updateMyRegistration,
  updateRegistrationByManager,
  updateDuties,
  updateInstructions,
  toggleLock,
  __test: { buildWeekMeta, sanitizeSlots, isScheduleAdmin, canManageDuties, getMonday },
};
