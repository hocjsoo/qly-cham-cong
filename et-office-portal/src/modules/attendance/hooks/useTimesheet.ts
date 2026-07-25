import { useQuery } from "@tanstack/react-query";
import { getMonthAttendance } from "../services/attendanceService";

export function useTimesheet(employeeId: string | undefined, monthPrefix: string) {
  return useQuery({
    queryKey: ["attendance", "month", employeeId, monthPrefix],
    queryFn: () => getMonthAttendance(employeeId!, monthPrefix),
    enabled: !!employeeId,
  });
}

export function useTodayAttendance(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["attendance", "today", employeeId],
    queryFn: async () => {
      const { getTodayAttendance } = await import("../services/attendanceService");
      return getTodayAttendance(employeeId!);
    },
    enabled: !!employeeId,
    refetchInterval: 60_000,
  });
}
