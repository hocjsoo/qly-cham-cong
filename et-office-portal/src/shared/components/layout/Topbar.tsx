import { useAuth } from "@/modules/auth/hooks/useAuth";

/** Topbar — search (Ctrl+K) và dark mode toggle sẽ bổ sung cùng module search/theme ở Phase 1 cuối. */
export function Topbar() {
  const { employee } = useAuth();

  return (
    <header className="h-16 border-b border-neutral-200 bg-white dark:bg-neutral-50 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="text-sm text-neutral-500">
        {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
      </div>
      {employee && (
        <div className="flex items-center gap-3">
          <img src={employee.avatarUrl} alt={employee.fullName} className="h-8 w-8 rounded-full object-cover" />
          <div className="text-sm">
            <div className="font-medium">{employee.fullName}</div>
            <div className="text-neutral-500 text-xs">{employee.position}</div>
          </div>
        </div>
      )}
    </header>
  );
}
