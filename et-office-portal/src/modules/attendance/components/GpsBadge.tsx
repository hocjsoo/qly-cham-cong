import { MapPin } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface GpsBadgeProps {
  distanceMeters: number;
  withinRadius: boolean;
}

/** Cảnh báo GPS ngoài bán kính — CHỈ cảnh báo, không chặn chấm công (mục 9 kiến trúc). */
export function GpsBadge({ distanceMeters, withinRadius }: GpsBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium",
        withinRadius ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
      )}
    >
      <MapPin size={14} />
      {withinRadius
        ? `Trong văn phòng (${distanceMeters}m)`
        : `Ngoài văn phòng (${(distanceMeters / 1000).toFixed(1)}km)`}
    </div>
  );
}
