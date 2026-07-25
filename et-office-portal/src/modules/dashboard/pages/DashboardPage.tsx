import { Users, UserCheck, UserX, Clock, Home, HardHat, TimerReset, Plane } from "lucide-react";
import { PageShell } from "@/shared/components/layout/PageShell";
import { StatCard } from "../components/StatCard";
import { ActivityFeed } from "../components/ActivityFeed";
import { useDashboardStats } from "../hooks/useDashboardStats";

/**
 * Dashboard cơ bản Phase 1. Drill-down (mục 9 kiến trúc) và widget Sinh nhật/
 * Kỷ niệm ngày vào làm sẽ hoàn thiện ở Phase 2 khi có projectStats/leave data
 * đầy đủ để lọc chính xác.
 */
export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  const cards = [
    { icon: Users, label: "Tổng nhân sự", value: stats?.totalEmployees ?? "—" },
    { icon: UserCheck, label: "Đã Check In", value: stats?.checkedIn ?? "—" },
    { icon: UserX, label: "Chưa Check In", value: stats?.notCheckedIn ?? "—" },
    { icon: Clock, label: "Đi muộn", value: stats?.late ?? "—" },
    { icon: Plane, label: "Nghỉ", value: stats?.onLeave ?? "—" },
    { icon: Home, label: "WFH", value: stats?.wfh ?? "—" },
    { icon: HardHat, label: "Đi công trình", value: stats?.siteVisit ?? "—" },
    { icon: TimerReset, label: "Đang OT", value: stats?.onOt ?? "—" },
  ];

  return (
    <PageShell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Đang tải số liệu...</p>}

      <ActivityFeed />
    </PageShell>
  );
}
