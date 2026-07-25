// controllers/attendanceController.js - GPS bắt buộc, Geofencing, Device Fingerprint chống gian lận
const Attendance = require('../models/Attendance');
const OfficeLocation = require('../models/OfficeLocation');
const Project = require('../models/Project');
const SystemSetting = require('../models/SystemSetting');
const DeviceSession = require('../models/DeviceSession');

// Helper tính khoảng cách GPS (Haversine)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
};

// Phân loại 4 mức đi muộn theo quy định công ty (<=09:00 đúng giờ, 09:01-09:10 muộn nhẹ, 09:11-09:30 muộn, >09:30 muộn nhiều)
function calculateLateTier(checkInDate, workStartStr = '09:00') {
  const [targetH, targetM] = workStartStr.split(':').map(Number);
  const targetDate = new Date(checkInDate);
  targetDate.setHours(targetH, targetM, 0, 0);

  const diffMs = checkInDate - targetDate;
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins <= 0) {
    return { is_late: false, late_minutes: 0, late_tier: 'on_time', label: 'Đúng giờ (≤ 09:00)' };
  } else if (diffMins <= 10) {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_minor', label: 'Muộn nhẹ (09:01–09:10)' };
  } else if (diffMins <= 30) {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_medium', label: 'Muộn (09:11–09:30)' };
  } else {
    return { is_late: true, late_minutes: diffMins, late_tier: 'late_severe', label: 'Muộn nhiều (> 09:30)' };
  }
}

// POST /api/attendance/checkin
// GPS bắt buộc với MỌI loại check-in.
// - type=office: bắt buộc nằm trong bán kính geofence văn phòng
// - type=wfh/site/client: ghi nhận GPS nhưng cảnh báo nếu quá xa (> 50km), không block
const checkIn = async (req, res) => {
  const { lat, lng, type = 'office', project_id, note, device_fingerprint, device_name, screen_info } = req.body;
  const userId = req.user._id;

  // BẮT BUỘC GPS cho mọi loại
  if (!lat || !lng) {
    return res.status(400).json({
      error: 'GPS bắt buộc để chấm công. Vui lòng bật định vị thiết bị và thử lại.',
      gps_required: true,
    });
  }

  try {
    const settings = await SystemSetting.findOne({ key: 'global' }) || { work_start_time: '09:00' };
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // --- Device Fingerprint Validation ---
    let deviceWarning = null;
    if (device_fingerprint) {
      const userAgentStr = req.headers['user-agent'] || '';
      let session = await DeviceSession.findOne({ user_id: userId, device_fingerprint });
      if (session) {
        // Thiết bị đã biết — cập nhật last_used
        session.last_used_at = now;
        session.check_in_count += 1;
        await session.save();
      } else {
        // Thiết bị MỚI — kiểm tra số lượng
        const totalDevices = await DeviceSession.countDocuments({ user_id: userId });
        if (totalDevices >= 3) {
          deviceWarning = `Cảnh báo: Tài khoản đã đăng nhập trên ${totalDevices} thiết bị khác nhau. Quản trị viên đã được thông báo.`;
        }
        session = await DeviceSession.create({
          user_id: userId,
          device_fingerprint,
          device_name: device_name || 'Unknown',
          user_agent: userAgentStr,
          screen_info: screen_info || null,
          is_trusted: totalDevices < 2, // Auto-trust first 2 devices
          check_in_count: 1,
        });
        if (totalDevices >= 2) {
          deviceWarning = `⚠️ Phát hiện thiết bị mới (${device_name || 'Unknown'}). Thiết bị thứ ${totalDevices + 1} — cần Admin xác nhận.`;
        }
      }
    }

    // Kiểm tra khoảng cách với văn phòng (cho TẤT CẢ các loại)
    let officeLoc = null;
    let distanceMeters = null;
    let farWarning = null;

    officeLoc = await OfficeLocation.findOne({ is_active: true });
    if (officeLoc && officeLoc.lat && officeLoc.lng) {
      distanceMeters = Math.round(getDistanceMeters(
        parseFloat(lat), parseFloat(lng),
        officeLoc.lat, officeLoc.lng
      ));

      if (type === 'office') {
        // Văn phòng: BẮT BUỘC trong bán kính, không thì từ chối
        if (distanceMeters > officeLoc.radius_m) {
          return res.status(400).json({
            error: `Bạn đang cách văn phòng ${distanceMeters}m (bán kính cho phép: ${officeLoc.radius_m}m). Hãy chọn loại WFH hoặc Công tác nếu làm việc ngoài công ty.`,
            suggest_business_trip: true,
            distance_meters: distanceMeters,
            radius_m: officeLoc.radius_m,
            office_name: officeLoc.name,
          });
        }
      } else if (type !== 'wfh') {
        // Site/Client: cảnh báo nếu > 50km (bất thường)
        if (distanceMeters > 50000) {
          farWarning = `Vị trí hiện tại của bạn cách văn phòng ${Math.round(distanceMeters / 1000)}km — vui lòng xác nhận đúng dự án.`;
        }
      }
    }

    // Lấy thông tin dự án
    let projectName = null;
    if (['site', 'client'].includes(type) && project_id) {
      const proj = await Project.findById(project_id);
      if (proj) projectName = proj.name;
    }

    const lateInfo = calculateLateTier(now, settings.work_start_time);
    let attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
    const clientIP = getClientIP(req);
    const combinedNote = [
      note,
      distanceMeters !== null ? `Cách VP: ${distanceMeters}m` : null,
      `IP: ${clientIP}`,
    ].filter(Boolean).join(' | ');

    if (attendance) {
      attendance.check_in_time = now;
      attendance.check_in_lat = parseFloat(lat);
      attendance.check_in_lng = parseFloat(lng);
      attendance.check_in_type = type;
      attendance.project_id = project_id || null;
      attendance.project_name = projectName;
      attendance.is_late = lateInfo.is_late;
      attendance.late_minutes = lateInfo.late_minutes;
      attendance.late_tier = lateInfo.late_tier;
      attendance.check_in_note = combinedNote;
      await attendance.save();

      return res.json({
        message: `Đã cập nhật check-in hôm nay (${lateInfo.label})`,
        attendance,
        late_info: lateInfo,
        distance_meters: distanceMeters,
        far_warning: farWarning,
        device_warning: deviceWarning,
      });
    }

    attendance = await Attendance.create({
      user_id: userId,
      date: dateStr,
      check_in_time: now,
      check_in_lat: parseFloat(lat),
      check_in_lng: parseFloat(lng),
      check_in_type: type,
      project_id: project_id || null,
      project_name: projectName,
      check_in_note: combinedNote,
      is_late: lateInfo.is_late,
      late_minutes: lateInfo.late_minutes,
      late_tier: lateInfo.late_tier,
      status: lateInfo.is_late ? 'late' : 'present',
    });

    res.status(201).json({
      message: `Check-in thành công! ${lateInfo.label}`,
      attendance,
      late_info: lateInfo,
      distance_meters: distanceMeters,
      far_warning: farWarning,
      device_warning: deviceWarning,
    });

  } catch (error) {
    console.error('CheckIn error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi check-in.' });
  }
};

// POST /api/attendance/checkout
const checkOut = async (req, res) => {
  const { lat, lng, note } = req.body;
  const userId = req.user._id;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'GPS bắt buộc để check-out.', gps_required: true });
  }

  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    const attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
    if (!attendance || !attendance.check_in_time) {
      return res.status(400).json({ error: 'Bạn chưa check-in hôm nay.' });
    }

    const checkInTime = new Date(attendance.check_in_time);
    const diffMs = now - checkInTime;
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));

    // OT tính từ 18:00
    const otStart = new Date(now);
    otStart.setHours(18, 0, 0, 0);
    let otHours = 0;
    if (now > otStart) {
      const otMs = now - Math.max(checkInTime.getTime(), otStart.getTime());
      otHours = parseFloat((otMs / (1000 * 60 * 60)).toFixed(1));
    }

    // Kiểm tra khoảng cách VP khi Check-out
    let distanceMeters = null;
    let outsideOfficeRadius = false;
    const officeLoc = await OfficeLocation.findOne({ is_active: true });
    if (officeLoc && officeLoc.lat && officeLoc.lng) {
      distanceMeters = Math.round(getDistanceMeters(
        parseFloat(lat), parseFloat(lng),
        officeLoc.lat, officeLoc.lng
      ));
      if (distanceMeters > (officeLoc.radius_m || 100)) {
        outsideOfficeRadius = true;
      }
    }

    const clientIP = getClientIP(req);
    const combinedNote = [
      note,
      distanceMeters !== null ? `Cách VP: ${distanceMeters}m` : null,
      `IP: ${clientIP}`,
    ].filter(Boolean).join(' | ');

    attendance.check_out_time = now;
    attendance.check_out_lat = parseFloat(lat);
    attendance.check_out_lng = parseFloat(lng);
    attendance.check_out_note = combinedNote;
    attendance.total_hours = Math.max(0, totalHours);
    attendance.ot_hours = Math.max(0, otHours);
    await attendance.save();

    res.json({
      message: `Check-out thành công! Tổng ${totalHours}h (OT: ${otHours}h) ${outsideOfficeRadius ? '📍 (Check-out ngoài VP)' : '✅'}`,
      attendance,
      outside_office_radius: outsideOfficeRadius,
      distance_meters: distanceMeters,
      suggest_explanation: outsideOfficeRadius,
    });

  } catch (error) {
    console.error('CheckOut error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi check-out.' });
  }
};

// GET /api/attendance/today
const getTodayStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
    const officeLoc = await OfficeLocation.findOne({ is_active: true });
    res.json({ attendance, office: officeLoc ? { name: officeLoc.name, radius_m: officeLoc.radius_m, lat: officeLoc.lat, lng: officeLoc.lng } : null });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy trạng thái hôm nay.' });
  }
};

// GET /api/attendance/history?month=7&year=2026&user_id=...&mode=month|year
const getHistory = async (req, res) => {
  try {
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const mode = req.query.mode || 'month';
    let targetUserId = req.user._id;

    // Admin / Manager có thể xem lịch sử của bất kỳ nhân viên nào
    if (req.query.user_id && ['admin', 'manager'].includes(req.user.role)) {
      targetUserId = req.query.user_id;
    }

    if (mode === 'year') {
      // Trả về dữ liệu 12 tháng trong năm cho màn hình xem theo Năm
      const yearlyRecords = await Attendance.find({
        user_id: targetUserId,
        date: { $regex: `^${y}-` }
      });

      const monthsData = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthPrefix = `${y}-${String(monthNum).padStart(2, '0')}`;
        const monthRecs = yearlyRecords.filter(r => r.date.startsWith(monthPrefix));
        const presentDays = monthRecs.filter(r => !r.is_late).length;
        const lateDays = monthRecs.filter(r => r.is_late).length;
        const totalHours = parseFloat(monthRecs.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
        const otHours = parseFloat(monthRecs.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));
        return {
          month: monthNum,
          label: `Tháng ${monthNum}`,
          total_days: monthRecs.length,
          present_days: presentDays,
          late_days: lateDays,
          total_hours: totalHours,
          ot_hours: otHours,
        };
      });

      return res.json({ year: y, mode: 'year', months: monthsData });
    }

    // Default month mode
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const records = await Attendance.find({
      user_id: targetUserId,
      date: { $regex: `^${monthStr}` }
    }).sort({ date: -1 });

    const presentDays = records.filter(r => !r.is_late).length;
    const lateDays = records.filter(r => r.is_late).length;
    const totalHours = parseFloat(records.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
    const totalOt = parseFloat(records.reduce((s, r) => s + (r.ot_hours || 0), 0).toFixed(1));

    res.json({
      summary: { present_days: presentDays, late_days: lateDays, total_hours: totalHours, total_ot_hours: totalOt, total_days: records.length },
      records,
    });
  } catch (error) {
    console.error('GetHistory error:', error);
    res.status(500).json({ error: 'Lỗi lấy lịch sử.' });
  }
};

// GET /api/attendance/record?user_id=...&date=YYYY-MM-DD
const getRecordByUserAndDate = async (req, res) => {
  const { user_id, date } = req.query;
  try {
    const attendance = await Attendance.findOne({ user_id, date }).populate('user_id', 'full_name email');
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tìm bản ghi chấm công.' });
  }
};

// PUT /api/attendance/override/:id - Admin/Manager sửa hoặc tạo mới bản ghi chấm công
const overrideAttendance = async (req, res) => {
  const { id } = req.params;
  const { user_id, date, check_in_time, check_out_time, check_in_type = 'office', is_late, notes, status } = req.body;
  try {
    let attendance = null;
    if (id !== 'new') {
      attendance = await Attendance.findById(id);
    } else if (user_id && date) {
      attendance = await Attendance.findOne({ user_id, date });
    }

    const settings = await SystemSetting.findOne({ key: 'global' }) || { work_start_time: '09:00' };

    if (!attendance) {
      if (!user_id || !date) {
        return res.status(400).json({ error: 'Cần truyền user_id và date để tạo bản ghi mới.' });
      }
      attendance = new Attendance({
        user_id,
        date,
        check_in_type,
      });
    }

    if (check_in_time) {
      attendance.check_in_time = new Date(check_in_time);
      const lateInfo = calculateLateTier(attendance.check_in_time, settings.work_start_time);
      if (is_late !== undefined) {
        attendance.is_late = Boolean(is_late);
      } else {
        attendance.is_late = lateInfo.is_late;
      }
      attendance.late_minutes = lateInfo.late_minutes;
      attendance.late_tier = lateInfo.late_tier;
    } else if (is_late !== undefined) {
      attendance.is_late = Boolean(is_late);
    }

    if (check_out_time) attendance.check_out_time = new Date(check_out_time);
    if (check_in_type) attendance.check_in_type = check_in_type;
    if (notes) attendance.notes = notes;
    if (status) attendance.status = status;

    if (attendance.check_in_time && attendance.check_out_time) {
      const diffMs = new Date(attendance.check_out_time) - new Date(attendance.check_in_time);
      const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));
      attendance.total_hours = Math.max(0, totalHours);

      // OT tính từ 18:00
      const otStart = new Date(attendance.check_out_time);
      otStart.setHours(18, 0, 0, 0);
      if (attendance.check_out_time > otStart) {
        const otMs = attendance.check_out_time - Math.max(attendance.check_in_time.getTime(), otStart.getTime());
        attendance.ot_hours = parseFloat((otMs / (1000 * 60 * 60)).toFixed(1));
      } else {
        attendance.ot_hours = 0;
      }
    }

    await attendance.save();
    res.json({ message: 'Đã cập nhật bản ghi chấm công thành công! ✅', attendance });
  } catch (error) {
    console.error('OverrideAttendance error:', error);
    res.status(500).json({ error: 'Lỗi sửa bản ghi chấm công.' });
  }
};

module.exports = { checkIn, checkOut, getTodayStatus, getHistory, getRecordByUserAndDate, overrideAttendance };
