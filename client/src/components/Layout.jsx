// src/components/Layout.jsx
// Layout wrapper — Responsive Desktop Sidebar & Mobile Bottom Navigation

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Clock, LayoutDashboard, FileText, History, Users, Settings, BarChart2, LogOut, User, FolderKanban, Bike, Receipt, Trophy } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import api from '../services/api';

import useSettingsStore from '../stores/settingsStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { company_name, company_logo_url, fetchSettings } = useSettingsStore();
  const navigate = useNavigate();
  const isStaff = user?.role === 'staff' || user?.role === 'employee';
  const isAdmin = user?.role === 'admin';
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!isStaff) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const { data } = await api.get('/dashboard/pending-count');
      setPendingCount(data.pending_count || 0);
    } catch {}
  };

  const isExempt = Boolean(user?.is_attendance_exempt);

  const tabs = [
    ...(!isStaff ? [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] : []),
    ...(!isExempt ? [{ to: '/checkin', icon: Clock, label: 'Chấm công' }] : []),
    { to: '/requests', icon: FileText, label: 'Đơn từ', badge: pendingCount > 0 ? pendingCount : null },
    { to: '/projects', icon: FolderKanban, label: 'Dự án' },
    { to: '/expenses', icon: Receipt, label: 'Chi tiêu' },
    { to: '/reports', icon: BarChart2, label: 'Bảng công' },
    { to: '/history', icon: History, label: 'Lịch sử' },
    { to: '/leaderboard', icon: Trophy, label: 'Xếp hạng' },
    { to: '/vehicles', icon: Bike, label: 'Gửi xe' },
    ...(!isStaff ? [{ to: '/staff', icon: Users, label: 'Nhân viên' }] : []),
    ...(isAdmin ? [{ to: '/settings', icon: Settings, label: 'Cài đặt' }] : []),
    { to: '/profile', icon: User, label: 'Cá nhân' },
  ];

  const initials = user?.full_name?.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() || '?';

  return (
    <div className="app-shell">
      {/* Desktop Navigation Sidebar (visible >= 1024px) */}
      <aside className="desktop-sidebar">
        <div className="desktop-sidebar__brand">
          {company_logo_url ? (
            <img
              src={company_logo_url}
              alt={company_name || 'Logo'}
              style={{ height: '38px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px' }}
            />
          ) : (
            <div className="desktop-sidebar__logo">ET</div>
          )}
          <div>
            <div className="desktop-sidebar__title">{company_name || 'ET Office Portal'}</div>
            <div className="desktop-sidebar__subtitle">Chấm Công Thông Minh</div>
          </div>
        </div>

        <div className="desktop-sidebar__user">
          <img
            src={user?.avatar_url || '/logo.png'}
            alt={user?.full_name || 'User'}
            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
            onError={e => { e.target.src = '/logo.png'; }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {user?.role === 'admin' ? 'Quản trị viên' : (user?.role === 'leader' || user?.role === 'manager') ? 'Leader' : 'Nhân viên'}
            </div>
          </div>
        </div>

        <nav className="desktop-sidebar__nav">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => `desktop-nav__item${isActive ? ' active' : ''}`}
            >
              <t.icon size={18} strokeWidth={1.8} />
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.badge && (
                <span className="sidebar-badge">{t.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="desktop-sidebar__footer">
          <button onClick={() => { logout(); navigate('/login'); }} className="desktop-nav__logout">
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation (visible < 1024px) */}
      <nav className="bottom-nav">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
            style={{ position: 'relative' }}
          >
            <span className="bottom-nav__icon" style={{ position: 'relative' }}>
              <t.icon size={20} strokeWidth={1.8} />
              {t.badge && (
                <span className="nav-badge">{t.badge}</span>
              )}
            </span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
