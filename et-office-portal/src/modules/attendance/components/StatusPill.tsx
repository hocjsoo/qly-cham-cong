import { LATE_STATUS_COLOR, LATE_STATUS_LABEL, type LateStatus } from "@/shared/constants/attendanceStatus";
import { cn } from "@/shared/utils/cn";

export function StatusPill({ status }: { status: LateStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium", LATE_STATUS_COLOR[status])}>
      {LATE_STATUS_LABEL[status]}
    </span>
  );
}
