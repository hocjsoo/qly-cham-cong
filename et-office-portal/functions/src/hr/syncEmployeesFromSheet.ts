import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { writeAuditLog } from "../audit/writeAuditLog";

interface SyncResult {
  added: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

const REQUIRED_COLUMNS = [
  "email",
  "fullName",
  "employeeCode",
  "position",
  "department",
  "employeeType",
] as const;

/**
 * Đồng bộ nhân sự từ Google Sheet (mục 5 kiến trúc gốc): Sheet chỉ là Master Data,
 * import 1 chiều vào Firestore qua Service Account — KHÔNG đọc trực tiếp Sheet mỗi
 * lần mở web. Chỉ Admin được gọi function này.
 */
export const syncEmployeesFromSheet = onCall<{ sheetId?: string }>(
  { region: "asia-southeast1", timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
    if (request.auth.token.role !== "admin") {
      throw new HttpsError("permission-denied", "Chỉ Admin được đồng bộ nhân sự.");
    }

    const db = admin.firestore();
    const settingSnap = await db.collection("settings").doc("hrSync").get();
    const sheetId = request.data.sheetId ?? settingSnap.data()?.sheetId;
    if (!sheetId) throw new HttpsError("failed-precondition", "Chưa cấu hình Google Sheet nguồn.");

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A1:Z1000",
    });

    const rows = sheetRes.data.values ?? [];
    if (rows.length === 0) throw new HttpsError("failed-precondition", "Google Sheet trống.");

    const header = rows[0].map((h) => String(h).trim());
    const missingCols = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missingCols.length > 0) {
      throw new HttpsError("invalid-argument", `Thiếu cột bắt buộc: ${missingCols.join(", ")}`);
    }

    const result: SyncResult = { added: 0, updated: 0, deactivated: 0, errors: [] };
    const sheetEmails = new Set<string>();
    const batch = db.batch();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, string> = {};
      header.forEach((col, idx) => (record[col] = row[idx] ?? ""));

      const email = record.email?.toLowerCase().trim();
      if (!email) {
        result.errors.push(`Dòng ${i + 1}: thiếu email`);
        continue;
      }
      sheetEmails.add(email);

      const existingSnap = await db.collection("employees").where("email", "==", email).limit(1).get();

      if (existingSnap.empty) {
        const newRef = db.collection("employees").doc();
        batch.set(newRef, {
          ...defaultEmployeeShape(record),
          id: newRef.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        result.added++;
      } else {
        batch.update(existingSnap.docs[0].ref, {
          fullName: record.fullName,
          position: record.position,
          department: record.department,
          employeeType: record.employeeType,
          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        result.updated++;
      }
    }

    // Khóa nhân sự có trong hệ thống nhưng không còn trong Sheet (coi như nghỉ việc)
    const allActiveSnap = await db.collection("employees").where("status", "==", "active").get();
    allActiveSnap.docs.forEach((docSnap) => {
      const email = docSnap.data().email;
      if (!sheetEmails.has(email)) {
        batch.update(docSnap.ref, { status: "inactive", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        result.deactivated++;
      }
    });

    await batch.commit();

    await writeAuditLog({
      actorId: request.auth.uid,
      actorRole: "admin",
      action: "SYNC_EMPLOYEES",
      targetCollection: "employees",
      targetId: sheetId,
      metadata: result,
    });

    return result;
  }
);

function defaultEmployeeShape(record: Record<string, string>) {
  return {
    email: record.email.toLowerCase().trim(),
    fullName: record.fullName,
    employeeCode: record.employeeCode,
    position: record.position,
    department: record.department,
    employeeType: record.employeeType || "official",
    status: "active",
    role: "employee",
    avatarUrl: "",
    // companyId/officeId/workScheduleId mặc định cần cấu hình sẵn ở settings/hrSync
    // hoặc bổ sung cột riêng trong Sheet nếu công ty có nhiều văn phòng — xem docs/10-admin-manual.md
  };
}
