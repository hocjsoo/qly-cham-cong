// src/components/Layout.jsx
// Layout wrapper — Responsive Desktop Sidebar & Mobile Bottom Navigation

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Clock, LayoutDashboard, FileText, History, Users, Settings, BarChart2, LogOut, User } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import api from '../services/api';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isStaff = user?.role === 'staff';
  const isAdmin = user?.role === 'admin';
  const [pendingCount, setPendingCount] = useState(0);

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

  const tabs = [
    ...(!isStaff ? [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] : []),
    { to: '/checkin', icon: Clock, label: 'Chấm công' },
    { to: '/requests', icon: FileText, label: 'Đơn từ', badge: pendingCount > 0 ? pendingCount : null },
    { to: '/history', icon: History, label: 'Lịch sử' },
    ...(!isStaff ? [{ to: '/reports', icon: BarChart2, label: 'Báo cáo' }] : []),
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
          <div className="desktop-sidebar__logo">ET</div>
          <div>
            <div className="desktop-sidebar__title">ET Office Portal</div>
            <div className="desktop-sidebar__subtitle">Chấm Công Thông Minh</div>
          </div>
        </div>

        <div className="desktop-sidebar__user">
          <div className="avatar" style={{ width: '38px', height: '38px', fontSize: '13px' }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {user?.role === 'admin' ? 'Quản trị viên' : user?.role === 'manager' ? 'Trưởng phòng' : 'Nhân viên'}
            </div>
          </div>
          <ThemeToggle />
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
