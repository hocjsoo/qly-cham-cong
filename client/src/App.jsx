// src/App.jsx
// Router chính — Protected routes + role-based access + Route-level Lazy Loading

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import useSettingsStore from './stores/settingsStore';

import Layout from './components/Layout';
import MagicCursor from './components/MagicCursor';
import ErrorBoundary from './components/ErrorBoundary';

// Tự động tải lại trang khi có phiên bản build mới trên production (tránh lỗi 404 chunk cũ)
function lazyRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const isChunkError = error?.message && (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('dynamically imported module')
      );
      const hasRefreshed = window.sessionStorage.getItem('retry-chunk-refreshed');
      if (isChunkError && !hasRefreshed) {
        window.sessionStorage.setItem('retry-chunk-refreshed', 'true');
        window.location.reload();
        return { default: () => null };
      }
      window.sessionStorage.removeItem('retry-chunk-refreshed');
      throw error;
    }
  });
}

// Route-level code splitting
const LoginPage = lazyRetry(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazyRetry(() => import('./pages/ForgotPasswordPage'));
const CheckInPage = lazyRetry(() => import('./pages/CheckInPage'));
const DashboardPage = lazyRetry(() => import('./pages/DashboardPage'));
const RequestsPage = lazyRetry(() => import('./pages/RequestsPage'));
const HistoryPage = lazyRetry(() => import('./pages/HistoryPage'));
const StaffPage = lazyRetry(() => import('./pages/StaffPage'));
const ProfilePage = lazyRetry(() => import('./pages/ProfilePage'));
const ReportPage = lazyRetry(() => import('./pages/ReportPage'));
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage'));
const ProjectsPage = lazyRetry(() => import('./pages/ProjectsPage'));
const VehiclesPage = lazyRetry(() => import('./pages/VehiclesPage'));
const ExpensesPage = lazyRetry(() => import('./pages/ExpensesPage'));
const LeaderboardPage = lazyRetry(() => import('./pages/LeaderboardPage'));
const TtsSchedulePage = lazyRetry(() => import('./pages/TtsSchedulePage'));
const EmailsPage = lazyRetry(() => import('./pages/EmailsPage'));

// Fallback loader hiển thị nhẹ nhàng khi chuyển trang
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-muted)'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '13px', fontWeight: 500 }}>Đang tải dữ liệu...</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const getDefaultHome = (user) => {
  if (!user) return '/login';
  const isStaff = user.role === 'staff' || user.role === 'employee';
  if (user.is_attendance_exempt) {
    return '/dashboard';
  }
  return isStaff ? '/checkin' : '/dashboard';
};

function ProtectedRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={getDefaultHome(user)} replace />;
  return children;
}


// Đồng bộ hoá dataset.page cho toàn bộ ứng dụng để áp dụng đầy đủ quy tắc giao diện chuyên sâu
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    const rawPath = location.pathname.replace(/^\//, "") || "login";
    const cleanPath = rawPath.split("/")[0] || "login";
    document.documentElement.dataset.page = cleanPath;
    document.documentElement.dataset.reviewPage = cleanPath;
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { user } = useAuthStore();
  const { fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isStaff = user?.role === 'staff' || user?.role === 'employee';
  const isExempt = Boolean(user?.is_attendance_exempt);

  return (
    <BrowserRouter>
      <RouteTracker />
      <MagicCursor />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: 'var(--shadow-md)',
          },
        }}
      />

      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to={getDefaultHome(user)} replace /> : <LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/checkin" element={(isStaff && isExempt) ? <Navigate to="/dashboard" replace /> : <CheckInPage />} />
              <Route path="/requests" element={(isStaff && isExempt) ? <Navigate to="/dashboard" replace /> : <RequestsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/staff" element={
                <ProtectedRoute roles={['admin', 'leader', 'manager']}>
                  <StaffPage />
                </ProtectedRoute>
              } />

              <Route path="/reports" element={<ReportPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/tts-schedule" element={<TtsSchedulePage />} />

              <Route path="/emails" element={
                <ProtectedRoute roles={["admin"]}>
                  <EmailsPage />
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute roles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to={getDefaultHome(user)} replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
