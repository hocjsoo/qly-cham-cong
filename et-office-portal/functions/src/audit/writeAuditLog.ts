import * as admin from "firebase-admin";

interface AuditLogInput {
  actorId: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Helper dùng chung cho MỌI Cloud Function ghi/sửa dữ liệu nghiệp vụ.
 * auditLogs là append-only — Security Rules chặn client write tuyệt đối,
 * chỉ Admin SDK (tức là chỉ Cloud Function) ghi được. Xem docs/03-firestore-security-rules.md.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const db = admin.firestore();
  await db.collection("auditLogs").add({
    ...input,
    metadata: input.metadata ?? {},
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}
