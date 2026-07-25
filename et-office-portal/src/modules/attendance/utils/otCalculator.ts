const DEFAULT_OT_STARTS_AFTER = "18:00";

/** Tính số phút OT dựa trên giờ check-out — chỉ dùng preview client, giá trị chính thức tính ở Cloud Function. */
export function calculateOtMinutes(checkOutTime: Date, otStartsAfter: string = DEFAULT_OT_STARTS_AFTER): number {
  const [h, m] = otStartsAfter.split(":").map(Number);
  const otStart = new Date(checkOutTime);
  otStart.setHours(h, m, 0, 0);

  if (checkOutTime <= otStart) return 0;
  return Math.round((checkOutTime.getTime() - otStart.getTime()) / 60000);
}
