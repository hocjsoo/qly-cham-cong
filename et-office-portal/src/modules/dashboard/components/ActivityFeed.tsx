import { useQuery } from "@tanstack/react-query";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/shared/lib/firebase";
import { Card } from "@/shared/components/ui/Card";
import { relativeTime } from "@/shared/utils/formatDate";

interface FeedEvent {
  id: string;
  type: string;
  employeeName: string;
  timestamp: string;
}

const EVENT_LABEL: Record<string, string> = {
  check_in: "Check In",
  check_out: "Check Out",
  late: "Đi muộn",
  leave_request: "Xin nghỉ phép",
  explanation_submitted: "Gửi giải trình",
};

/** Feed realtime kiểu GitHub (mục 7 kiến trúc) — subscribe activityFeedEvents, giới hạn 20 gần nhất. */
export function ActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    const q = query(collection(db, "activityFeedEvents"), orderBy("timestamp", "desc"), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedEvent)));
    });
    return unsub;
  }, []);

  return (
    <Card>
      <h3 className="font-heading font-medium text-sm mb-3">Hoạt động gần đây</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-neutral-100 last:border-0">
            <span>
              <span className="font-medium">{e.employeeName}</span>{" "}
              <span className="text-neutral-500">{EVENT_LABEL[e.type] ?? e.type}</span>
            </span>
            <span className="text-xs text-neutral-500">{relativeTime(new Date(e.timestamp))}</span>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-neutral-500 py-4 text-center">Chưa có hoạt động nào hôm nay.</p>}
      </div>
    </Card>
  );
}
