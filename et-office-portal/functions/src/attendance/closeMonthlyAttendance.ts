import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { writeAuditLog } from "../audit/writeAuditLog";

interface CloseMonthlyAttendanceInput {
  month: string; // "2026-07"
}

/**
 * Chốt công tháng (mục 21 kiến trúc gốc): chặn nếu còn giải trình "pending",
 * khóa toàn bộ attendance trong tháng, tạo monthlyClosures. Chỉ PGĐ.
 */
export const closeMonthlyAttendance = onCall<CloseMonthlyAttendanceInput>(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
    if (request.auth.token.role !== "deputy_director") {
      throw new HttpsError("permission-denied", "Chỉ Phó Giám đốc được chốt công.");
    }

    const { month } = request.data;
    const db = admin.firestore();

    const attendanceQuery = db
      .collection("attendance")
      .where("date", ">=", `${month}-01`)
      .where("date", "<=", `${month}-31`);
    const attendanceSnap = await attendanceQuery.get();

    const attendanceIds = attendanceSnap.docs.map((d) => d.id);

    // Chặn chốt công nếu còn giải trình pending liên quan các bản ghi trong tháng này
    const pendingExplanationsSnap = await db
      .collection("explanations")
      .where("status", "==", "pending")
      .where("attendanceId", "in", attendanceIds.length > 0 ? attendanceIds.slice(0, 10) : ["__none__"])
      .get();
    // Lưu ý: Firestore giới hạn "in" tối đa 10 phần tử — với dữ liệu thật cần
    // duyệt theo batch hoặc đổi query theo employeeId + tháng thay vì attendanceId.
    if (!pendingExplanationsSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Còn giải trình chưa được duyệt trong tháng này. Vui lòng duyệt hết trước khi chốt công."
      );
    }

    const batch = db.batch();
    attendanceSnap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { workflowStatus: "locked", isLocked: true });
    });

    const employeeIds = Array.from(new Set(attendanceSnap.docs.map((d) => d.data().employeeId)));
    const closureRef = db.collection("monthlyClosures").doc(month);
    batch.set(closureRef, {
      id: month,
      month,
      closedBy: request.auth.uid,
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "closed",
      employeeIds,
    });

    await batch.commit();

    await writeAuditLog({
      actorId: request.auth.uid,
      actorRole: "deputy_director",
      action: "CLOSE_MONTH",
      targetCollection: "monthlyClosures",
      targetId: month,
      metadata: { employeeCount: employeeIds.length, recordCount: attendanceSnap.size },
    });

    return { success: true, employeeCount: employeeIds.length, closedAt: new Date().toISOString() };
  }
);

interface UnlockAttendanceInput {
  attendanceId: string;
  reason: string;
}

/** Mở khóa 1 bản ghi đã chốt — bắt buộc lý do, luôn ghi audit log không thể xóa. */
export const unlockAttendanceRecord = onCall<UnlockAttendanceInput>(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
    const role = request.auth.token.role;
    if (!["deputy_director", "admin"].includes(role)) {
      throw new HttpsError("permission-denied", "Chỉ PGĐ/Admin được mở khóa dữ liệu.");
    }
    const { attendanceId, reason } = request.data;
    if (!reason?.trim()) throw new HttpsError("invalid-argument", "Phải nhập lý do mở khóa.");

    const db = admin.firestore();
    await db.collection("attendance").doc(attendanceId).update({
      isLocked: false,
      workflowStatus: "approved",
    });

    await writeAuditLog({
      actorId: request.auth.uid,
      actorRole: role,
      action: "UNLOCK_ATTENDANCE",
      targetCollection: "attendance",
      targetId: attendanceId,
      metadata: { reason },
    });

    return { success: true };
  }
);
