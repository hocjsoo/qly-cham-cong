import type { HTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200 bg-white dark:bg-neutral-100 p-4",
        className
      )}
      {...props}
    />
  );
}
