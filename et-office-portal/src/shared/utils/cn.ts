import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp className an toàn, tránh conflict Tailwind (dùng trong mọi component). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
