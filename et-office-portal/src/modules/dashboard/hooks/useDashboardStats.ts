import { useQuery } from "@tanstack/react-query";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/shared/lib/firebase";
import { toDateKey } from "@/shared/utils/formatDate";

export interface DashboardStats {
  totalEmployees: number;
  checkedIn: number;
  notCheckedIn: number;
  late: number;
  onLeave: number;
  wfh: number;
  siteVisit: number;
  onOt: number;
}

/**
 * StatCard đọc số liệu qua getCountFromServer (không tải toàn bộ document về client)
 * — tiết kiệm quota đọc, phù hợp với ADR-008 (tránh quét toàn bộ collection ở client).
 * Với quy mô lớn hơn, các số liệu này nên chuyển sang đọc từ 1 aggregated doc do
 * Cloud Function cập nhật realtime, thay vì count query trực tiếp mỗi lần mở Dashboard.
 */
export function useDashboardStats() {
  const today = toDateKey(new Date());

  return useQuery({
    queryKey: ["dashboard", "stats", today],
    queryFn: async (): Promise<DashboardStats> => {
      const attendanceToday = collection(db, "attendance");
      const employeesActive = query(collection(db, "employees"), where("status", "==", "active"));

      const [totalSnap, checkedInSnap, lateSnap] = await Promise.all([
        getCountFromServer(employeesActive),
        getCountFromServer(query(attendanceToday, where("date", "==", today), where("checkIn", "!=", null))),
        getCountFromServer(query(attendanceToday, where("date", "==", today), where("lateStatus", "in", ["slightly_late", "late", "very_late"]))),
      ]);

      const totalEmployees = totalSnap.data().count;
      const checkedIn = checkedInSnap.data().count;

      return {
        totalEmployees,
        checkedIn,
        notCheckedIn: Math.max(totalEmployees - checkedIn, 0),
        late: lateSnap.data().count,
        onLeave: 0, // Phase 2: tính từ workStatus = annual_leave/sick_leave/unpaid_leave
        wfh: 0, // Phase 2
        siteVisit: 0, // Phase 2
        onOt: 0, // Phase 2: cần projectStats/OT aggregation
      };
    },
    refetchInterval: 60_000,
  });
}
