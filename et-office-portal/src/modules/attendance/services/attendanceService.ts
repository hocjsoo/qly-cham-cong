import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, functions } from "@/shared/lib/firebase";
import { toDateKey } from "@/shared/utils/formatDate";
import type { AttendanceRecord } from "../types";

interface CheckInPayload {
  lat: number;
  lng: number;
  deviceId: string;
  userAgent: string;
}

interface CheckInResult {
  success: boolean;
  lateStatus: string;
  distanceFromOffice: number;
  withinRadius: boolean;
}

interface CheckOutResult {
  success: boolean;
  otMinutes: number;
  workflowStatus: string;
}

/**
 * Toàn bộ logic tính toán (GPS distance, lateStatus, otMinutes, flags) chạy ở
 * Cloud Function `onCheckIn`/`onCheckOut` — service này chỉ là lớp gọi callable,
 * KHÔNG ghi thẳng Firestore. Xem ADR-003 và docs/04-api-cloud-functions.md.
 */
export async function checkIn(payload: CheckInPayload): Promise<CheckInResult> {
  const fn = httpsCallable<CheckInPayload, CheckInResult>(functions, "onCheckIn");
  const res = await fn(payload);
  return res.data;
}

export async function checkOut(payload: CheckInPayload): Promise<CheckOutResult> {
  const fn = httpsCallable<CheckInPayload, CheckOutResult>(functions, "onCheckOut");
  const res = await fn(payload);
  return res.data;
}

export async function getTodayAttendance(employeeId: string): Promise<AttendanceRecord | null> {
  const id = `${employeeId}_${toDateKey(new Date())}`;
  const snap = await getDoc(doc(db, "attendance", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AttendanceRecord;
}

export async function getRecentAttendance(employeeId: string, days = 7): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    where("employeeId", "==", employeeId),
    orderBy("date", "desc"),
    limit(days)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
}

export async function getMonthAttendance(employeeId: string, monthPrefix: string): Promise<AttendanceRecord[]> {
  // monthPrefix dạng "2026-07" — lọc thêm ở client vì Firestore không hỗ trợ "startsWith" native cho field date dạng string ngoài range query
  const q = query(
    collection(db, "attendance"),
    where("employeeId", "==", employeeId),
    where("date", ">=", `${monthPrefix}-01`),
    where("date", "<=", `${monthPrefix}-31`),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
}
