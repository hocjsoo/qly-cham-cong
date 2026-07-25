import { signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/shared/lib/firebase";
import type { Employee } from "@/shared/types";

/**
 * Đăng nhập Google. Việc đối chiếu email với `employees` và cấp custom claims
 * thực chất diễn ra ở Cloud Function `onUserSignIn` (blocking function) —
 * xem docs/04-api-cloud-functions.md mục 1. Ở client, sau khi login thành công
 * ta chỉ đọc lại hồ sơ nhân sự tương ứng để hiển thị UI.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut() {
  await fbSignOut(auth);
}

export async function fetchEmployeeByUid(uid: string): Promise<Employee | null> {
  const snap = await getDoc(doc(db, "employees", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Employee;
}
