import type { LateStatus } from "@/shared/constants/attendanceStatus";
import { LATE_STATUS } from "@/shared/constants/attendanceStatus";

export interface LateRuleConfig {
  onTimeBefore: string; // "09:00"
  slightLateUntil: string; // "09:10"
  lateUntil: string; // "09:30"
}

export const DEFAULT_LATE_RULE: LateRuleConfig = {
  onTimeBefore: "09:00",
  slightLateUntil: "09:10",
  lateUntil: "09:30",
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Tính trạng thái đi muộn theo giờ check-in thực tế và ca làm việc áp dụng.
 * LƯU Ý: đây là hàm thuần (pure function), chỉ dùng để hiển thị preview ở client.
 * Giá trị CHÍNH THỨC ghi vào Firestore luôn do Cloud Function `onCheckIn` tính lại
 * bằng logic tương đương ở functions/src/utils/lateRules.ts — không tin giá trị
 * client tự tính (xem ADR-003).
 */
export function calculateLateStatus(checkInTime: Date, rule: LateRuleConfig = DEFAULT_LATE_RULE): LateStatus {
  const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  if (checkInMinutes <= toMinutes(rule.onTimeBefore)) return LATE_STATUS.ON_TIME;
  if (checkInMinutes <= toMinutes(rule.slightLateUntil)) return LATE_STATUS.SLIGHTLY_LATE;
  if (checkInMinutes <= toMinutes(rule.lateUntil)) return LATE_STATUS.LATE;
  return LATE_STATUS.VERY_LATE;
}
