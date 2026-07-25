import type { HTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}
