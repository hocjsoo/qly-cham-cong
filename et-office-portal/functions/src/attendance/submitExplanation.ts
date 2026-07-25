import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { writeAuditLog } from "../audit/writeAuditLog";

interface SubmitExplanationInput {
  attendanceId: string;
  type: "late" | "early_leave" | "ot";
  reason: string;
}

const EXPLANATION_WINDOW_HOURS = 72;

export const submitExplanation = onCall<SubmitExplanationInput>({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const employeeId = request.auth.uid;
  const { attendanceId, type, reason } = request.data;

  const db = admin.firestore();
  const attendanceSnap = await db.collection("attendance").doc(attendanceId).get();
  const attendance = attendanceSnap.data();
  if (!attendance || attendance.employeeId !== employeeId) {
    throw new HttpsError("permission-denied", "Không thể giải trình cho bản ghi này.");
  }

  const referenceTime = type === "early_leave" ? attendance.checkOut?.time : attendance.checkIn?.time;
  if (!referenceTime) throw new HttpsError("failed-precondition", "Chưa có dữ liệu chấm công để giải trình.");

  const editableUntil = new Date(new Date(referenceTime).getTime() + EXPLANATION_WINDOW_HOURS * 3600 * 1000);

  const explanationRef = db.collection("explanations").doc();
  await explanationRef.set({
    id: explanationRef.id,
    attendanceId,
    employeeId,
    type,
    reason,
    status: "pending",
    editableUntil: editableUntil.toISOString(),
    isLocked: false,
    editedByAdmin: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("attendance").doc(attendanceId).update({
    workflowStatus: "need_explanation",
  });

  await writeAuditLog({
    actorId: employeeId,
    actorRole: "employee",
    action: "SUBMIT_EXPLANATION",
    targetCollection: "explanations",
    targetId: explanationRef.id,
    metadata: { attendanceId, type },
  });

  return { success: true, editableUntil: editableUntil.toISOString() };
});
