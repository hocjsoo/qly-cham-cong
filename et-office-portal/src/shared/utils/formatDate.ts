/** Định dạng ngày dùng chung toàn hệ thống — không format rải rác từng nơi. */
export function formatDateVN(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTimeVN(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Trả về "yyyy-mm-dd" — dùng làm document id cho attendance. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  return formatDateVN(date);
}
