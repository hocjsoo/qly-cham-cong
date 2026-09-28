// client/src/utils/dateVN.js
// Thư viện chuẩn hóa xử lý ngày giờ & múi giờ Việt Nam (+07:00 Asia/Ho_Chi_Minh)

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const DAY_NAMES_VI = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
export const SHORT_WEEKDAY_NAMES_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo giờ Việt Nam
 * @param {Date|string|number} [date=new Date()]
 * @returns {string}
 */
export function getTodayVnDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE });
}

/**
 * Định dạng ngày YYYY-MM-DD sang DD/MM/YYYY
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateVN(isoDate) {
  if (!isoDate) return '—';
  const parts = String(isoDate).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
}

/**
 * Định dạng giờ HH:mm theo giờ Việt Nam
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatTimeVN(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', { timeZone: VN_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

/**
 * Lấy ngày Thứ Hai của tuần hiện tại theo giờ VN (YYYY-MM-DD)
 * @returns {string}
 */
export function getCurrentMondayVN() {
  const nowVN = getTodayVnDateString();
  const date = new Date(`${nowVN}T12:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  const monday = new Date(date.getTime() + (1 - day) * 86400000);
  return monday.toISOString().slice(0, 10);
}
