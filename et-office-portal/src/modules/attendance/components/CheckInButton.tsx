import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { GpsBadge } from "./GpsBadge";
import { useCheckIn } from "../hooks/useCheckIn";
import { useCheckOut } from "../hooks/useCheckOut";
import { useTodayAttendance } from "../hooks/useTimesheet";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { formatTimeVN } from "@/shared/utils/formatDate";

/** Card trung tâm trang Chấm công — 2 nút to CHECK IN / CHECK OUT theo đúng yêu cầu mục 8 kiến trúc. */
export function CheckInButton() {
  const { employee } = useAuth();
  const { data: today, isLoading } = useTodayAttendance(employee?.id);
  const checkInMutation = useCheckIn(employee?.id);
  const checkOutMutation = useCheckOut(employee?.id);
  const [lastGps, setLastGps] = useState<{ distanceMeters: number; withinRadius: boolean } | null>(null);

  const hasCheckedIn = !!today?.checkIn;
  const hasCheckedOut = !!today?.checkOut;

  async function handleCheckIn() {
    const res = await checkInMutation.mutateAsync();
    setLastGps({ distanceMeters: res.distanceFromOffice, withinRadius: res.withinRadius });
  }

  async function handleCheckOut() {
    await checkOutMutation.mutateAsync();
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="text-4xl font-heading font-semibold tabular-nums">
        {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
      </div>

      <div className="flex gap-4">
        <Button
          size="lg"
          onClick={handleCheckIn}
          disabled={isLoading || hasCheckedIn || checkInMutation.isPending}
        >
          {checkInMutation.isPending ? "Đang xử lý..." : "CHECK IN"}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={handleCheckOut}
          disabled={isLoading || !hasCheckedIn || hasCheckedOut || checkOutMutation.isPending}
        >
          {checkOutMutation.isPending ? "Đang xử lý..." : "CHECK OUT"}
        </Button>
      </div>

      {lastGps && <GpsBadge distanceMeters={lastGps.distanceMeters} withinRadius={lastGps.withinRadius} />}

      {checkInMutation.isError && (
        <p className="text-sm text-danger">Không thể check in. Vui lòng bật định vị GPS và thử lại.</p>
      )}

      {hasCheckedIn && (
        <div className="text-sm text-neutral-500 text-center">
          Đã check in lúc {formatTimeVN(new Date(today!.checkIn!.time))}
          {hasCheckedOut && ` — check out lúc ${formatTimeVN(new Date(today!.checkOut!.time))}`}
        </div>
      )}
    </div>
  );
}
