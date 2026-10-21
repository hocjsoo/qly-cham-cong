const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET = '+07:00';

const getVnDateString = (date) => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toLocaleDateString('en-CA', { timeZone: VN_TIME_ZONE });
};

const isOvernightShift = (checkInDate, checkOutDate) => {
  const inStr = getVnDateString(checkInDate);
  const outStr = getVnDateString(checkOutDate);
  if (!inStr || !outStr) return false;
  return inStr !== outStr;
};

const normalizeClockTime = (value, fallback = '18:30') => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate)) return candidate;
  return fallback;
};

const buildVnThreshold = (date, clockTime, fallback = '18:30') => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const dateStr = parsedDate.toLocaleDateString('en-CA', { timeZone: VN_TIME_ZONE });
  const normalizedTime = normalizeClockTime(clockTime, fallback);
  return new Date(`${dateStr}T${normalizedTime}:00${VN_OFFSET}`);
};

const calculateRawTotalHours = (checkInDate, checkOutDate, precision = null) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const diffHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
  if (precision !== null && Number.isInteger(precision) && precision >= 0 && precision <= 3) {
    return Number(diffHours.toFixed(precision));
  }
  return Number(diffHours.toFixed(2));
};

// Mốc OT tính theo ngày bắt đầu ca (checkInDate), không tính theo ngày của checkOutDate.
// Tự động giữ độ chính xác theo từng phút (ví dụ 6.05h = 6 giờ 03 phút).
const calculateOT = (checkInDate, checkOutDate, otStartTime = '18:30', precision = null) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const otThreshold = buildVnThreshold(checkIn, otStartTime, '18:30');
  if (!otThreshold || checkOut <= otThreshold) return 0;

  const otStartMs = Math.max(checkIn.getTime(), otThreshold.getTime());
  const diffHours = (checkOut.getTime() - otStartMs) / (1000 * 60 * 60);
  if (precision !== null && Number.isInteger(precision) && precision >= 0 && precision <= 3) {
    return Math.max(0, Number(diffHours.toFixed(precision)));
  }
  return Math.max(0, Number(diffHours.toFixed(2)));
};

const calculateAttendanceMetrics = (
  checkInDate,
  checkOutDate,
  { workEndTime = '18:30', otStartTime = '18:30', totalPrecision = 1 } = {}
) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const isOvernight = isOvernightShift(checkIn, checkOut);
  const workEndThreshold = buildVnThreshold(checkIn, workEndTime, '18:30');
  const isValidCheckOut = !Number.isNaN(checkOut.getTime());
  const isEarlyLeave = Boolean(!isOvernight && isValidCheckOut && workEndThreshold && checkOut < workEndThreshold);

  return {
    totalHours: calculateRawTotalHours(checkIn, checkOut, totalPrecision),
    otHours: calculateOT(checkIn, checkOut, otStartTime),
    isEarlyLeave,
    earlyMinutes: isEarlyLeave
      ? Math.max(0, Math.ceil((workEndThreshold.getTime() - checkOut.getTime()) / (1000 * 60)))
      : 0,
    isOvernight,
  };
};

// Công trừ theo thời gian thiếu thực tế (yêu cầu khách hàng 20/10/2026):
// công = 1 - (số phút thiếu / số phút chuẩn ngày). Muộn/về sớm 60p -> trừ 1/8 công (0.875).
// Làm tròn 4 chữ số thập phân để 1/8 giữ chính xác 0.8750.
const calculateProRataWorkUnits = (missingMinutes, standardMinutes = 480) => {
  const miss = Math.max(0, Number(missingMinutes) || 0);
  const std = Number(standardMinutes) > 0 ? Number(standardMinutes) : 480;
  return Math.max(0, Math.round((1 - miss / std) * 10000) / 10000);
};

// Ký hiệu bảng công động: 1 -> 'x'; 0.875 -> '0,875x'; 0.75 -> '0,75x' (giữ tương thích legacy); 0 -> 'KL'
const formatWorkUnitSymbol = (workUnits) => {
  const u = Number(workUnits);
  if (!Number.isFinite(u)) return '';
  if (u >= 1) return 'x';
  if (u <= 0) return 'KL';
  return `${u.toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')}x`;
};

const formatDurationHoursMinutes = (hours) => {
  const numHours = Number(hours);
  if (!Number.isFinite(numHours) || numHours <= 0) return '0 giờ 00 phút';
  const totalMinutes = Math.round(numHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h} giờ ${String(m).padStart(2, '0')} phút`;
  if (h > 0) return `${h} giờ 00 phút`;
  return `${m} phút`;
};

const normalizeHolidayMultiplier = (value, fallback = 1.5) => {
  const numericValue = Number(value);
  return [1.5, 1.75, 2, 3].includes(numericValue) ? numericValue : fallback;
};

module.exports = {
  VN_TIME_ZONE,
  getVnDateString,
  isOvernightShift,
  normalizeClockTime,
  buildVnThreshold,
  calculateRawTotalHours,
  calculateOT,
  calculateAttendanceMetrics,
  calculateProRataWorkUnits,
  formatWorkUnitSymbol,
  formatDurationHoursMinutes,
  normalizeHolidayMultiplier,
};
