export type LateStatus = "on_time" | "slightly_late" | "late" | "very_late";

export interface LateRuleConfig {
  onTimeBefore: string;
  slightLateUntil: string;
  lateUntil: string;
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

/** Nguồn sự thật DUY NHẤT cho lateStatus — chạy server-side, dùng server timestamp (ADR-003). */
export function calculateLateStatus(checkInTime: Date, rule: LateRuleConfig = DEFAULT_LATE_RULE): LateStatus {
  const minutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  if (minutes <= toMinutes(rule.onTimeBefore)) return "on_time";
  if (minutes <= toMinutes(rule.slightLateUntil)) return "slightly_late";
  if (minutes <= toMinutes(rule.lateUntil)) return "late";
  return "very_late";
}

export function calculateOtMinutes(checkOutTime: Date, otStartsAfter = "18:00"): number {
  const [h, m] = otStartsAfter.split(":").map(Number);
  const otStart = new Date(checkOutTime);
  otStart.setHours(h, m, 0, 0);
  if (checkOutTime <= otStart) return 0;
  return Math.round((checkOutTime.getTime() - otStart.getTime()) / 60000);
}
