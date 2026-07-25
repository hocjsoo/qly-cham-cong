import { httpsCallable } from "firebase/functions";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db, functions } from "@/shared/lib/firebase";
import type { ExplanationRecord } from "@/modules/attendance/types";

interface SubmitExplanationPayload {
  attendanceId: string;
  type: "late" | "early_leave" | "ot";
  reason: string;
}

/** Ghi giải trình qua Cloud Function để tính đúng `editableUntil` (72h) và cập nhật workflowStatus. */
export async function submitExplanation(payload: SubmitExplanationPayload) {
  const fn = httpsCallable(functions, "submitExplanation");
  const res = await fn(payload);
  return res.data as { success: boolean; editableUntil: string };
}

export async function getMyExplanations(employeeId: string): Promise<ExplanationRecord[]> {
  const q = query(
    collection(db, "explanations"),
    where("employeeId", "==", employeeId),
    orderBy("editableUntil", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExplanationRecord));
}
