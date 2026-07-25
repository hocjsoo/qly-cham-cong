import { NavLink } from "react-router-dom";
import { LayoutDashboard, Clock, Table2, MessageSquareWarning } from "lucide-react";
import { ROUTES } from "@/shared/constants/routes";
import { cn } from "@/shared/utils/cn";

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.CHECKIN, label: "Chấm công", icon: Clock },
  { to: ROUTES.TIMESHEET, label: "Bảng công", icon: Table2 },
  { to: ROUTES.EXPLANATION, label: "Giải trình", icon: MessageSquareWarning },
];

/** Sidebar chính — module Attendance là phần đầu tiên, sẽ nối thêm Projects/HR/... ở Phase 2-3. */
export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white dark:bg-neutral-50 h-screen sticky top-0 flex flex-col">
      <div className="h-16 flex items-center px-5 border-b border-neutral-200">
        <span className="font-heading font-semibold text-primary">ET Office Portal</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === ROUTES.DASHBOARD}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-neutral-700 hover:bg-neutral-100"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
