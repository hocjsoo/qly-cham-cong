import { useContext } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";

/** Hook truy cập trạng thái đăng nhập + hồ sơ nhân sự hiện tại. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong <AuthProvider>");
  return ctx;
}
