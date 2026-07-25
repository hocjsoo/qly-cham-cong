import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { writeAuditLog } from "../audit/writeAuditLog";

interface ReviewExplanationInput {
  explanationId: string;
  decision: "approved" | "rejected";
  note?: string;
}

/** Chỉ PGĐ/Admin — quyết định thực thi qua custom claims đã set lúc onUserSignIn. */
export const reviewExplanation = onCall<ReviewExplanationInput>({ region: "asia-southeast1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const role = request.auth.token.role;
  if (!["deputy_director", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Chỉ PGĐ/Admin được duyệt giải trình.");
  }

  const { explanationId, decision, note } = request.data;
  const db = admin.firestore();
  const explanationRef = db.collection("explanations").doc(explanationId);
  const explanationSnap = await explanationRef.get();
  const explanation = explanationSnap.data();
  if (!explanation) throw new HttpsError("not-found", "Không tìm thấy giải trình.");

  await explanationRef.update({
    status: decision,
    reviewNote: note ?? "",
    reviewedBy: request.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("attendance").doc(explanation.attendanceId).update({
    workflowStatus: decision === "approved" ? "approved" : "rejected",
  });

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: role,
    action: decision === "approved" ? "APPROVE_EXPLANATION" : "REJECT_EXPLANATION",
    targetCollection: "explanations",
    targetId: explanationId,
    metadata: { note },
  });

  return { success: true };
});
