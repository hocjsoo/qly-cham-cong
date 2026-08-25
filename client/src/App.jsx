// src/App.jsx
// Router chính — Protected routes + role-based access + Route-level Lazy Loading

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import useSettingsStore from './stores/settingsStore';

import Layout from './components/Layout';
import MagicCursor from './components/MagicCursor';
import ErrorBoundary from './components/ErrorBoundary';

// Route-level code splitting (Chỉ tải bundle khi user mở trang tương ứng)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));

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

function ProtectedRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/checkin" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();
  const { fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <BrowserRouter>
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
            <Route path="/login" element={user ? <Navigate to={(user.role === 'staff' || user.role === 'employee') ? '/checkin' : '/dashboard'} replace /> : <LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/checkin" element={<CheckInPage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              <Route path="/dashboard" element={
                <ProtectedRoute roles={['admin', 'leader', 'manager']}>
                  <DashboardPage />
                </ProtectedRoute>
              } />

              <Route path="/staff" element={
                <ProtectedRoute roles={['admin', 'leader', 'manager']}>
                  <StaffPage />
                </ProtectedRoute>
              } />

              <Route path="/reports" element={
                <ProtectedRoute roles={['admin']}>
                  <ReportPage />
                </ProtectedRoute>
              } />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />

              <Route path="/settings" element={
                <ProtectedRoute roles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to={user ? ((user.role === 'staff' || user.role === 'employee') ? '/checkin' : '/dashboard') : '/login'} replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
