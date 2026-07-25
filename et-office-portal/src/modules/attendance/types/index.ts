import type { LateStatus, WorkStatus, WorkflowStatus } from "@/shared/constants/attendanceStatus";

export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface CheckEvent {
  time: string; // ISO timestamp
  gps: GpsPoint;
  distanceFromOffice: number; // mét
  withinRadius: boolean;
  device: string;
  userAgent: string;
  ip?: string;
  selfieUrl?: string;
}

export interface AttendanceFlags {
  outsideGps: boolean;
  newDevice: boolean;
  unusualIp: boolean;
}

export interface AttendanceRecord {
  id: string; // `${employeeId}_${yyyy-mm-dd}`
  employeeId: string;
  date: string;
  checkIn: CheckEvent | null;
  checkOut: CheckEvent | null;
  lateStatus: LateStatus | null;
  otMinutes: number;
  workStatus: WorkStatus;
  workflowStatus: WorkflowStatus;
  timesheetSymbol: string;
  flags: AttendanceFlags;
  isLocked: boolean;
}

export interface ExplanationRecord {
  id: string;
  attendanceId: string;
  employeeId: string;
  type: "late" | "early_leave" | "ot";
  reason: string;
  editableUntil: string; // ISO
  isLocked: boolean;
  editedByAdmin: boolean;
  status: "pending" | "approved" | "rejected";
}
