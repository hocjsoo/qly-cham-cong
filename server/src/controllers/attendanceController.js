const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const OfficeLocation = require('../models/OfficeLocation');
const Project = require('../models/Project');
const SystemSetting = require('../models/SystemSetting');
const DeviceSession = require('../models/DeviceSession');
const DeviceRegistry = require('../models/DeviceRegistry');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const TimesheetLock = require('../models/TimesheetLock');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const {
  calculateRawTotalHours,
  calculateOT,
  calculateAttendanceMetrics,
  normalizeHolidayMultiplier,
} = require('../utils/attendanceCalculations');
const {
  isLeaderRole,
  buildLeaderUserScope,
  canManageUserId,
} = require('../utils/roleScope');

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

// Phân loại mức đi muộn theo quy định công ty chuẩn múi giờ +07:00 (Ca 09:00 - 18:30)
function calculateLateTier(checkInDate, workStartStr = '09:00', minorMins = 30, mediumMins = 60) {
  if (!checkInDate) {
    return {
      is_late: false,
      late_minutes: 0,
      late_tier: 'on_time',
      label: 'Chưa check-in',
      work_units: 0,
      credit_symbol: ''
    };
  }

  const checkIn = new Date(checkInDate);
  if (isNaN(checkIn.getTime())) {
    return {
      is_late: false,
      late_minutes: 0,
      late_tier: 'on_time',
      label: 'Thời gian không hợp lệ',
      work_units: 0,
      credit_symbol: ''
    };
  }

  const dateStr = checkIn.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const timePart = (workStartStr && typeof workStartStr === 'string' && workStartStr.includes(':')) ? workStartStr.trim() : '09:00';
  const [startH, startM] = timePart.split(':').map(s => String(s).padStart(2, '0'));

  // Mốc bắt đầu ca làm việc chuẩn theo múi giờ Việt Nam +07:00
  const targetDate = new Date(`${dateStr}T${startH}:${startM}:00+07:00`);

  const diffMs = checkIn.getTime() - targetDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  // Mốc cutoff giảm công ĐỘC LẬP cố định 09:30:00 (chuẩn múi giờ VN +07:00)
  // Tuyệt đối không phụ thuộc vào minor_late_mins cảnh báo cũ (vốn có thể là 10p trong seed hoặc DB cũ)
  const cutoff0930Ms = new Date(`${dateStr}T09:30:00+07:00`).getTime();

  // Tier cảnh báo muộn nhẹ / muộn vừa (phục vụ hiển thị nhãn)
  const minorMinutesNum = Number(minorMins ?? 30);
  const mediumMinutesNum = Number(mediumMins ?? 60);

  if (diffMs <= 0) {
    return {
      is_late: false,
      late_minutes: 0,
      late_tier: 'on_time',
      label: `Đúng giờ (≤ ${timePart})`,
      work_units: 1.0,
      credit_symbol: 'x'
    };
  } else if (checkIn.getTime() <= cutoff0930Ms) {
    // Check-in từ sau giờ ca (09:00:01) đến đúng 09:30:00: VẪN TÍNH 1 CÔNG (x), hiển thị cảnh báo muộn (+diffMins phút)
    return {
      is_late: true,
      late_minutes: diffMins,
      late_tier: diffMins <= minorMinutesNum ? 'late_minor' : 'late_medium',
      label: `Muộn nhẹ (+${diffMins}p)`,
      work_units: 1.0,
      credit_symbol: 'x'
    };
  } else {
    // Check-in sau 09:30:00 (từ 09:30:01 trở đi): Tự động tính 0.75 công (0,75x), ghi nhận chính xác số phút đi muộn
    return {
      is_late: true,
      late_minutes: diffMins,
      late_tier: diffMins <= mediumMinutesNum ? 'late_medium' : 'late_severe',
      label: `Muộn trừ công (+${diffMins}p - 0.75 công)`,
      work_units: 0.75,
      credit_symbol: '0,75x'
    };
  }
}

// POST /api/attendance/checkin
const checkIn = async (req, res) => {
  const {
    lat, lng, type = 'office', project_id, note,
    device_fingerprint, hardware_uuid, device_name, screen_info,
    selfie_url, step_up_confirmed
  } = req.body;
  const userId = req.user._id;

  if (
    lat === null || lat === undefined || (typeof lat === 'string' && lat.trim() === '') ||
    lng === null || lng === undefined || (typeof lng === 'string' && lng.trim() === '')
  ) {
    return res.status(400).json({
      error: 'GPS bắt buộc và phải là tọa độ hợp lệ để chấm công. Vui lòng bật quyền định vị trên thiết bị.',
      gps_required: true,
    });
  }

  const userLat = Number(lat);
  const userLng = Number(lng);

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng) || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
    return res.status(400).json({
      error: 'GPS bắt buộc và phải là tọa độ hợp lệ để chấm công. Vui lòng bật quyền định vị trên thiết bị.',
      gps_required: true,
    });
  }

  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [dYear, dMonth] = dateStr.split('-').map(Number);

    let settingsQuery = SystemSetting.findOne({ key: 'global' });
    if (settingsQuery && typeof settingsQuery.select === 'function') {
      settingsQuery = settingsQuery.select('work_start_time minor_late_mins medium_late_mins default_gps_radius_meters');
    }
    if (settingsQuery && typeof settingsQuery.lean === 'function') settingsQuery = settingsQuery.lean();

    let holidayQuery = Holiday.findOne({
      $or: [
        { date: dateStr },
        { date: { $lte: dateStr }, end_date: { $gte: dateStr } },
      ],
    });
    if (holidayQuery && typeof holidayQuery.select === 'function') {
      holidayQuery = holidayQuery.select('date end_date work_multiplier');
    }
    if (holidayQuery && typeof holidayQuery.lean === 'function') holidayQuery = holidayQuery.lean();

    let lockQuery = TimesheetLock.findOne({
      month: dMonth,
      year: dYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id: userId }]
    });
    if (lockQuery && typeof lockQuery.select === 'function') lockQuery = lockQuery.select('user_id');
    if (lockQuery && typeof lockQuery.lean === 'function') lockQuery = lockQuery.lean();

    // Ba truy vấn độc lập chạy song song để giảm một vòng chờ database khi check-in.
    const [settingsResult, activeHoliday, activeLock] = await Promise.all([
      settingsQuery,
      holidayQuery,
      lockQuery,
    ]);
    const settings = settingsResult || {
      work_start_time: '09:00',
      minor_late_mins: 30,
      medium_late_mins: 60,
    };

    // Kiểm tra bảng công tháng/nhân viên có bị chốt khóa hay không (bảo vệ tính bất biến)
    if (activeLock) {
      return res.status(403).json({
        error: activeLock.user_id === null
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể thực hiện chấm công.`
          : `Bảng công của bạn trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể thực hiện chấm công.`
      });
    }

    const clientIP = getClientIP(req);
    const rawHardwareUuid = hardware_uuid || device_fingerprint;
    const effectiveHardwareUuid = typeof rawHardwareUuid === 'string' && rawHardwareUuid.trim()
      ? rawHardwareUuid.trim()
      : null;

    let isFlagged = false;
    const flagReasons = [];

    // --- Chống gian lận: Kiểm tra thiết bị trùng trong ngày ---
    if (effectiveHardwareUuid) {
      let attendanceMatchQuery = Attendance.findOne({
        date: dateStr,
        hardware_uuid: effectiveHardwareUuid,
        user_id: { $ne: userId },
      });
      if (attendanceMatchQuery && typeof attendanceMatchQuery.select === 'function') {
        attendanceMatchQuery = attendanceMatchQuery.select('_id');
      }
      if (attendanceMatchQuery && typeof attendanceMatchQuery.lean === 'function') attendanceMatchQuery = attendanceMatchQuery.lean();

      // IP chỉ được lưu làm metadata audit; không bao giờ là tín hiệu đủ để kết luận trùng thiết bị.
      const attendanceMatch = await attendanceMatchQuery;

      if (attendanceMatch) {
        isFlagged = true;
        flagReasons.push('MULTI_ACCOUNT_SAME_DEVICE');

        if (!selfie_url && !step_up_confirmed) {
          return res.status(400).json({
            error: '🚨 Thiết bị này đã được dùng cho tài khoản khác trong ngày. Vui lòng chụp ảnh khuôn mặt xác thực để tiếp tục.',
            step_up_required: true,
            reason: 'MULTI_ACCOUNT_SAME_DEVICE',
          });
        }
      }

      await DeviceRegistry.findOneAndUpdate(
        { hardware_uuid: effectiveHardwareUuid, user_id: userId, date: dateStr },
        {
          device_name: device_name || 'Unknown',
          user_agent: req.headers['user-agent'] || '',
          screen_resolution: screen_info || null,
          client_ip: clientIP,
          check_in_time: now,
        },
        { upsert: true, new: true }
      );
    }

    // --- Device Fingerprint Session Validation ---
    let deviceWarning = null;
    try {
      if (device_fingerprint) {
        const userAgentStr = req.headers['user-agent'] || '';
        let session = await DeviceSession.findOne({ user_id: userId, device_fingerprint });
        if (session) {
          session.last_used_at = now;
          session.check_in_count += 1;
          await session.save();

          if (!session.is_trusted) {
            deviceWarning = `⚠️ Thiết bị chưa duyệt (${session.device_name || 'Thiết bị lạ'}).`;
            isFlagged = true;
            if (!flagReasons.includes('UNTRUSTED_DEVICE')) {
              flagReasons.push('UNTRUSTED_DEVICE');
            }
          }
        } else {
          session = new DeviceSession({
            user_id: userId,
            device_fingerprint,
            device_name: device_name || 'Unknown',
            user_agent: userAgentStr,
            screen_info: screen_info || null,
            is_trusted: false,
            check_in_count: 1,
          });
          await session.save();
          deviceWarning = `⚠️ Thiết bị mới (${device_name || 'Unknown'}).`;
          isFlagged = true;
          if (!flagReasons.includes('NEW_DEVICE_DETECTED')) {
            flagReasons.push('NEW_DEVICE_DETECTED');
          }
        }
      }
    } catch (sessionErr) {
      console.warn('Device session non-critical warning:', sessionErr.message);
    }

    // Kiểm tra khoảng cách với các văn phòng
    let officeLoc = null;
    let distanceMeters = null;
    let farWarning = null;

    let activeOffices = await OfficeLocation.find({ is_active: { $ne: false } });
    if (!activeOffices || activeOffices.length === 0) {
      activeOffices = await OfficeLocation.find();
    }

    if (activeOffices.length > 0 && userLat !== null && userLng !== null) {
      let minDistance = Infinity;
      let closestOffice = null;

      for (const loc of activeOffices) {
        const locLat = parseFloat(loc.lat);
        const locLng = parseFloat(loc.lng);
        if (!isNaN(locLat) && !isNaN(locLng)) {
          const d = Math.round(getDistanceMeters(userLat, userLng, locLat, locLng));
          if (d < minDistance) {
            minDistance = d;
            closestOffice = loc;
          }
        }
      }

      if (closestOffice) {
        distanceMeters = minDistance;
        officeLoc = closestOffice;

        if (type === 'office') {
          const validOffice = activeOffices.find(loc => {
            const locLat = parseFloat(loc.lat);
            const locLng = parseFloat(loc.lng);
            if (isNaN(locLat) || isNaN(locLng)) return false;
            const d = Math.round(getDistanceMeters(userLat, userLng, locLat, locLng));
            const maxAllowedRadius = Math.max(loc.radius_m || 100, settings.default_gps_radius_meters || 250);
            return d <= maxAllowedRadius;
          });

          if (!validOffice) {
            const allowedR = Math.max(closestOffice.radius_m || 100, settings.default_gps_radius_meters || 250);
            if (selfie_url || step_up_confirmed) {
              isFlagged = true;
              if (!flagReasons.includes('GPS_OUTSIDE_GEOFENCE')) {
                flagReasons.push('GPS_OUTSIDE_GEOFENCE');
              }
            } else {
              return res.status(400).json({
                error: `Bạn đang cách địa điểm gần nhất [${closestOffice.name}] ${minDistance}m (bán kính cho phép: ${allowedR}m). Vui lòng chọn WFH, chụp ảnh selfie xác thực bổ sung hoặc di chuyển lại gần hơn.`,
                suggest_business_trip: true,
                suggest_selfie_supplement: true,
                suggest_photo_fallback: true,
                distance_meters: minDistance,
                radius_m: allowedR,
                office_name: closestOffice.name,
              });
            }
          } else {
            officeLoc = validOffice;
            const vLat = parseFloat(validOffice.lat);
            const vLng = parseFloat(validOffice.lng);
            distanceMeters = Math.round(getDistanceMeters(userLat, userLng, vLat, vLng));
          }
        } else if (type !== 'wfh') {
          if (minDistance > 50000) {
            farWarning = `Vị trí hiện tại cách địa điểm [${closestOffice.name}] ${Math.round(minDistance / 1000)}km.`;
          }
        }
      }
    }

    let projectName = null;
    let validProjectId = null;
    if (project_id && mongoose.Types.ObjectId.isValid(project_id)) {
      validProjectId = project_id;
      if (['site', 'client'].includes(type)) {
        const proj = await Project.findById(project_id);
        if (proj) projectName = proj.name;
      }
    }

    const validCheckInType = ['office', 'site', 'client', 'wfh'].includes(type) ? type : 'office';

    const lateInfo = calculateLateTier(
      now,
      settings.work_start_time || '09:00',
      settings.minor_late_mins ?? 30,
      settings.medium_late_mins ?? 60
    );

    let attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
    const combinedNote = [
      note,
      distanceMeters !== null ? `Cách VP: ${distanceMeters}m` : null,
      `IP: ${clientIP}`,
      selfie_url ? `📸 Kèm ảnh Selfie xác thực` : null,
      isFlagged ? `🚨 Cảnh báo: ${flagReasons.join(', ')}` : null,
    ].filter(Boolean).join(' | ');

    const checkInMode = selfie_url ? 'photo' : 'gps';
    const isExemptType = ['wfh', 'site', 'client'].includes(validCheckInType);
    const finalWorkUnits = activeHoliday
      ? normalizeHolidayMultiplier(activeHoliday.work_multiplier)
      : (isExemptType ? 1.0 : (lateInfo.work_units ?? 1.0));

    if (attendance) {
      attendance.check_in_time = now;
      if (userLat) attendance.check_in_lat = userLat;
      if (userLng) attendance.check_in_lng = userLng;
      attendance.check_in_type = validCheckInType;
      attendance.project_id = validProjectId;
      attendance.project_name = projectName;
      attendance.is_late = lateInfo.is_late;
      attendance.late_minutes = lateInfo.late_minutes;
      attendance.late_tier = lateInfo.late_tier;
      attendance.work_units = finalWorkUnits;
      attendance.check_in_mode = checkInMode;
      attendance.check_in_note = combinedNote;
      attendance.hardware_uuid = effectiveHardwareUuid || null;
      attendance.is_flagged = isFlagged;
      attendance.flag_reasons = flagReasons;
      if (selfie_url) attendance.selfie_url = selfie_url;
      attendance.verification_status = isFlagged ? 'pending_review' : 'auto_approved';
      await attendance.save();

      return res.json({
        message: isFlagged
          ? `Đã cập nhật check-in (Đang chờ Ban Giám Đốc xác nhận)`
          : `Đã cập nhật check-in hôm nay (${lateInfo.label})`,
        attendance,
        late_info: lateInfo,
        distance_meters: distanceMeters,
        far_warning: farWarning,
        device_warning: deviceWarning,
        is_flagged: isFlagged,
      });
    }

    try {
      attendance = await Attendance.create({
        user_id: userId,
        date: dateStr,
        check_in_time: now,
        check_in_lat: userLat,
        check_in_lng: userLng,
        check_in_type: validCheckInType,
        project_id: validProjectId,
        project_name: projectName,
        check_in_note: combinedNote,
        is_late: lateInfo.is_late,
        late_minutes: lateInfo.late_minutes,
        late_tier: lateInfo.late_tier,
        work_units: finalWorkUnits,
        check_in_mode: checkInMode,
        status: lateInfo.is_late ? 'late' : 'present',
        hardware_uuid: effectiveHardwareUuid || null,
        is_flagged: isFlagged,
        flag_reasons: flagReasons,
        selfie_url: selfie_url || null,
        verification_status: isFlagged ? 'pending_review' : 'auto_approved',
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        attendance = await Attendance.findOneAndUpdate(
          { user_id: userId, date: dateStr },
          {
            check_in_time: now,
            check_in_lat: userLat,
            check_in_lng: userLng,
            check_in_type: validCheckInType,
            project_id: validProjectId,
            project_name: projectName,
            check_in_note: combinedNote,
            is_late: lateInfo.is_late,
            late_minutes: lateInfo.late_minutes,
            late_tier: lateInfo.late_tier,
            work_units: finalWorkUnits,
            check_in_mode: checkInMode,
            hardware_uuid: effectiveHardwareUuid || null,
            is_flagged: isFlagged,
            flag_reasons: flagReasons,
            verification_status: isFlagged ? 'pending_review' : 'auto_approved',
          },
          { new: true }
        );
      } else {
        throw createErr;
      }
    }

    res.status(201).json({
      message: isFlagged
        ? `Check-in được ghi nhận! (Chờ Admin xác nhận do dùng chung thiết bị)`
        : `Check-in thành công! ${lateInfo.label}`,
      attendance,
      late_info: lateInfo,
      distance_meters: distanceMeters,
      far_warning: farWarning,
      device_warning: deviceWarning,
      is_flagged: isFlagged,
    });

  } catch (error) {
    console.error('CheckIn error details:', error);
    res.status(500).json({ error: `Lỗi máy chủ khi check-in: ${error.message || 'Lỗi không xác định'}` });
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

    // Kiểm tra bảng công tháng/nhân viên có bị chốt khóa hay không (bảo vệ tính bất biến)
    const [dYear, dMonth] = dateStr.split('-').map(Number);
    let lockQuery = TimesheetLock.findOne({
      month: dMonth,
      year: dYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id: userId }]
    });
    if (lockQuery && typeof lockQuery.select === 'function') lockQuery = lockQuery.select('user_id');
    if (lockQuery && typeof lockQuery.lean === 'function') lockQuery = lockQuery.lean();

    const attendanceQuery = Attendance.findOne({ user_id: userId, date: dateStr });
    let settingsQuery = SystemSetting.findOne({ key: 'global' });
    if (settingsQuery && typeof settingsQuery.select === 'function') {
      settingsQuery = settingsQuery.select('work_end_time ot_start_time');
    }
    if (settingsQuery && typeof settingsQuery.lean === 'function') settingsQuery = settingsQuery.lean();

    let holidayQuery = Holiday.findOne({
      $or: [
        { date: dateStr },
        { date: { $lte: dateStr }, end_date: { $gte: dateStr } },
      ],
    });
    if (holidayQuery && typeof holidayQuery.select === 'function') holidayQuery = holidayQuery.select('work_multiplier');
    if (holidayQuery && typeof holidayQuery.lean === 'function') holidayQuery = holidayQuery.lean();

    // Các truy vấn độc lập chạy song song để giảm độ trễ checkout.
    const [activeLock, attendance, settings, activeHoliday] = await Promise.all([
      lockQuery,
      attendanceQuery,
      settingsQuery,
      holidayQuery,
    ]);
    if (activeLock) {
      return res.status(403).json({
        error: activeLock.user_id === null
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể thực hiện check-out.`
          : `Bảng công của bạn trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể thực hiện check-out.`
      });
    }

    if (!attendance || !attendance.check_in_time) {
      return res.status(400).json({ error: 'Bạn chưa check-in hôm nay.' });
    }
    const workEndTime = settings?.work_end_time || '18:30';
    const otStartTime = settings?.ot_start_time || '18:30';

    const checkInTime = new Date(attendance.check_in_time);
    const metrics = calculateAttendanceMetrics(checkInTime, now, { workEndTime, otStartTime });
    const totalHours = metrics.totalHours;
    const otHours = metrics.otHours;

    // Kiểm tra khoảng cách với các văn phòng hoạt động khi Check-out
    let distanceMeters = null;
    let outsideOfficeRadius = false;
    let activeOffices = await OfficeLocation.find({ is_active: { $ne: false } });
    if (!activeOffices || activeOffices.length === 0) {
      activeOffices = await OfficeLocation.find();
    }

    if (activeOffices.length > 0) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        let minDistance = Infinity;
        let closestLoc = null;

        for (const loc of activeOffices) {
          const lLat = parseFloat(loc.lat);
          const lLng = parseFloat(loc.lng);
          if (!isNaN(lLat) && !isNaN(lLng)) {
            const d = Math.round(getDistanceMeters(userLat, userLng, lLat, lLng));
            if (d < minDistance) {
              minDistance = d;
              closestLoc = loc;
            }
          }
        }

        if (closestLoc) {
          distanceMeters = minDistance;
          const allowedR = Math.max(closestLoc.radius_m || 100, 250);
          if (minDistance > allowedR) {
            outsideOfficeRadius = true;
          }
        }
      }
    }

    const clientIP = getClientIP(req);
    const combinedNote = [
      note,
      distanceMeters !== null ? `Cách VP: ${distanceMeters}m` : null,
      `IP: ${clientIP}`,
    ].filter(Boolean).join(' | ');

    // Tính toán về sớm (Early Leave) so với giờ kết thúc ca làm việc
    const isEarlyLeave = metrics.isEarlyLeave;
    const earlyMinutes = metrics.earlyMinutes;

    attendance.check_out_time = now;
    attendance.check_out_lat = parseFloat(lat);
    attendance.check_out_lng = parseFloat(lng);
    attendance.check_out_note = combinedNote;
    attendance.total_hours = Math.max(0, totalHours);
    attendance.ot_hours = Math.max(0, otHours);
    if (activeHoliday) attendance.work_units = normalizeHolidayMultiplier(activeHoliday.work_multiplier);
    attendance.is_early_leave = isEarlyLeave;
    attendance.early_minutes = earlyMinutes;
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
    const activeOffices = await OfficeLocation.find({ is_active: true });
    res.json({
      attendance,
      offices: activeOffices.map(l => ({ _id: l._id, name: l.name, radius_m: l.radius_m, lat: l.lat, lng: l.lng })),
      office: activeOffices[0] ? { name: activeOffices[0].name, radius_m: activeOffices[0].radius_m, lat: activeOffices[0].lat, lng: activeOffices[0].lng } : null
    });
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

    let userQueryFilter = { user_id: req.user._id };
    const isLeaderOrAdmin = req.user.role === 'admin' || isLeaderRole(req.user);

    if (isLeaderOrAdmin) {
      if (req.query.user_id && req.query.user_id !== 'all') {
        if (isLeaderRole(req.user) && !(await canManageUserId(req.user, req.query.user_id, { allowSelf: true }))) {
          return res.status(403).json({ error: 'Bạn chỉ được xem lịch sử chấm công của nhân sự thuộc nhóm mình quản lý.' });
        }
        userQueryFilter = { user_id: req.query.user_id };
      } else {
        // Nếu là Leader / Manager và user_id là 'all' hoặc không truyền -> lấy toàn bộ nhân viên thuộc phòng ban
        if (isLeaderRole(req.user)) {
          const userIds = await User.find(
            buildLeaderUserScope(req.user, { includeSelf: true })
          ).distinct('_id');
          userQueryFilter = { user_id: { $in: userIds } };
        } else if (req.query.user_id === 'all') {
          // Admin xem tất cả nhân viên hệ thống
          userQueryFilter = {};
        }
      }
    }

    if (mode === 'year') {
      // Trả về dữ liệu 12 tháng trong năm cho màn hình xem theo Năm
      const yearlyRecords = await Attendance.find({
        ...userQueryFilter,
        date: { $regex: `^${y}-` }
      }).populate('user_id', 'full_name employee_code avatar_url email');

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
      ...userQueryFilter,
      date: { $regex: `^${monthStr}` }
    })
      .populate('user_id', 'full_name employee_code avatar_url email')
      .sort({ date: -1 });

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
    if (!date) {
      return res.status(400).json({ error: 'Ngày chấm công là bắt buộc.' });
    }

    const targetUserId = user_id || req.user._id;
    const isSelf = String(targetUserId) === String(req.user._id);
    if (!isSelf && req.user.role !== 'admin') {
      const canView = isLeaderRole(req.user) && await canManageUserId(req.user, targetUserId);
      if (!canView) {
        return res.status(403).json({ error: 'Bạn không có quyền xem bản ghi chấm công này.' });
      }
    }

    const attendance = await Attendance.findOne({ user_id: targetUserId, date }).populate('user_id', 'full_name email');
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tìm bản ghi chấm công.' });
  }
};

// PUT /api/attendance/override/:id - CHỈ ADMIN sửa hoặc tạo mới bản ghi chấm công
const overrideAttendance = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền điều chỉnh bản ghi chấm công.' });
  }
  const { id } = req.params;
  const { user_id, date, check_in_time, check_out_time, check_in_type = 'office', is_late, notes, status } = req.body;
  try {
    let attendance = null;
    if (id !== 'new') {
      attendance = await Attendance.findById(id);
    } else if (user_id && date) {
      attendance = await Attendance.findOne({ user_id, date });
    }

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

    const targetDate = date || attendance.date;

    let settingsQuery = SystemSetting.findOne({ key: 'global' });
    if (settingsQuery && typeof settingsQuery.select === 'function') {
      settingsQuery = settingsQuery.select('work_start_time work_end_time ot_start_time');
    }
    if (settingsQuery && typeof settingsQuery.lean === 'function') settingsQuery = settingsQuery.lean();

    let holidayQuery = Holiday.findOne({
      $or: [
        { date: targetDate },
        { date: { $lte: targetDate }, end_date: { $gte: targetDate } },
      ],
    });
    if (holidayQuery && typeof holidayQuery.select === 'function') holidayQuery = holidayQuery.select('work_multiplier');
    if (holidayQuery && typeof holidayQuery.lean === 'function') holidayQuery = holidayQuery.lean();

    const [settingsResult, activeHoliday] = await Promise.all([settingsQuery, holidayQuery]);
    const settings = settingsResult || { work_start_time: '09:00', work_end_time: '18:30', ot_start_time: '18:30' };
    const holidayWorkUnits = activeHoliday ? normalizeHolidayMultiplier(activeHoliday.work_multiplier) : null;

    // Kiểm tra bảng công tháng/nhân viên có bị chốt khóa hay không (bảo vệ tính bất biến)
    const [dYear, dMonth] = targetDate.split('-').map(Number);
    const targetUserId = user_id || attendance.user_id;
    const activeLock = await TimesheetLock.findOne({
      month: dMonth,
      year: dYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id: targetUserId }]
    });
    if (activeLock) {
      return res.status(403).json({
        error: activeLock.user_id === null
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể sửa giờ chấm công.`
          : `Bảng công của nhân viên này trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể sửa giờ chấm công.`
      });
    }

    const parseVNTime = (tVal) => {
      if (!tVal) return null;
      if (tVal instanceof Date) return tVal;
      if (typeof tVal === 'string') {
        const s = tVal.trim();
        // Case HH:mm or HH:mm:ss
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
          const parts = s.split(':');
          const hh = String(parts[0]).padStart(2, '0');
          const mm = String(parts[1]).padStart(2, '0');
          const ss = parts[2] ? String(parts[2]).padStart(2, '0') : '00';
          return new Date(`${targetDate}T${hh}:${mm}:${ss}+07:00`);
        }
        // Case YYYY-MM-DDTHH:mm without timezone -> append +07:00
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
          return new Date(`${s}+07:00`);
        }
        return new Date(s);
      }
      return new Date(tVal);
    };

    if (check_in_time) {
      attendance.check_in_time = parseVNTime(check_in_time);
      const lateInfo = calculateLateTier(attendance.check_in_time, settings.work_start_time);
      if (is_late !== undefined) {
        attendance.is_late = Boolean(is_late);
      } else {
        attendance.is_late = lateInfo.is_late;
      }
      attendance.late_minutes = lateInfo.late_minutes;
      attendance.late_tier = lateInfo.late_tier;

      // Đồng bộ lại work_units theo giờ mới nếu ca chưa bị Admin override ký hiệu công rõ ràng
      const effectiveType = check_in_type || attendance.check_in_type || 'office';
      const isExempt = ['wfh', 'site', 'client'].includes(effectiveType);
      const upperNotes = (notes || attendance.notes || '').toUpperCase();
      const hasExplicitSymbolOverride = ['[X]', '[0,75X]', '[0.75X]', '[0,5X]', '[0.5X]', '[1,5X]', '[1.5X]', '[2X]', '[2.0X]', '[3X]', '[3.0X]']
        .some(symbol => upperNotes.includes(symbol));
      if (!hasExplicitSymbolOverride) {
        attendance.work_units = holidayWorkUnits ?? (isExempt ? 1.0 : (lateInfo.work_units ?? 1.0));
      }
    } else if (is_late !== undefined) {
      attendance.is_late = Boolean(is_late);
    }

    if (check_out_time) {
      attendance.check_out_time = parseVNTime(check_out_time);
    }
    if (check_in_type) {
      attendance.check_in_type = check_in_type;
      const isExempt = ['wfh', 'site', 'client'].includes(check_in_type);
      const upperNotes = (notes || attendance.notes || '').toUpperCase();
      const hasExplicitSymbolOverride = ['[X]', '[0,75X]', '[0.75X]', '[0,5X]', '[0.5X]', '[1,5X]', '[1.5X]', '[2X]', '[2.0X]', '[3X]', '[3.0X]']
        .some(symbol => upperNotes.includes(symbol));
      if (!hasExplicitSymbolOverride && (holidayWorkUnits !== null || isExempt)) {
        attendance.work_units = holidayWorkUnits ?? 1.0;
      }
    }
    if (notes) attendance.notes = notes;
    if (status) attendance.status = status;

    if (attendance.check_in_time && attendance.check_out_time) {
      const metrics = calculateAttendanceMetrics(attendance.check_in_time, attendance.check_out_time, {
        workEndTime: settings?.work_end_time || '18:30',
        otStartTime: settings?.ot_start_time || '18:30',
      });
      attendance.total_hours = metrics.totalHours;
      attendance.ot_hours = metrics.otHours;
      attendance.is_early_leave = metrics.isEarlyLeave;
      attendance.early_minutes = metrics.earlyMinutes;
    }

    await attendance.save();
    res.json({ message: 'Đã cập nhật bản ghi chấm công thành công! ✅', attendance });
  } catch (error) {
    console.error('OverrideAttendance error:', error);
    res.status(500).json({ error: 'Lỗi sửa bản ghi chấm công.' });
  }
};

// Helper nội bộ: Xóa bản ghi chấm công, giải phóng thiết bị trong ngày và ghi nhận Audit Log minh bạch
const deleteAttendanceAndLog = async ({ attendance, actor, reason }) => {
  const { _id: id, user_id, date, notes } = attendance;

  // 1. Xóa bản ghi chấm công
  await Attendance.findByIdAndDelete(id);

  // 2. Xóa dữ liệu thiết bị đăng ký của nhân viên đó trong ngày để cho phép chấm lại
  if (user_id && date) {
    await DeviceRegistry.deleteMany({ user_id, date });
  }

  // 3. Ghi nhận lịch sử Audit Log về hành động xóa ca (Bảo toàn lịch sử minh bạch 100%)
  try {
    const user = await User.findById(user_id);
    await AttendanceAuditLog.create({
      attendance_id: id,
      user_id,
      user_name: user ? user.full_name : 'Nhân viên',
      date,
      old_symbol: notes || '—',
      new_symbol: '— (Đã xóa ca)',
      reason: reason || 'Xóa bản ghi chấm công để nhân viên thực hiện chấm công lại',
      modified_by: actor._id,
      modified_by_name: actor.full_name,
      modified_at: new Date(),
    });
  } catch (auditErr) {
    console.warn('Lỗi ghi audit log khi xóa ca:', auditErr);
  }
};

// DELETE /api/attendance/:id — CHỈ ADMIN xóa bản ghi chấm công để nhân viên chấm lại
const deleteAttendance = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền xóa bản ghi chấm công.' });
  }
  const { id } = req.params;
  try {
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi chấm công cần xóa.' });
    }

    if (attendance.date) {
      const [dYear, dMonth] = attendance.date.split('-').map(Number);
      const activeLock = await TimesheetLock.findOne({
        month: dMonth,
        year: dYear,
        is_locked: true,
        $or: [{ user_id: null }, { user_id: attendance.user_id }]
      });
      if (activeLock) {
        return res.status(403).json({
          error: activeLock.user_id === null
            ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể xóa ca chấm công.`
            : `Bảng công của nhân viên này trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể xóa ca chấm công.`
        });
      }
    }

    await deleteAttendanceAndLog({
      attendance,
      actor: req.user,
      reason: 'Admin xóa bản ghi để nhân viên thực hiện chấm công lại',
    });

    res.json({ message: 'Đã xóa bản ghi chấm công thành công! Nhân viên có thể thực hiện chấm công lại.', id });
  } catch (error) {
    console.error('DeleteAttendance error:', error);
    res.status(500).json({ error: 'Lỗi khi xóa bản ghi chấm công.' });
  }
};

// GET /api/attendance/flagged — Admin/Leader lấy danh sách chấm công nghi vấn / chờ duyệt Selfie / lịch sử lưu trữ
const getFlaggedAttendance = async (req, res) => {
  try {
    const { status = 'all', has_photo } = req.query;

    let filter = {};

    // Phân quyền cho Leader: chỉ thấy nhân sự cùng phòng ban nếu không phải Admin
    if (isLeaderRole(req.user)) {
      const teamUserIds = await User.find(
        buildLeaderUserScope(req.user, { includeSelf: false })
      ).distinct('_id');
      filter.user_id = { $in: teamUserIds };
    }

    if (status === 'pending_review' || status === 'pending') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { verification_status: 'pending_review' },
          { is_flagged: true, verification_status: { $ne: 'approved' } }
        ]
      });
    } else if (status === 'approved') {
      filter.verification_status = 'approved';
    } else if (status === 'rejected') {
      filter.verification_status = 'rejected';
    } else if (status === 'photo') {
      filter.selfie_url = { $ne: null, $nin: ['', 'null', 'undefined'] };
    } else if (status === 'device') {
      filter.$or = [
        { flag_reasons: { $in: ['DEVICE_UNTRUSTED', 'MULTI_ACCOUNT_SAME_DEVICE'] } },
        { flag_reason: { $regex: /thiết bị|device/i } }
      ];
    } else {
      // 'all': lấy toàn bộ các ca có gắn cờ cảnh báo, có ảnh selfie hoặc có trạng thái xác thực
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { is_flagged: true },
          { verification_status: { $in: ['pending_review', 'approved', 'rejected'] } },
          { selfie_url: { $ne: null, $nin: ['', 'null', 'undefined'] } },
          { check_in_mode: 'photo' },
          { flag_reasons: { $in: ['DEVICE_UNTRUSTED', 'MULTI_ACCOUNT_SAME_DEVICE'] } }
        ]
      });
    }

    if (has_photo === 'true') {
      filter.selfie_url = { $ne: null, $nin: ['', 'null', 'undefined'] };
    }

    const list = await Attendance.find(filter)
      .populate('user_id', 'full_name employee_code code email department_id department_ids avatar_url role')
      .populate('reviewed_by', 'full_name')
      .sort({ created_at: -1, createdAt: -1 });

    // Tính thống kê nhanh các nhóm trạng thái
    const baseCountFilter = filter.user_id ? { user_id: filter.user_id } : {};
    const allForensicFilter = {
      ...baseCountFilter,
      $or: [
        { is_flagged: true },
        { verification_status: { $in: ['pending_review', 'approved', 'rejected'] } },
        { selfie_url: { $ne: null, $nin: ['', 'null', 'undefined'] } },
        { check_in_mode: 'photo' },
        { flag_reasons: { $in: ['DEVICE_UNTRUSTED', 'MULTI_ACCOUNT_SAME_DEVICE'] } }
      ]
    };

    const [totalCount, pendingCount, approvedCount, rejectedCount, photoCount, deviceCount] = await Promise.all([
      Attendance.countDocuments(allForensicFilter),
      Attendance.countDocuments({ ...baseCountFilter, $or: [{ verification_status: 'pending_review' }, { is_flagged: true, verification_status: { $ne: 'approved' } }] }),
      Attendance.countDocuments({ ...baseCountFilter, verification_status: 'approved' }),
      Attendance.countDocuments({ ...baseCountFilter, verification_status: 'rejected' }),
      Attendance.countDocuments({ ...baseCountFilter, selfie_url: { $ne: null, $nin: ['', 'null', 'undefined'] } }),
      Attendance.countDocuments({ ...baseCountFilter, $or: [{ flag_reasons: { $in: ['DEVICE_UNTRUSTED', 'MULTI_ACCOUNT_SAME_DEVICE'] } }, { flag_reason: { $regex: /thiết bị|device/i } }] }),
    ]);

    res.json({
      flagged: list,
      counts: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        with_photo: photoCount,
        with_device: deviceCount,
      }
    });
  } catch (error) {
    console.error('GetFlaggedAttendance error:', error);
    res.status(500).json({ error: 'Lỗi tải danh sách chấm công chờ duyệt.' });
  }
};

// PUT /api/attendance/approve-flagged/:id & /flagged/verify/:id — Admin/Leader duyệt / từ chối / hoàn tác / xóa
const verifyFlaggedAttendance = async (req, res) => {
  const { id } = req.params;
  const { action, reviewer_note, allow_recheckin, reset_today } = req.body; // action: 'approve' | 'reject' | 'revert' | 'delete'
  const allowReset = allow_recheckin ?? reset_today;

  try {
    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi chấm công.' });
    }

    if (isLeaderRole(req.user) && !(await canManageUserId(req.user, attendance.user_id))) {
      return res.status(403).json({ error: 'Bạn chỉ được xử lý ca cảnh báo của nhân sự thuộc nhóm mình quản lý.' });
    }

    if (action === 'approve') {
      attendance.verification_status = 'approved';
      attendance.is_flagged = false;
      attendance.reviewed_by = req.user._id;
      attendance.reviewed_at = new Date();
      attendance.reviewer_note = reviewer_note || 'Đã phê duyệt ca chấm công hợp lệ';
      if (reviewer_note) {
        attendance.notes = (attendance.notes ? `${attendance.notes} | ` : '') + `Duyệt ca: ${reviewer_note}`;
      }
      await attendance.save();

      // Đánh dấu thiết bị này là thiết bị tin cậy (Primary Device) trong DeviceSession
      if (attendance.user_id && attendance.hardware_uuid) {
        await DeviceSession.findOneAndUpdate(
          { user_id: attendance.user_id, device_fingerprint: attendance.hardware_uuid },
          { is_trusted: true, last_used_at: new Date() },
          { upsert: true }
        );
      }

      const populated = await Attendance.findById(id)
        .populate('user_id', 'full_name employee_code code email department_id department_ids avatar_url role')
        .populate('reviewed_by', 'full_name');

      return res.json({ message: 'Đã duyệt ca chấm công thành công! ✅', attendance: populated });
    } else if (action === 'reject') {
      if (allowReset) {
        // Xóa bản ghi chấm công & DeviceRegistry trong ngày để nhân viên được phép chấm lại kèm ghi nhận Audit Log
        await deleteAttendanceAndLog({
          attendance,
          actor: req.user,
          reason: reviewer_note ? `Từ chối ca & cho phép chấm lại: ${reviewer_note}` : 'Từ chối ca cảnh báo & xóa dữ liệu để nhân viên chấm công lại',
        });
        return res.json({ message: 'Đã từ chối & xóa bản ghi thành công. Nhân viên đã có thể chấm công lại! 🗑️', id });
      } else {
        attendance.verification_status = 'rejected';
        attendance.is_flagged = false;
        attendance.reviewed_by = req.user._id;
        attendance.reviewed_at = new Date();
        attendance.reviewer_note = reviewer_note || 'Nghi vấn gian lận / Ca không hợp lệ';
        attendance.notes = (attendance.notes ? `${attendance.notes} | ` : '') + `Từ chối ca: ${reviewer_note || 'Nghi vấn gian lận'}`;
        await attendance.save();

        const populated = await Attendance.findById(id)
          .populate('user_id', 'full_name employee_code code email department_id department_ids avatar_url role')
          .populate('reviewed_by', 'full_name');

        return res.json({ message: 'Đã từ chối chấm công. Ca này bị đánh dấu không hợp lệ! ❌', attendance: populated });
      }
    } else if (action === 'revert') {
      // Hoàn tác về trạng thái chờ duyệt (pending_review)
      attendance.verification_status = 'pending_review';
      attendance.is_flagged = true;
      attendance.reviewed_by = null;
      attendance.reviewed_at = null;
      attendance.reviewer_note = 'Đã hoàn tác về chờ duyệt lại';
      await attendance.save();

      const populated = await Attendance.findById(id)
        .populate('user_id', 'full_name employee_code code email department_id department_ids avatar_url role')
        .populate('reviewed_by', 'full_name');

      return res.json({ message: 'Đã hoàn tác ca về trạng thái Chờ duyệt! 🔄', attendance: populated });
    } else if (action === 'delete') {
      await deleteAttendanceAndLog({
        attendance,
        actor: req.user,
        reason: reviewer_note ? `Xóa ca cảnh báo: ${reviewer_note}` : 'Admin/Leader xóa ca chấm công cảnh báo',
      });
      return res.json({ message: 'Đã xóa ca chấm công thành công! 🗑️', id });
    } else {
      return res.status(400).json({ error: 'Hành động không hợp lệ (approve, reject, revert hoặc delete).' });
    }
  } catch (error) {
    console.error('VerifyFlaggedAttendance error:', error);
    res.status(500).json({ error: 'Lỗi xử lý xác minh chấm công.' });
  }
};

module.exports = {
  checkIn, checkOut, getTodayStatus, getHistory, getRecordByUserAndDate,
  overrideAttendance, deleteAttendance, getFlaggedAttendance, verifyFlaggedAttendance,
  calculateLateTier, calculateOT, calculateRawTotalHours, calculateAttendanceMetrics, normalizeHolidayMultiplier
};
