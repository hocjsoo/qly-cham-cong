// src/App.jsx
// Router chính — Protected routes + role-based access

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CheckInPage from './pages/CheckInPage';
import DashboardPage from './pages/DashboardPage';
import RequestsPage from './pages/RequestsPage';
import HistoryPage from './pages/HistoryPage';
import StaffPage from './pages/StaffPage';
import ProfilePage from './pages/ProfilePage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import ProjectsPage from './pages/ProjectsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MagicCursor from './components/MagicCursor';


function ProtectedRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/checkin" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();

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

      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'staff' ? '/checkin' : '/dashboard'} replace /> : <LoginPage />} />
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

          <Route path="/reports" element={
            <ProtectedRoute roles={['admin', 'leader', 'manager']}>
              <ReportPage />
            </ProtectedRoute>
          } />

          <Route path="/staff" element={
            <ProtectedRoute roles={['admin', 'leader', 'manager']}>
              <StaffPage />
            </ProtectedRoute>
          } />

          <Route path="/projects" element={
            <ProtectedRoute roles={['admin', 'leader', 'manager']}>
              <ProjectsPage />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute roles={['admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to={user ? (user.role === 'staff' ? '/checkin' : '/dashboard') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
