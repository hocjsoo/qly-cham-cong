import { useState } from "react";
import { PageShell } from "@/shared/components/layout/PageShell";
import { TimesheetGrid } from "../components/TimesheetGrid";
import { useTimesheet } from "../hooks/useTimesheet";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { toDateKey } from "@/shared/utils/formatDate";

export function TimesheetPage() {
  const { employee } = useAuth();
  const [monthPrefix, setMonthPrefix] = useState(() => toDateKey(new Date()).slice(0, 7));
  const { data: records = [], isLoading } = useTimesheet(employee?.id, monthPrefix);

  return (
    <PageShell
      title="Bảng chấm công"
      actions={
        <input
          type="month"
          value={monthPrefix}
          onChange={(e) => setMonthPrefix(e.target.value)}
          className="rounded-sm border border-neutral-300 px-3 py-1.5 text-sm"
        />
      }
    >
      {isLoading ? (
        <p className="text-neutral-500 text-sm">Đang tải...</p>
      ) : (
        <TimesheetGrid records={records} />
      )}
    </PageShell>
  );
}
