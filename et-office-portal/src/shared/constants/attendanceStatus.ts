export const LATE_STATUS = {
  ON_TIME: "on_time",
  SLIGHTLY_LATE: "slightly_late",
  LATE: "late",
  VERY_LATE: "very_late",
} as const;
export type LateStatus = (typeof LATE_STATUS)[keyof typeof LATE_STATUS];

export const WORK_STATUS = {
  OFFICE: "office",
  WFH: "wfh",
  SITE_VISIT: "site_visit",
  BUSINESS_TRIP: "business_trip",
  ANNUAL_LEAVE: "annual_leave",
  SICK_LEAVE: "sick_leave",
  UNPAID_LEAVE: "unpaid_leave",
  HOLIDAY: "holiday",
  OTHER: "other",
} as const;
export type WorkStatus = (typeof WORK_STATUS)[keyof typeof WORK_STATUS];

export const WORKFLOW_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  NEED_EXPLANATION: "need_explanation",
  APPROVED: "approved",
  REJECTED: "rejected",
  LOCKED: "locked",
} as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

/** Màu trạng thái — ánh xạ cố định theo docs/05-design-system.md mục 1 */
export const LATE_STATUS_COLOR: Record<LateStatus, string> = {
  on_time: "text-success bg-success/10",
  slightly_late: "text-warning bg-warning/10",
  late: "text-warning bg-warning/20",
  very_late: "text-danger bg-danger/10",
};

export const LATE_STATUS_LABEL: Record<LateStatus, string> = {
  on_time: "Đúng giờ",
  slightly_late: "Muộn nhẹ",
  late: "Muộn",
  very_late: "Muộn nhiều",
};

/** Ký hiệu bảng công — mặc định, thực tế load từ settings/timesheetSymbols */
export const DEFAULT_TIMESHEET_SYMBOLS: Record<string, string> = {
  on_time: "x",
  slightly_late: "0.75x",
  late: "0.5x",
  wfh: "WFH",
  annual_leave: "P",
  sick_leave: "O",
  unpaid_leave: "KL",
  site_visit: "CT1",
  business_trip: "CT2",
  other: "K",
};
