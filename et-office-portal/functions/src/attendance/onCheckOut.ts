import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { haversineDistanceMeters } from "../utils/gpsDistance";
import { calculateOtMinutes } from "../utils/lateRules";
import { writeAuditLog } from "../audit/writeAuditLog";

interface CheckOutInput {
  lat: number;
  lng: number;
  deviceId: string;
  userAgent: string;
}

export const onCheckOut = onCall<CheckOutInput>({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const employeeId = request.auth.uid;
  const { lat, lng, deviceId, userAgent } = request.data;

  const db = admin.firestore();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const attendanceId = `${employeeId}_${dateKey}`;
  const attendanceRef = db.collection("attendance").doc(attendanceId);

  const attendanceSnap = await attendanceRef.get();
  const attendance = attendanceSnap.data();
  if (!attendance || !attendance.checkIn) {
    throw new HttpsError("failed-precondition", "Bạn chưa check in hôm nay.");
  }
  if (attendance.checkOut) {
    throw new HttpsError("already-exists", "Bạn đã check out hôm nay rồi.");
  }

  const employeeSnap = await db.collection("employees").doc(employeeId).get();
  const employee = employeeSnap.data()!;

  const officeSnap = await db.collection("offices").doc(employee.officeId).get();
  const office = officeSnap.data()!;

  const distanceFromOffice = haversineDistanceMeters({ lat, lng }, office.gps);
  const withinRadius = distanceFromOffice <= office.radiusMeters;

  const otSettingSnap = await db.collection("settings").doc("otRule").get();
  const otStartsAfter = otSettingSnap.data()?.otStartsAfter ?? "18:00";
  const otMinutes = calculateOtMinutes(now, otStartsAfter);

  const checkOutEvent = {
    time: now.toISOString(),
    gps: { lat, lng },
    distanceFromOffice,
    withinRadius,
    device: deviceId,
    userAgent,
  };

  const needExplanation = attendance.lateStatus && attendance.lateStatus !== "on_time";
  const newWorkflowStatus = needExplanation ? "need_explanation" : "submitted";

  await attendanceRef.update({
    checkOut: checkOutEvent,
    otMinutes,
    workflowStatus: newWorkflowStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("activityFeedEvents").add({
    type: "check_out",
    employeeId,
    employeeName: employee.fullName,
    timestamp: now.toISOString(),
    meta: { otMinutes },
  });

  await writeAuditLog({
    actorId: employeeId,
    actorRole: employee.role,
    action: "CHECK_OUT",
    targetCollection: "attendance",
    targetId: attendanceId,
    metadata: { otMinutes, withinRadius },
  });

  return { success: true, otMinutes, workflowStatus: newWorkflowStatus };
});
