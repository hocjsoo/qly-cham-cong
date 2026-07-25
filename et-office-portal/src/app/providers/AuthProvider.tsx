import { createContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/shared/lib/firebase";
import { fetchEmployeeByUid } from "@/modules/auth/services/authService";
import type { AuthState } from "@/modules/auth/types";
import type { Employee } from "@/shared/types";

interface AuthContextValue extends AuthState {}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Nguồn sự thật duy nhất cho trạng thái đăng nhập.
 * Việc "email có trong employees hay không" đã được Cloud Function `onUserSignIn`
 * (blocking function, chạy TRƯỚC khi Firebase cấp session) xác thực — nếu email
 * không hợp lệ, đăng nhập sẽ bị chặn từ tầng Auth, không tới được đây.
 * Ở đây ta chỉ cần đọc lại hồ sơ để hiển thị UI.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      setIsLoading(true);
      if (!user) {
        setFirebaseUid(null);
        setEmployee(null);
        setIsLoading(false);
        return;
      }
      setFirebaseUid(user.uid);
      const emp = await fetchEmployeeByUid(user.uid);
      setEmployee(emp);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const value: AuthContextValue = {
    firebaseUid,
    employee,
    isLoading,
    isAuthenticated: !!firebaseUid && !!employee,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
