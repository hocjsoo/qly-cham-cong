import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { haversineDistanceMeters } from "../utils/gpsDistance";
import { calculateLateStatus, DEFAULT_LATE_RULE, type LateRuleConfig } from "../utils/lateRules";
import { writeAuditLog } from "../audit/writeAuditLog";

interface CheckInInput {
  lat: number;
  lng: number;
  deviceId: string;
  userAgent: string;
}

/**
 * Toàn bộ tính toán (khoảng cách GPS, lateStatus, flags chống gian lận) chạy ở đây,
 * KHÔNG tin dữ liệu tính sẵn từ client (ADR-003). Dùng server timestamp cho mọi mốc giờ.
 */
export const onCheckIn = onCall<CheckInInput>({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const employeeId = request.auth.uid;
  const { lat, lng, deviceId, userAgent } = request.data;

  const db = admin.firestore();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const attendanceId = `${employeeId}_${dateKey}`;
  const attendanceRef = db.collection("attendance").doc(attendanceId);

  const existing = await attendanceRef.get();
  if (existing.exists && existing.data()?.checkIn) {
    throw new HttpsError("already-exists", "Bạn đã check in hôm nay rồi.");
  }

  const employeeSnap = await db.collection("employees").doc(employeeId).get();
  const employee = employeeSnap.data();
  if (!employee || employee.status !== "active") {
    throw new HttpsError("failed-precondition", "Tài khoản không hợp lệ hoặc đã bị khóa.");
  }

  // Ngày lễ: không tính đi muộn / vắng mặt (mục 3 bổ sung — holidays)
  const holidaySnap = await db
    .collection("holidays")
    .where("companyId", "==", employee.companyId)
    .where("date", "==", dateKey)
    .limit(1)
    .get();
  const isHoliday = !holidaySnap.empty && holidaySnap.docs[0].data().isWorkingDay === false;

  const officeSnap = await db.collection("offices").doc(employee.officeId).get();
  const office = officeSnap.data();
  if (!office) throw new HttpsError("failed-precondition", "Không tìm thấy văn phòng của nhân sự.");

  const distanceFromOffice = haversineDistanceMeters({ lat, lng }, office.gps);
  const withinRadius = distanceFromOffice <= office.radiusMeters;

  let lateStatus: string | null = null;
  if (!isHoliday) {
    let rule: LateRuleConfig = DEFAULT_LATE_RULE;
    if (employee.workScheduleId) {
      const scheduleSnap = await db.collection("workSchedules").doc(employee.workScheduleId).get();
      const schedule = scheduleSnap.data();
      if (schedule?.lateRuleOverride) {
        rule = { onTimeBefore: schedule.checkInTime, ...schedule.lateRuleOverride };
      } else if (schedule?.checkInTime) {
        rule = { ...DEFAULT_LATE_RULE, onTimeBefore: schedule.checkInTime };
      }
    }
    lateStatus = calculateLateStatus(now, rule);
  }

  // Phát hiện thiết bị lạ — so với deviceId lần check-in gần nhất (đơn giản hoá Phase 1)
  const lastAttendanceSnap = await db
    .collection("attendance")
    .where("employeeId", "==", employeeId)
    .orderBy("date", "desc")
    .limit(1)
    .get();
  const lastDeviceId = lastAttendanceSnap.docs[0]?.data()?.checkIn?.deviceId;
  const newDevice = !!lastDeviceId && lastDeviceId !== deviceId;

  const checkInEvent = {
    time: now.toISOString(),
    gps: { lat, lng },
    distanceFromOffice,
    withinRadius,
    device: deviceId,
    userAgent,
  };

  await attendanceRef.set(
    {
      id: attendanceId,
      employeeId,
      date: dateKey,
      checkIn: checkInEvent,
      checkOut: null,
      lateStatus,
      otMinutes: 0,
      workStatus: isHoliday ? "holiday" : "office",
      workflowStatus: "draft",
      timesheetSymbol: isHoliday ? "K" : lateStatusToSymbol(lateStatus),
      flags: { outsideGps: !withinRadius, newDevice, unusualIp: false },
      isLocked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("activityFeedEvents").add({
    type: "check_in",
    employeeId,
    employeeName: employee.fullName,
    timestamp: now.toISOString(),
    meta: { withinRadius, lateStatus },
  });

  await writeAuditLog({
    actorId: employeeId,
    actorRole: employee.role,
    action: "CHECK_IN",
    targetCollection: "attendance",
    targetId: attendanceId,
    metadata: { distanceFromOffice, withinRadius, lateStatus, newDevice },
  });

  return { success: true, lateStatus: lateStatus ?? "holiday", distanceFromOffice, withinRadius };
});

function lateStatusToSymbol(status: string | null): string {
  switch (status) {
    case "on_time":
      return "x";
    case "slightly_late":
      return "0.75x";
    case "late":
    case "very_late":
      return "0.5x";
    default:
      return "x";
  }
}
