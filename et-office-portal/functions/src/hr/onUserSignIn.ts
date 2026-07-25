import * as admin from "firebase-admin";
import { beforeUserSignedIn, HttpsError } from "firebase-functions/v2/identity";
import { writeAuditLog } from "../audit/writeAuditLog";

/**
 * Blocking function — chạy TRƯỚC khi Firebase cấp session cho user.
 * Đối chiếu email Google với `employees`; nếu hợp lệ, set custom claims
 * (role/employeeId/companyId/officeId) để Security Rules + UI dùng ngay.
 * Nếu không hợp lệ, CHẶN đăng nhập hoàn toàn (mục 4 kiến trúc gốc).
 */
export const onUserSignIn = beforeUserSignedIn({ region: "asia-southeast1" }, async (event) => {
  const email = event.data.email?.toLowerCase();
  const db = admin.firestore();

  if (!email) {
    throw new HttpsError("invalid-argument", "Không lấy được email từ tài khoản Google.");
  }

  const employeeSnap = await db.collection("employees").where("email", "==", email).limit(1).get();

  if (employeeSnap.empty || employeeSnap.docs[0].data().status !== "active") {
    await writeAuditLog({
      actorId: event.data.uid,
      actorRole: "unknown",
      action: "LOGIN_DENIED",
      targetCollection: "employees",
      targetId: email,
      metadata: { reason: employeeSnap.empty ? "not_found" : "inactive" },
    });
    throw new HttpsError("permission-denied", "Email chưa có trong hệ thống hoặc đã bị khóa.");
  }

  const employeeDoc = employeeSnap.docs[0];
  const employee = employeeDoc.data();

  // Đảm bảo document employees dùng đúng uid Firebase Auth làm id (map lần đầu đăng nhập)
  if (employeeDoc.id !== event.data.uid) {
    const newRef = db.collection("employees").doc(event.data.uid);
    await newRef.set({ ...employee, id: event.data.uid }, { merge: true });
    await employeeDoc.ref.delete();
  }

  return {
    customClaims: {
      role: employee.role,
      employeeId: event.data.uid,
      companyId: employee.companyId,
      officeId: employee.officeId,
    },
  };
});
