import { useState } from "react";
import { signInWithGoogle } from "../services/authService";
import { Button } from "@/shared/components/ui/Button";

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Điều hướng sau login xử lý ở AuthProvider (theo dõi onAuthStateChanged)
    } catch (e) {
      setError("Đăng nhập thất bại. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 relative overflow-hidden">
      {/* Hoạ tiết blueprint mờ làm nền trang trí — đúng tinh thần Blueprint/Architecture theme */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-primary">ET Office Portal</h1>
          <p className="text-sm text-neutral-500">Hệ thống quản trị nội bộ — ET Architects</p>
        </div>
        <Button size="lg" onClick={handleLogin} disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
