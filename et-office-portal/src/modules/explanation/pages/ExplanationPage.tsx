import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/shared/components/layout/PageShell";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { getMyExplanations, submitExplanation } from "../services/explanationService";
import { relativeTime } from "@/shared/utils/formatDate";
import { cn } from "@/shared/utils/cn";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chưa duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

/** Giải trình đi muộn/về sớm/OT — sửa được trong 72h kể từ lúc chấm công (mục 14 kiến trúc). */
export function ExplanationPage() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const { data: explanations = [], isLoading } = useQuery({
    queryKey: ["explanations", employee?.id],
    queryFn: () => getMyExplanations(employee!.id),
    enabled: !!employee,
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitExplanation({ attendanceId: "", type: "late", reason }), // attendanceId thực tế truyền từ ngữ cảnh (chọn ngày cần giải trình) — rút gọn ở bản demo Phase 1
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["explanations", employee?.id] });
    },
  });

  return (
    <PageShell title="Giải trình">
      <Card className="space-y-3">
        <label className="text-sm font-medium">Lý do (vd: "Tắc đường", "Render Hương Khê")</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-sm border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Nhập lý do đi muộn / về sớm / OT..."
        />
        <Button onClick={() => mutation.mutate()} disabled={!reason.trim() || mutation.isPending}>
          Gửi giải trình
        </Button>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-neutral-500">Đang tải...</p>}
        {explanations.map((exp) => (
          <Card key={exp.id} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm">{exp.reason}</p>
              <p className="text-xs text-neutral-500 mt-1">
                Có thể sửa đến {relativeTime(new Date(exp.editableUntil))}
              </p>
            </div>
            <Badge className={cn(STATUS_COLOR[exp.status])}>{STATUS_LABEL[exp.status]}</Badge>
          </Card>
        ))}
        {!isLoading && explanations.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-8">Chưa có giải trình nào.</p>
        )}
      </div>
    </PageShell>
  );
}
