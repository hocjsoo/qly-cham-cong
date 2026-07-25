import type { Role } from "../constants/roles";

export interface Employee {
  id: string;
  companyId: string;
  officeId: string;
  workScheduleId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  employeeCode: string;
  position: string;
  employeeType: "official" | "probation" | "intern" | "contractor";
  department: string;
  joinDate: string; // ISO date
  dob: string; // ISO date
  dobMonthDay: string; // "MM-DD" — dùng cho query Birthday widget
  status: "active" | "inactive" | "resigned";
  role: Role;
  managerId?: string;
}

export interface Office {
  id: string;
  companyId: string;
  name: string;
  address: string;
  gps: { lat: number; lng: number };
  radiusMeters: number;
  workingHours: { start: string; end: string };
  status: "active" | "inactive";
}

export interface Company {
  id: string;
  name: string;
  logoUrl: string;
  website: string;
  primaryColor: string;
  timezone: string;
}

export interface WorkSchedule {
  id: string;
  companyId: string;
  name: string;
  checkInTime: string; // "09:00"
  checkOutTime: string; // "18:00"
  lateRuleOverride?: { slightLateUntil: string; lateUntil: string };
}

export interface Holiday {
  id: string;
  companyId: string;
  date: string; // "yyyy-mm-dd"
  name: string;
  isWorkingDay: boolean;
}
