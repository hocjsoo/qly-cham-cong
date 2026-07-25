import { signOut } from "../services/authService";
import { Button } from "@/shared/components/ui/Button";

export function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-sm text-center space-y-3">
        <h1 className="font-heading text-lg font-semibold text-danger">Không có quyền truy cập</h1>
        <p className="text-sm text-neutral-500">
          Email của bạn chưa có trong hệ thống. Vui lòng liên hệ Admin để được thêm vào danh sách nhân sự.
        </p>
        <Button variant="ghost" onClick={() => signOut()}>
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}
