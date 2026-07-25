import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { AccessDeniedPage } from "@/modules/auth/pages/AccessDeniedPage";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { CheckinPage } from "@/modules/attendance/pages/CheckinPage";
import { TimesheetPage } from "@/modules/attendance/pages/TimesheetPage";
import { ExplanationPage } from "@/modules/explanation/pages/ExplanationPage";
import { Sidebar } from "@/shared/components/layout/Sidebar";
import { Topbar } from "@/shared/components/layout/Topbar";
import { ROUTES } from "@/shared/constants/routes";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <main>{children}</main>
      </div>
    </div>
  );
}

export function AppRoutes() {
  const { isLoading, firebaseUid, employee, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-500">Đang tải...</div>;
  }

  if (!firebaseUid) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Đăng nhập Firebase thành công nhưng không tìm thấy hồ sơ nhân sự tương ứng
  if (!employee) {
    return (
      <Routes>
        <Route path="*" element={<AccessDeniedPage />} />
      </Routes>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.CHECKIN} element={<CheckinPage />} />
        <Route path={ROUTES.TIMESHEET} element={<TimesheetPage />} />
        <Route path={ROUTES.EXPLANATION} element={<ExplanationPage />} />
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
}
