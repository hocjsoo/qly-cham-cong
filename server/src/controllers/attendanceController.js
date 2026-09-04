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
const Notification = require('../models/Notification');
const {
  calculateRawTotalHours,
  calculateOT,
  calculateAttendanceMetrics,
  normalizeHolidayMultiplier,
  getVnDateString,
  isOvernightShift,
  formatDurationHoursMinutes,
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

const getTopologyStatus = () => {
  const readyState = mongoose.connection?.readyState;
  const isTestEnv = Boolean(process.env.NODE_ENV === 'test');
  const topology = mongoose.connection?.client?.topology;

  if (isTestEnv && !topology && readyState !== 1) {
    return { readyState, isTestEnv: true, requiresTransaction: false };
  }
  return { readyState, isTestEnv: false, requiresTransaction: true };
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
    return {
      is_late: true,
      late_minutes: diffMins,
      late_tier: diffMins <= minorMinutesNum ? 'late_minor' : 'late_medium',
      label: `Muộn nhẹ (+${diffMins}p)`,
      work_units: 1.0,
      credit_symbol: 'x'
    };
  } else {
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

    // Chặn check-in ca mới nếu đang có ca làm việc chưa checkout từ hôm trước trong vòng 48h
    let openEarlierShiftQuery = Attendance.findOne({
      user_id: userId,
      date: { $lt: dateStr },
      check_out_time: null,
      check_in_time: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
    });
    if (openEarlierShiftQuery && typeof openEarlierShiftQuery.sort === 'function') {
      openEarlierShiftQuery = openEarlierShiftQuery.sort({ date: -1 });
    }
    if (openEarlierShiftQuery && typeof openEarlierShiftQuery.lean === 'function') {
      openEarlierShiftQuery = openEarlierShiftQuery.lean();
    }
    const openEarlierShift = await openEarlierShiftQuery;

    if (openEarlierShift) {
      return res.status(400).json({
        error: `Bạn đang có ca làm việc chưa checkout từ ngày ${openEarlierShift.date}. Vui lòng checkout kết thúc ca cũ trước khi bắt đầu ca mới!`,
        unclosed_shift_id: openEarlierShift._id,
        unclosed_shift_date: openEarlierShift.date,
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

    let attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
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
            selfie_url: selfie_url || null,
            verification_status: isFlagged ? 'pending_review' : 'auto_approved',
          },
          { new: true }
        );
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
    const [dYear, dMonth] = dateStr.split('-').map(Number);

    let initialLockQuery = TimesheetLock.findOne({
      month: dMonth,
      year: dYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id: userId }]
    });
    if (initialLockQuery && typeof initialLockQuery.select === 'function') initialLockQuery = initialLockQuery.select('user_id');
    if (initialLockQuery && typeof initialLockQuery.lean === 'function') initialLockQuery = initialLockQuery.lean();

    const initialLock = await initialLockQuery;
    if (initialLock) {
      return res.status(403).json({
        error: initialLock.user_id === null
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể thực hiện check-out.`
          : `Bảng công của bạn trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể thực hiện check-out.`
      });
    }

    // 1. Tìm ca đang mở: Ưu tiên ca hôm nay, nếu không có thì tìm ca chưa đóng gần nhất trong 48h
    let attendance = await Attendance.findOne({ user_id: userId, date: dateStr, check_in_time: { $ne: null }, check_out_time: null });

    if (!attendance) {
      const unclosedShifts = await Attendance.find({
        user_id: userId,
        check_in_time: { $ne: null },
        check_out_time: null,
      }).sort({ date: -1 });

      if (unclosedShifts.length === 0) {
        const todayRecord = await Attendance.findOne({ user_id: userId, date: dateStr });
        if (todayRecord && todayRecord.check_out_time) {
          return res.status(400).json({ error: 'Bạn đã check-out ca làm việc hôm nay rồi.' });
        }
        return res.status(400).json({ error: 'Bạn chưa check-in hôm nay.' });
      }

      if (unclosedShifts.length > 1) {
        return res.status(400).json({
          error: 'Hệ thống phát hiện bạn có nhiều hơn 1 ca làm việc chưa hoàn tất checkout. Vui lòng gửi đơn "Bổ sung giờ checkout" hoặc liên hệ Admin để xử lý.',
          require_request: true,
        });
      }

      attendance = unclosedShifts[0];
      const diffHours = (now.getTime() - new Date(attendance.check_in_time).getTime()) / (1000 * 60 * 60);
      if (diffHours > 48) {
        return res.status(400).json({
          error: `Ca làm việc từ ngày ${attendance.date} đã vượt quá 48 giờ. Vui lòng gửi đơn "Bổ sung giờ checkout" để Admin phê duyệt.`,
          require_request: true,
        });
      }
    }

    const shiftDate = attendance.date;
    const [sYear, sMonth] = shiftDate.split('-').map(Number);

    // Kiểm tra bảng công tháng của ca làm việc có bị chốt khóa hay không (nếu khác tháng/năm hiện tại)
    let lockQuery = TimesheetLock.findOne({
      month: sMonth,
      year: sYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id: userId }]
    });
    if (lockQuery && typeof lockQuery.select === 'function') lockQuery = lockQuery.select('user_id');
    if (lockQuery && typeof lockQuery.lean === 'function') lockQuery = lockQuery.lean();

    let settingsQuery = SystemSetting.findOne({ key: 'global' });
    if (settingsQuery && typeof settingsQuery.select === 'function') {
      settingsQuery = settingsQuery.select('work_end_time ot_start_time');
    }
    if (settingsQuery && typeof settingsQuery.lean === 'function') settingsQuery = settingsQuery.lean();

    let holidayQuery = Holiday.findOne({
      $or: [
        { date: shiftDate },
        { date: { $lte: shiftDate }, end_date: { $gte: shiftDate } },
      ],
    });
    if (holidayQuery && typeof holidayQuery.select === 'function') holidayQuery = holidayQuery.select('work_multiplier');
    if (holidayQuery && typeof holidayQuery.lean === 'function') holidayQuery = holidayQuery.lean();

    const [activeLock, settings, activeHoliday] = await Promise.all([
      lockQuery,
      settingsQuery,
      holidayQuery,
    ]);

    if (activeLock) {
      return res.status(403).json({
        error: activeLock.user_id === null
          ? `Bảng công Tháng ${sMonth}/${sYear} đã bị chốt khóa toàn cục. Không thể thực hiện check-out ca ngày ${shiftDate}.`
          : `Bảng công của bạn trong Tháng ${sMonth}/${sYear} đã bị khóa. Không thể thực hiện check-out ca ngày ${shiftDate}.`
      });
    }

    const workEndTime = settings?.work_end_time || '18:30';
    const otStartTime = settings?.ot_start_time || '18:30';

    const checkInTime = new Date(attendance.check_in_time);
    const metrics = calculateAttendanceMetrics(checkInTime, now, { workEndTime, otStartTime });
    const totalHours = metrics.totalHours;
    const otHours = metrics.otHours;
    const isOvernight = metrics.isOvernight;

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
      isOvernight ? `Ca xuyên ngày (${shiftDate} ➔ ${dateStr})` : null,
      distanceMeters !== null ? `Cách VP: ${distanceMeters}m` : null,
      `IP: ${clientIP}`,
    ].filter(Boolean).join(' | ');

    attendance.check_out_time = now;
    attendance.check_out_lat = parseFloat(lat);
    attendance.check_out_lng = parseFloat(lng);
    attendance.check_out_note = combinedNote;
    attendance.total_hours = Math.max(0, totalHours);
    attendance.is_early_leave = metrics.isEarlyLeave;
    attendance.early_minutes = metrics.earlyMinutes;
    attendance.is_overnight = isOvernight;

    if (activeHoliday) attendance.work_units = normalizeHolidayMultiplier(activeHoliday.work_multiplier);

    // Phân định rõ ràng OT xuyên ngày (chờ Admin duyệt) vs OT cùng ngày
    if (isOvernight) {
      if (otHours > 0) {
        attendance.ot_hours_proposed = otHours;
        attendance.ot_hours = 0; // Chưa duyệt -> 0h chính thức
        attendance.ot_status = 'pending_approval';
        attendance.ot_approved_by = null;
        attendance.ot_approved_at = null;
      } else {
        attendance.ot_hours_proposed = 0;
        attendance.ot_hours = 0;
        attendance.ot_status = 'none';
      }
    } else {
      attendance.ot_hours = otHours;
      attendance.ot_hours_proposed = otHours;
      attendance.ot_status = otHours > 0 ? 'auto_approved' : 'none';
    }

    await attendance.save();

    const otMsg = isOvernight && otHours > 0
      ? ` (OT tạm tính: ${otHours}h — Chờ Admin duyệt)`
      : (otHours > 0 ? ` (OT: ${otHours}h)` : '');
    const shiftDateMsg = isOvernight ? ` ca ngày ${shiftDate}` : '';

    res.json({
      message: `Check-out${shiftDateMsg} thành công! Tổng ${totalHours}h${otMsg} ${outsideOfficeRadius ? '📍 (Check-out ngoài VP)' : '✅'}`,
      attendance,
      outside_office_radius: outsideOfficeRadius,
      distance_meters: distanceMeters,
      suggest_explanation: outsideOfficeRadius,
      is_overnight: isOvernight,
      ot_status: attendance.ot_status,
      ot_hours_proposed: attendance.ot_hours_proposed,
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
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    let attendance = await Attendance.findOne({ user_id: userId, date: dateStr });
    let activeShift = null;

    // Nếu hôm nay chưa check-in: tìm ca đang mở từ hôm trước trong phạm vi 48h
    if (!attendance || !attendance.check_in_time) {
      const openShifts = await Attendance.find({
        user_id: userId,
        date: { $ne: dateStr },
        check_in_time: { $ne: null },
        check_out_time: null,
      }).sort({ date: -1 });

      if (openShifts.length === 1) {
        const candidate = openShifts[0];
        const diffHours = (now.getTime() - new Date(candidate.check_in_time).getTime()) / (1000 * 60 * 60);
        if (diffHours <= 48) {
          activeShift = candidate;
          if (!attendance || !attendance.check_in_time) {
            attendance = candidate;
          }
        }
      }
    }

    const activeOffices = await OfficeLocation.find({ is_active: true });
    res.json({
      attendance,
      active_shift: activeShift,
      is_active_overnight_shift: Boolean(activeShift && activeShift.date !== dateStr),
      offices: activeOffices.map(l => ({ _id: l._id, name: l.name, radius_m: l.radius_m, lat: l.lat, lng: l.lng })),
      office: activeOffices[0] ? { name: activeOffices[0].name, radius_m: activeOffices[0].radius_m, lat: activeOffices[0].lat, lng: activeOffices[0].lng } : null
    });
  } catch (error) {
    console.error('GetTodayStatus error:', error);
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
        if (isLeaderRole(req.user)) {
          const userIds = await User.find(
            buildLeaderUserScope(req.user, { includeSelf: true })
          ).distinct('_id');
          userQueryFilter = { user_id: { $in: userIds } };
        } else if (req.query.user_id === 'all') {
          userQueryFilter = {};
        }
      }
    }

    if (mode === 'year') {
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
        const otHours = parseFloat(monthRecs.reduce((s, r) => s + (r.ot_status === 'pending_approval' ? 0 : (r.ot_hours || 0)), 0).toFixed(1));
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

    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const records = await Attendance.find({
      ...userQueryFilter,
      date: { $regex: `^${monthStr}` }
    })
      .populate('user_id', 'full_name employee_code avatar_url email')
      .populate('ot_approved_by', 'full_name')
      .sort({ date: -1 });

    const presentDays = records.filter(r => !r.is_late).length;
    const lateDays = records.filter(r => r.is_late).length;
    const totalHours = parseFloat(records.reduce((s, r) => s + (r.total_hours || 0), 0).toFixed(1));
    const totalOt = parseFloat(records.reduce((s, r) => s + (r.ot_status === 'pending_approval' ? 0 : (r.ot_hours || 0)), 0).toFixed(1));

    res.json({
      summary: { present_days: presentDays, late_days: lateDays, total_hours: totalHours, total_ot_hours: totalOt, total_days: records.length },
      records,
    });
  } catch (error) {
    console.error('GetHistory error:', error);
    res.status(500).json({ error: 'Lỗi tải lịch sử chấm công.' });
  }
};

// GET /api/attendance/record?user_id=...&date=YYYY-MM-DD
const getRecordByUserAndDate = async (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id || !date) {
      return res.status(400).json({ error: 'Thiếu user_id hoặc date.' });
    }

    const isSelf = String(req.user._id) === String(user_id);
    const isAdmin = req.user.role === 'admin';
    const isLeader = isLeaderRole(req.user);

    if (!isSelf && !isAdmin) {
      if (!isLeader || !(await canManageUserId(req.user, user_id))) {
        return res.status(403).json({ error: 'Bạn không có quyền xem bản ghi chấm công của nhân sự này.' });
      }
    }

    const record = await Attendance.findOne({ user_id, date })
      .populate('user_id', 'full_name employee_code avatar_url email department_id position')
      .populate('ot_approved_by', 'full_name');

    res.json({ record });
  } catch (error) {
    console.error('GetRecordByUserAndDate error:', error);
    res.status(500).json({ error: 'Lỗi lấy bản ghi chấm công.' });
  }
};

// GET /api/attendance/pending-ot — Admin lấy danh sách ca có OT xuyên ngày chờ duyệt
const getPendingOvernightOt = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền xem danh sách OT xuyên ngày chờ duyệt.' });
    }

    const records = await Attendance.find({
      ot_status: 'pending_approval',
    })
      .populate('user_id', 'full_name employee_code avatar_url email department_id position')
      .sort({ date: -1, created_at: -1 });

    const formatted = records.map(r => {
      const obj = r.toObject ? r.toObject() : r;
      return {
        ...obj,
        id: obj._id,
        user_name: obj.user_id?.full_name || 'Nhân viên',
        user_code: obj.user_id?.employee_code || 'NV',
        user_avatar: obj.user_id?.avatar_url,
      };
    });

    res.json({ pending_ot: formatted, count: formatted.length });
  } catch (error) {
    console.error('GetPendingOvernightOt error:', error);
    res.status(500).json({ error: 'Lỗi tải danh sách OT chờ duyệt.' });
  }
};

// PUT /api/attendance/:id/approve-ot — Admin duyệt / điều chỉnh số giờ OT ca xuyên ngày
const approveOvernightOt = async (req, res) => {
  const { id } = req.params;
  const { approved_hours, reviewer_note, adjustment_reason } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền duyệt OT ca xuyên ngày.' });
  }

  try {
    const initialAtt = await Attendance.findById(id);
    if (!initialAtt) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi chấm công.' });
    }

    if (!initialAtt.is_overnight) {
      return res.status(400).json({ error: 'Bản ghi này không phải ca làm việc xuyên ngày.' });
    }

    if (initialAtt.ot_status === 'approved') {
      return res.status(409).json({ error: 'Ca làm việc này đã được phê duyệt OT trước đó.' });
    }

    if (initialAtt.ot_status === 'rejected') {
      return res.status(409).json({ error: 'Ca làm việc này đã bị từ chối OT trước đó.' });
    }

    if (initialAtt.ot_status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ca làm việc không ở trạng thái chờ duyệt OT.' });
    }

    const proposed = Number(initialAtt.ot_hours_proposed) || 0;
    let finalOt = proposed;
    if (approved_hours !== undefined && approved_hours !== null && approved_hours !== '') {
      const parsed = parseFloat(approved_hours);
      if (isNaN(parsed) || parsed < 0 || parsed > 24) {
        return res.status(400).json({ error: 'Số giờ OT phê duyệt không hợp lệ.' });
      }
      finalOt = Number(parsed.toFixed(2));
      if (Math.abs(finalOt - proposed) > 0.05) {
        if (!adjustment_reason || !adjustment_reason.trim()) {
          return res.status(400).json({
            error: 'Vui lòng nhập lý do điều chỉnh khi số giờ OT duyệt khác với số giờ đề xuất.'
          });
        }
      }
    }

    const [dYear, dMonth] = initialAtt.date.split('-').map(Number);

    await TimesheetLock.updateOne(
      { month: dMonth, year: dYear, user_id: null },
      { $setOnInsert: { month: dMonth, year: dYear, user_id: null, is_locked: false, guard_version: 0 } },
      { upsert: true }
    ).catch(e => { if (e.code !== 11000) throw e; });

    if (initialAtt.user_id) {
      await TimesheetLock.updateOne(
        { month: dMonth, year: dYear, user_id: initialAtt.user_id },
        { $setOnInsert: { month: dMonth, year: dYear, user_id: initialAtt.user_id, is_locked: false, guard_version: 0 } },
        { upsert: true }
      ).catch(e => { if (e.code !== 11000) throw e; });
    }

    const topologyStatus = getTopologyStatus();
    let session = null;
    let useCallbackTx = false;
    let hasManualTx = false;

    if (topologyStatus.requiresTransaction) {
      if (topologyStatus.readyState !== 1 || typeof mongoose.startSession !== 'function') {
        return res.status(500).json({
          error: `Lỗi kết nối cơ sở dữ liệu: Không thể khởi tạo giao dịch an toàn (readyState: ${topologyStatus.readyState}). Yêu cầu bị hủy theo chính sách Fail-Closed.`,
        });
      }
      session = await mongoose.startSession();
      if (!session) {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session).',
        });
      }
      useCallbackTx = typeof session.withTransaction === 'function';
      hasManualTx = typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function';
      if (!useCallbackTx && !hasManualTx) {
        try { await session.endSession(); } catch (_) {}
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Phiên giao dịch thiếu phương thức transaction hợp lệ.',
        });
      }
    } else if (topologyStatus.isTestEnv && typeof mongoose.startSession === 'function') {
      try {
        session = await mongoose.startSession();
        useCallbackTx = Boolean(session && typeof session.withTransaction === 'function');
        hasManualTx = Boolean(session && typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function');
      } catch (_) {
        session = null;
        useCallbackTx = false;
        hasManualTx = false;
      }
    }

    let isCommitted = false;
    let updatedDoc = null;

    const executeMutation = async (activeSession) => {
      // 1. Guard TimesheetLock inside transaction
      if (typeof TimesheetLock.findOneAndUpdate === 'function') {
        const updateOptions = { upsert: false, new: true };
        if (activeSession) updateOptions.session = activeSession;

        const globalGuard = await TimesheetLock.findOneAndUpdate(
          { month: dMonth, year: dYear, user_id: null, is_locked: { $ne: true } },
          { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
          updateOptions
        );
        if (!globalGuard || globalGuard.is_locked) {
          const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể duyệt điều chỉnh OT.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }

        if (initialAtt.user_id) {
          const userGuard = await TimesheetLock.findOneAndUpdate(
            { month: dMonth, year: dYear, user_id: initialAtt.user_id, is_locked: { $ne: true } },
            { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
            updateOptions
          );
          if (!userGuard || userGuard.is_locked) {
            const lockErr = new Error(`Bảng công của nhân viên trong Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể duyệt điều chỉnh OT.`);
            lockErr.statusCode = 403;
            throw lockErr;
          }
        }
      } else {
        const lockQuery = TimesheetLock.findOne({
          month: dMonth,
          year: dYear,
          is_locked: true,
          $or: [{ user_id: null }, { user_id: initialAtt.user_id }],
        });
        if (activeSession && typeof lockQuery.session === 'function') lockQuery.session(activeSession);
        const lock = await lockQuery;
        if (lock) {
          const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể duyệt điều chỉnh OT.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }
      }

      // 2. Fetch and update Attendance inside transaction
      let attQuery = Attendance.findOne({ _id: id, ot_status: 'pending_approval' });
      if (activeSession && typeof attQuery.session === 'function') attQuery = attQuery.session(activeSession);
      const attendance = await attQuery;

      if (!attendance) {
        const err = new Error('Không tìm thấy bản ghi hoặc ca đã được xử lý trước đó.');
        err.statusCode = 409;
        throw err;
      }

      attendance.ot_hours = finalOt;
      attendance.ot_status = 'approved';
      attendance.ot_approved_by = req.user._id;
      attendance.ot_approved_at = new Date();
      attendance.ot_reviewer_note = reviewer_note ? reviewer_note.trim() : 'Admin đã duyệt OT ca xuyên ngày';
      if (adjustment_reason) {
        attendance.ot_adjustment_reason = adjustment_reason.trim();
      }

      await attendance.save(activeSession ? { session: activeSession } : {});

      // 3. Atomically record audit log inside same transaction
      let userQuery = User.findById(attendance.user_id);
      if (activeSession && typeof userQuery.session === 'function') userQuery = userQuery.session(activeSession);
      const targetUser = await userQuery;

      const auditPayload = {
        attendance_id: attendance._id,
        user_id: attendance.user_id,
        user_name: targetUser ? targetUser.full_name : 'Nhân sự',
        date: attendance.date,
        old_symbol: `OT đề xuất: ${attendance.ot_hours_proposed}h`,
        new_symbol: `OT duyệt: ${finalOt}h`,
        reason: adjustment_reason || reviewer_note || 'Admin duyệt số giờ OT ca xuyên ngày',
        modified_by: req.user._id,
        modified_by_name: req.user.full_name,
        modified_at: new Date(),
      };

      await AttendanceAuditLog.create(
        activeSession ? [auditPayload] : auditPayload,
        activeSession ? { session: activeSession } : undefined
      );

      updatedDoc = attendance;
    };

    try {
      if (session && useCallbackTx) {
        await session.withTransaction(async () => {
          await executeMutation(session);
        });
        isCommitted = true;
      } else if (session && hasManualTx) {
        await session.startTransaction();
        await executeMutation(session);
        await session.commitTransaction();
        isCommitted = true;
      } else if (topologyStatus.isTestEnv) {
        await executeMutation(null);
        isCommitted = true;
      } else {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Thiếu cơ chế transaction khả dụng trên MongoDB. Yêu cầu bị hủy theo chính sách Fail-Closed.',
        });
      }
    } catch (txErr) {
      if (session && hasManualTx && !useCallbackTx && !isCommitted) {
        try { await session.abortTransaction(); } catch (_) {}
      }
      throw txErr;
    } finally {
      if (session) {
        try { await session.endSession(); } catch (_) {}
      }
    }

    try {
      await Notification.create({
        user_id: updatedDoc.user_id,
        title: '🔥 OT xuyên ngày của bạn đã được duyệt!',
        message: `Admin đã duyệt ${finalOt}h tăng ca (OT) cho ca làm việc ngày ${updatedDoc.date}.${reviewer_note ? ` Ghi chú: ${reviewer_note}` : ''}`,
        type: 'attendance',
        link: '/history',
      });
    } catch (_) {}

    const populated = await Attendance.findById(id)
      .populate('user_id', 'full_name employee_code avatar_url')
      .populate('ot_approved_by', 'full_name');

    return res.json({
      message: `Đã duyệt ${finalOt}h OT xuyên ngày thành công! ✅`,
      attendance: populated,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('ApproveOvernightOt error:', error);
    res.status(500).json({ error: error.message || 'Lỗi phê duyệt OT ca xuyên ngày.' });
  }
};

// PUT /api/attendance/:id/reject-ot — Admin từ chối OT ca xuyên ngày
const rejectOvernightOt = async (req, res) => {
  const { id } = req.params;
  const { reviewer_note } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền từ chối OT ca xuyên ngày.' });
  }

  try {
    const initialAtt = await Attendance.findById(id);
    if (!initialAtt) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi chấm công.' });
    }

    if (!initialAtt.is_overnight) {
      return res.status(400).json({ error: 'Bản ghi này không phải ca làm việc xuyên ngày.' });
    }

    if (initialAtt.ot_status === 'approved') {
      return res.status(409).json({ error: 'Ca làm việc này đã được phê duyệt OT trước đó.' });
    }

    if (initialAtt.ot_status === 'rejected') {
      return res.status(409).json({ error: 'Ca làm việc này đã bị từ chối OT trước đó.' });
    }

    if (initialAtt.ot_status !== 'pending_approval') {
      return res.status(400).json({ error: 'Ca làm việc không ở trạng thái chờ duyệt OT.' });
    }

    const [dYear, dMonth] = initialAtt.date.split('-').map(Number);

    await TimesheetLock.updateOne(
      { month: dMonth, year: dYear, user_id: null },
      { $setOnInsert: { month: dMonth, year: dYear, user_id: null, is_locked: false, guard_version: 0 } },
      { upsert: true }
    ).catch(e => { if (e.code !== 11000) throw e; });

    if (initialAtt.user_id) {
      await TimesheetLock.updateOne(
        { month: dMonth, year: dYear, user_id: initialAtt.user_id },
        { $setOnInsert: { month: dMonth, year: dYear, user_id: initialAtt.user_id, is_locked: false, guard_version: 0 } },
        { upsert: true }
      ).catch(e => { if (e.code !== 11000) throw e; });
    }

    const topologyStatus = getTopologyStatus();
    let session = null;
    let useCallbackTx = false;
    let hasManualTx = false;

    if (topologyStatus.requiresTransaction) {
      if (topologyStatus.readyState !== 1 || typeof mongoose.startSession !== 'function') {
        return res.status(500).json({
          error: `Lỗi kết nối cơ sở dữ liệu: Không thể khởi tạo giao dịch an toàn (readyState: ${topologyStatus.readyState}). Yêu cầu bị hủy theo chính sách Fail-Closed.`,
        });
      }
      session = await mongoose.startSession();
      if (!session) {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Phiên giao dịch MongoDB khởi tạo không thành công (null session).',
        });
      }
      useCallbackTx = typeof session.withTransaction === 'function';
      hasManualTx = typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function';
      if (!useCallbackTx && !hasManualTx) {
        try { await session.endSession(); } catch (_) {}
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Phiên giao dịch thiếu phương thức transaction hợp lệ.',
        });
      }
    } else if (topologyStatus.isTestEnv && typeof mongoose.startSession === 'function') {
      try {
        session = await mongoose.startSession();
        useCallbackTx = Boolean(session && typeof session.withTransaction === 'function');
        hasManualTx = Boolean(session && typeof session.startTransaction === 'function' && typeof session.commitTransaction === 'function');
      } catch (_) {
        session = null;
        useCallbackTx = false;
        hasManualTx = false;
      }
    }

    let isCommitted = false;
    let updatedDoc = null;

    const executeMutation = async (activeSession) => {
      // 1. Guard TimesheetLock inside transaction
      if (typeof TimesheetLock.findOneAndUpdate === 'function') {
        const updateOptions = { upsert: false, new: true };
        if (activeSession) updateOptions.session = activeSession;

        const globalGuard = await TimesheetLock.findOneAndUpdate(
          { month: dMonth, year: dYear, user_id: null, is_locked: { $ne: true } },
          { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
          updateOptions
        );
        if (!globalGuard || globalGuard.is_locked) {
          const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể từ chối OT.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }

        if (initialAtt.user_id) {
          const userGuard = await TimesheetLock.findOneAndUpdate(
            { month: dMonth, year: dYear, user_id: initialAtt.user_id, is_locked: { $ne: true } },
            { $inc: { guard_version: 1 }, $set: { last_verified_at: new Date() } },
            updateOptions
          );
          if (!userGuard || userGuard.is_locked) {
            const lockErr = new Error(`Bảng công của nhân viên trong Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể từ chối OT.`);
            lockErr.statusCode = 403;
            throw lockErr;
          }
        }
      } else {
        const lockQuery = TimesheetLock.findOne({
          month: dMonth,
          year: dYear,
          is_locked: true,
          $or: [{ user_id: null }, { user_id: initialAtt.user_id }],
        });
        if (activeSession && typeof lockQuery.session === 'function') lockQuery.session(activeSession);
        const lock = await lockQuery;
        if (lock) {
          const lockErr = new Error(`Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa. Không thể từ chối OT.`);
          lockErr.statusCode = 403;
          throw lockErr;
        }
      }

      // 2. Fetch and update Attendance inside transaction
      let attQuery = Attendance.findOne({ _id: id, ot_status: 'pending_approval' });
      if (activeSession && typeof attQuery.session === 'function') attQuery = attQuery.session(activeSession);
      const attendance = await attQuery;

      if (!attendance) {
        const err = new Error('Không tìm thấy bản ghi hoặc ca đã được xử lý trước đó.');
        err.statusCode = 409;
        throw err;
      }

      attendance.ot_hours = 0;
      attendance.ot_status = 'rejected';
      attendance.ot_approved_by = req.user._id;
      attendance.ot_approved_at = new Date();
      attendance.ot_reviewer_note = reviewer_note ? reviewer_note.trim() : 'Từ chối OT ca xuyên ngày';

      await attendance.save(activeSession ? { session: activeSession } : {});

      // 3. Atomically record audit log inside same transaction
      let userQuery = User.findById(attendance.user_id);
      if (activeSession && typeof userQuery.session === 'function') userQuery = userQuery.session(activeSession);
      const targetUser = await userQuery;

      const auditPayload = {
        attendance_id: attendance._id,
        user_id: attendance.user_id,
        user_name: targetUser ? targetUser.full_name : 'Nhân sự',
        date: attendance.date,
        old_symbol: `OT đề xuất: ${attendance.ot_hours_proposed}h`,
        new_symbol: 'OT: 0h (Từ chối)',
        reason: reviewer_note || 'Admin từ chối OT ca xuyên ngày',
        modified_by: req.user._id,
        modified_by_name: req.user.full_name,
        modified_at: new Date(),
      };

      await AttendanceAuditLog.create(
        activeSession ? [auditPayload] : auditPayload,
        activeSession ? { session: activeSession } : undefined
      );

      updatedDoc = attendance;
    };

    try {
      if (session && useCallbackTx) {
        await session.withTransaction(async () => {
          await executeMutation(session);
        });
        isCommitted = true;
      } else if (session && hasManualTx) {
        await session.startTransaction();
        await executeMutation(session);
        await session.commitTransaction();
        isCommitted = true;
      } else if (topologyStatus.isTestEnv) {
        await executeMutation(null);
        isCommitted = true;
      } else {
        return res.status(500).json({
          error: 'Lỗi thiết lập giao dịch: Thiếu cơ chế transaction khả dụng trên MongoDB. Yêu cầu bị hủy theo chính sách Fail-Closed.',
        });
      }
    } catch (txErr) {
      if (session && hasManualTx && !useCallbackTx && !isCommitted) {
        try { await session.abortTransaction(); } catch (_) {}
      }
      throw txErr;
    } finally {
      if (session) {
        try { await session.endSession(); } catch (_) {}
      }
    }

    try {
      await Notification.create({
        user_id: updatedDoc.user_id,
        title: '❌ OT xuyên ngày không được duyệt',
        message: `Admin đã từ chối tính OT cho ca làm việc ngày ${updatedDoc.date}.${reviewer_note ? ` Lý do: ${reviewer_note}` : ''}`,
        type: 'attendance',
        link: '/history',
      });
    } catch (_) {}

    const populated = await Attendance.findById(id)
      .populate('user_id', 'full_name employee_code avatar_url')
      .populate('ot_approved_by', 'full_name');

    return res.json({
      message: 'Đã từ chối OT ca xuyên ngày thành công (Bảo toàn giờ công chuẩn) ❌',
      attendance: populated,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('RejectOvernightOt error:', error);
    res.status(500).json({ error: error.message || 'Lỗi từ chối OT ca xuyên ngày.' });
  }
};

// PUT /api/attendance/override/:id — CHỈ ADMIN có quyền sửa giờ công
const overrideAttendance = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền điều chỉnh bản ghi chấm công.' });
  }

  const { id } = req.params;
  const {
    check_in_time, check_out_time, check_out_date, is_overnight, is_overnight_checkout, check_in_type, notes, status, is_late, user_id, date, ot_hours, ot_status
  } = req.body;

  try {
    let attendance = null;
    if (id && id !== 'new') {
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
        status: status || 'present',
        check_in_type: check_in_type || 'office',
      });
    }

    const snapshotBefore = attendance.isNew ? null : (attendance.toObject ? attendance.toObject() : { ...attendance });

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
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể điều chỉnh dữ liệu chấm công.`
          : `Bảng công của nhân viên trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể điều chỉnh dữ liệu chấm công.`
      });
    }

    // Hỗ trợ ngày checkout sang ngày hôm sau (+1 ngày) cho ca làm việc xuyên đêm
    let effectiveEndDate = targetDate;
    if (check_out_date) {
      effectiveEndDate = check_out_date;
    } else if (is_overnight || is_overnight_checkout) {
      const baseDt = new Date(targetDate + "T00:00:00+07:00");
      baseDt.setDate(baseDt.getDate() + 1);
      effectiveEndDate = baseDt.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    }

    const parseVNTime = (tVal, customDate = null) => {
      if (!tVal) return null;
      const baseDate = customDate || targetDate;
      if (typeof tVal === "string") {
        const s = tVal.trim();
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
          return new Date(s);
        }
        if (/^\d{2}:\d{2}$/.test(s)) {
          return new Date(`${baseDate}T${s}:00+07:00`);
        }
        if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
          return new Date(`${baseDate}T${s}+07:00`);
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
      attendance.check_out_time = parseVNTime(check_out_time, effectiveEndDate);
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
      attendance.is_early_leave = metrics.isEarlyLeave;
      attendance.early_minutes = metrics.earlyMinutes;
      attendance.is_overnight = metrics.isOvernight;

      if (ot_hours !== undefined && ot_hours !== null && ot_hours !== '') {
        const numOt = parseFloat(ot_hours);
        attendance.ot_hours = isNaN(numOt) ? 0 : Math.max(0, numOt);
        attendance.ot_hours_proposed = attendance.ot_hours;
        attendance.ot_status = ot_status || 'approved';
        attendance.ot_approved_by = req.user._id;
        attendance.ot_approved_at = new Date();
      } else {
        // Khi Admin trực tiếp sửa giờ làm việc, tự động tính và duyệt giờ OT tương ứng
        attendance.ot_hours = metrics.otHours;
        attendance.ot_hours_proposed = metrics.otHours;
        attendance.ot_status = metrics.otHours > 0 ? 'approved' : 'none';
        if (metrics.otHours > 0) {
          attendance.ot_approved_by = req.user._id;
          attendance.ot_approved_at = new Date();
        }
      }
    }

    await attendance.save();

    // Ghi nhận Audit Log minh bạch cho hành động điều chỉnh dữ liệu chấm công của Admin
    try {
      const targetUser = await User.findById(attendance.user_id);
      await AttendanceAuditLog.create({
        attendance_id: attendance._id,
        user_id: attendance.user_id,
        user_name: targetUser ? targetUser.full_name : 'Nhân viên',
        date: attendance.date,
        old_symbol: snapshotBefore ? (snapshotBefore.notes || String(snapshotBefore.total_hours || 0) + 'h') : '—',
        new_symbol: notes || String(attendance.total_hours || 0) + 'h',
        reason: notes || 'Admin điều chỉnh dữ liệu chấm công',
        modified_by: req.user._id,
        modified_by_name: req.user.full_name || 'Admin',
        modified_at: new Date(),
        snapshot_before: snapshotBefore,
        snapshot_after: attendance.toObject ? attendance.toObject() : attendance,
      });
    } catch (auditErr) {
      console.warn('Lỗi ghi audit log khi override công:', auditErr);
    }

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
      return res.status(404).json({ error: 'Không tìm thấy bản ghi chấm công.' });
    }

    const { date, user_id } = attendance;
    const [dYear, dMonth] = date.split('-').map(Number);
    const activeLock = await TimesheetLock.findOne({
      month: dMonth,
      year: dYear,
      is_locked: true,
      $or: [{ user_id: null }, { user_id }]
    });

    if (activeLock) {
      return res.status(403).json({
        error: activeLock.user_id === null
          ? `Bảng công Tháng ${dMonth}/${dYear} đã bị chốt khóa toàn cục. Không thể xóa dữ liệu chấm công.`
          : `Bảng công của nhân viên trong Tháng ${dMonth}/${dYear} đã bị khóa. Không thể xóa dữ liệu chấm công.`
      });
    }

    await deleteAttendanceAndLog({
      attendance,
      actor: req.user,
      reason: 'Admin xóa bản ghi chấm công để nhân viên thực hiện chấm công lại',
    });

    res.json({ message: 'Đã xóa bản ghi chấm công và giải phóng thiết bị thành công! ✅', id });
  } catch (error) {
    console.error('DeleteAttendance error:', error);
    res.status(500).json({ error: 'Lỗi xóa bản ghi chấm công.' });
  }
};

// GET /api/attendance/flagged — Lấy danh sách chấm công nghi vấn / gắn cờ cảnh báo
// GET /api/attendance/:id/selfie — Tải riêng ảnh selfie phân giải cao theo nhu cầu (On-Demand Loading)
const getSelfiePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    let query = Attendance.findById(id);
    if (query && typeof query.select === "function") query = query.select("selfie_url user_id");
    if (query && typeof query.lean === "function") query = query.lean();
    const doc = await query;
    if (!doc || !doc.selfie_url) {
      return res.status(404).json({ error: "Không tìm thấy ảnh selfie cho ca làm việc này." });
    }
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    return res.json({ selfie_url: doc.selfie_url });
  } catch (err) {
    console.error("GetSelfiePhoto error:", err);
    return res.status(500).json({ error: "Lỗi tải ảnh selfie." });
  }
};

const getFlaggedAttendance = async (req, res) => {
  try {
    const { status, filter, counts_only, page, limit } = req.query;
    let baseFilter = {};

    if (isLeaderRole(req.user)) {
      const subordinateIds = await User.find(
        buildLeaderUserScope(req.user, { includeSelf: false })
      ).distinct('_id');
      baseFilter.user_id = { $in: subordinateIds };
    }

    const pendingCondition = {
      $or: [
        { verification_status: 'pending_review' },
        { is_flagged: true, verification_status: { $nin: ['approved', 'rejected'] } },
      ],
    };
    const photoCondition = { selfie_url: { $exists: true, $nin: [null, '', 'null', 'undefined'] } };
    const deviceCondition = {
      $or: [
        { flag_reasons: { $in: ['DEVICE_UNTRUSTED', 'MULTI_ACCOUNT_SAME_DEVICE'] } },
        { flag_reason: { $regex: /thiết bị|device/i } },
      ],
    };
    // Normal attendance and leave rows are not verification cases.
    const allForensicFilter = {
      ...baseFilter,
      $or: [
        { is_flagged: true },
        { verification_status: { $in: ['pending_review', 'approved', 'rejected'] } },
        photoCondition,
        ...deviceCondition.$or,
      ],
    };
    const scopedFilter = (condition) => ({ $and: [allForensicFilter, condition] });
    const tabConditions = {
      pending: pendingCondition,
      approved: { verification_status: 'approved' },
      rejected: { verification_status: 'rejected' },
      photo: photoCondition,
      device: deviceCondition,
    };
    // Keep status=photo/device compatible with existing clients.
    const conditions = [allForensicFilter];
    if (Object.hasOwn(tabConditions, status)) conditions.push(tabConditions[status]);
    if (filter === 'photo') conditions.push(photoCondition);
    if (filter === 'device') conditions.push(deviceCondition);
    const queryFilter = { $and: conditions };

    let list = [];
    if (counts_only !== "true") {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
      const skipNum = (pageNum - 1) * limitNum;

      let listQuery = Attendance.find(queryFilter)
        .populate("user_id", "full_name employee_code code email department_id department_ids avatar_url role phone")
        .populate("reviewed_by", "full_name")
        .sort({ date: -1, created_at: -1 });

      if (typeof listQuery.skip === "function") listQuery = listQuery.skip(skipNum);
      if (typeof listQuery.limit === "function") listQuery = listQuery.limit(limitNum);
      if (typeof listQuery.lean === "function") listQuery = listQuery.lean();

      list = await listQuery;
    }

    const [totalCount, pendingCount, approvedCount, rejectedCount, photoCount, deviceCount] = await Promise.all([
      Attendance.countDocuments(allForensicFilter),
      Attendance.countDocuments(scopedFilter(pendingCondition)),
      Attendance.countDocuments(scopedFilter(tabConditions.approved)),
      Attendance.countDocuments(scopedFilter(tabConditions.rejected)),
      Attendance.countDocuments(scopedFilter(photoCondition)),
      Attendance.countDocuments(scopedFilter(deviceCondition)),
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

// PUT /api/attendance/approve-flagged/:id & /flagged/verify/:id — Admin/Leader duyệt / từ chối selfie & cảnh báo
const verifyFlaggedAttendance = async (req, res) => {
  const { id } = req.params;
  const { action, reviewer_note, allow_recheckin, reset_today } = req.body;
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
  checkIn,
  checkOut,
  getTodayStatus,
  getHistory,
  getRecordByUserAndDate,
  getPendingOvernightOt,
  approveOvernightOt,
  rejectOvernightOt,
  overrideAttendance,
  deleteAttendance,
  getFlaggedAttendance,
  verifyFlaggedAttendance,
  getSelfiePhoto,
  calculateLateTier,
  calculateOT,
  calculateRawTotalHours,
  calculateAttendanceMetrics,
  normalizeHolidayMultiplier,
};
