import { useState } from "react";
import type { AttendanceRecord } from "../types";
import { LATE_STATUS_COLOR } from "@/shared/constants/attendanceStatus";
import { cn } from "@/shared/utils/cn";

interface TimesheetGridProps {
  records: AttendanceRecord[];
  onSelectDay?: (record: AttendanceRecord) => void;
}

/**
 * Bảng chấm công dạng Excel kế thừa (mục 17 kiến trúc gốc): mỗi hàng = 1 ngày trong tháng,
 * ký hiệu (x, 0.75x, WFH, P, O, KL, CT1, CT2, K) sinh tự động từ Check In/Out.
 * Click 1 hàng để xem chi tiết (giờ vào/ra, GPS, OT, lý do, Daily Report).
 */
export function TimesheetGrid({ records, onSelectDay }: TimesheetGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200">
      <table className="w-full text-sm">
        <thead className="bg-neutral-100 sticky top-0">
          <tr className="text-left text-neutral-500">
            <th className="px-4 py-2 font-medium">Ngày</th>
            <th className="px-4 py-2 font-medium">Giờ vào</th>
            <th className="px-4 py-2 font-medium">Giờ ra</th>
            <th className="px-4 py-2 font-medium">Ký hiệu</th>
            <th className="px-4 py-2 font-medium">OT (phút)</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.id}
              onClick={() => {
                setSelectedId(r.id);
                onSelectDay?.(r);
              }}
              className={cn(
                "border-t border-neutral-200 cursor-pointer hover:bg-neutral-50",
                selectedId === r.id && "bg-primary/5"
              )}
            >
              <td className="px-4 py-2">{r.date}</td>
              <td className="px-4 py-2 tabular-nums">
                {r.checkIn ? new Date(r.checkIn.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {r.checkOut ? new Date(r.checkOut.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "inline-flex rounded-sm px-2 py-0.5 font-mono text-xs",
                    r.lateStatus ? LATE_STATUS_COLOR[r.lateStatus] : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {r.timesheetSymbol}
                </span>
              </td>
              <td className="px-4 py-2 tabular-nums">{r.otMinutes > 0 ? r.otMinutes : "—"}</td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                Chưa có dữ liệu chấm công trong tháng này.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
