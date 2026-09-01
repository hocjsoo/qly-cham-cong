const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET = '+07:00';

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

const calculateRawTotalHours = (checkInDate, checkOutDate, precision = 1) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const safePrecision = Number.isInteger(precision) && precision >= 0 && precision <= 3 ? precision : 1;
  return Number(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(safePrecision));
};

const calculateOT = (checkInDate, checkOutDate, otStartTime = '18:30') => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return 0;

  const otThreshold = buildVnThreshold(checkOut, otStartTime, '18:30');
  if (!otThreshold || checkOut <= otThreshold) return 0;

  const otStartMs = Math.max(checkIn.getTime(), otThreshold.getTime());
  return Math.max(0, Number(((checkOut.getTime() - otStartMs) / (1000 * 60 * 60)).toFixed(1)));
};

const calculateAttendanceMetrics = (
  checkInDate,
  checkOutDate,
  { workEndTime = '18:30', otStartTime = '18:30', totalPrecision = 1 } = {}
) => {
  const checkOut = new Date(checkOutDate);
  const workEndThreshold = buildVnThreshold(checkOut, workEndTime, '18:30');
  const isValidCheckOut = !Number.isNaN(checkOut.getTime());
  const isEarlyLeave = Boolean(isValidCheckOut && workEndThreshold && checkOut < workEndThreshold);

  return {
    totalHours: calculateRawTotalHours(checkInDate, checkOutDate, totalPrecision),
    otHours: calculateOT(checkInDate, checkOutDate, otStartTime),
    isEarlyLeave,
    earlyMinutes: isEarlyLeave
      ? Math.max(0, Math.ceil((workEndThreshold.getTime() - checkOut.getTime()) / (1000 * 60)))
      : 0,
  };
};

const normalizeHolidayMultiplier = (value, fallback = 1.5) => {
  const numericValue = Number(value);
  return [1.5, 2, 3].includes(numericValue) ? numericValue : fallback;
};

module.exports = {
  VN_TIME_ZONE,
  normalizeClockTime,
  calculateRawTotalHours,
  calculateOT,
  calculateAttendanceMetrics,
  normalizeHolidayMultiplier,
};
