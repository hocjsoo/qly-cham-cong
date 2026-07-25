import { PageShell } from "@/shared/components/layout/PageShell";
import { CheckInButton } from "../components/CheckInButton";

export function CheckinPage() {
  return (
    <PageShell title="Chấm công">
      <div className="max-w-md mx-auto">
        <CheckInButton />
      </div>
    </PageShell>
  );
}
