import { useEffect, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/lib/firebase";

/**
 * Đọc settings/theme 1 lần khi app khởi động, ghi đè CSS variables mặc định
 * (xem src/styles/globals.css) — đổi bộ nhận diện không cần deploy lại code.
 * (docs/00-architecture.md mục 8.3 / docs/05-design-system.md)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    async function loadTheme() {
      try {
        const snap = await getDoc(doc(db, "settings", "theme"));
        if (!snap.exists()) return;
        const theme = snap.data() as Record<string, string>;
        const root = document.documentElement;
        if (theme.primary) root.style.setProperty("--color-primary", theme.primary);
        if (theme.secondary) root.style.setProperty("--color-secondary", theme.secondary);
        if (theme.success) root.style.setProperty("--color-success", theme.success);
        if (theme.warning) root.style.setProperty("--color-warning", theme.warning);
        if (theme.danger) root.style.setProperty("--color-danger", theme.danger);
        if (theme.fontHeading) root.style.setProperty("--font-heading", theme.fontHeading);
        if (theme.fontBody) root.style.setProperty("--font-body", theme.fontBody);
      } catch {
        // Nếu chưa có settings/theme (lần chạy đầu), giữ nguyên giá trị mặc định trong globals.css
      }
    }
    loadTheme();
  }, []);

  return <>{children}</>;
}
