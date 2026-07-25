import type { LucideIcon } from "lucide-react";
import { Card } from "@/shared/components/ui/Card";
import { cn } from "@/shared/utils/cn";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  onClick?: () => void;
}

/**
 * StatCard clickable — toàn bộ card là target bấm (mục 9 kiến trúc: Dashboard PGĐ
 * drill-down). Ở Phase 1, onClick optional; Phase 2 sẽ nối sang trang danh sách
 * lọc sẵn theo filterQuery tương ứng.
 */
export function StatCard({ icon: Icon, label, value, onClick }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Card className={cn("p-0 overflow-hidden", onClick && "hover:border-primary transition-colors")}>
      <Wrapper onClick={onClick} className="flex flex-col gap-2 w-full text-left p-4">
        <Icon size={22} className="text-primary" />
        <div className="text-2xl font-heading font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-neutral-500">{label}</div>
      </Wrapper>
    </Card>
  );
}
