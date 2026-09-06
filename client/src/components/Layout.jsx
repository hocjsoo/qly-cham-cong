// src/components/Layout.jsx
// Layout wrapper — Responsive Desktop Sidebar & Mobile Bottom Navigation

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Clock, Mail, LayoutDashboard, FileText, History, Users, Settings, BarChart2, LogOut, User, FolderKanban, Bike, Receipt, Trophy, CalendarDays, Grid2X2, X, ChevronRight } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { fetchPendingCountCached } from '../services/pendingCountCache';
import { prefetchRoute, prefetchAllCoreRoutes } from '../utils/routePrefetch';

import useSettingsStore from '../stores/settingsStore';
import PageLoader from './PageLoader';
import './Layout.css';

function MobileMoreMenu({ tabs, currentLabel, onClose, triggerRef }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    const trigger = triggerRef.current;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    sheet.querySelector('[data-menu-close]')?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...sheet.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    };
    const handleResize = (event) => { if (event.matches) onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    desktopQuery.addEventListener('change', handleResize);

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      desktopQuery.removeEventListener('change', handleResize);
      if (trigger?.isConnected && trigger.getClientRects().length) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      className="modal-overlay mobile-menu-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={sheetRef}
        id="mobile-more-menu"
        className="modal-sheet mobile-menu-sheet animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-more-title"
        aria-describedby="mobile-more-current"
      >
        <div className="modal-sheet__handle" aria-hidden="true" />
        <div className="mobile-menu__heading">
          <div>
            <h2 id="mobile-more-title">Tiện ích</h2>
            <p id="mobile-more-current">Đang xem: <strong>{currentLabel}</strong></p>
          </div>
          <button type="button" className="mobile-menu__close" data-menu-close onClick={onClose} aria-label="Đóng menu tiện ích">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="mobile-menu__grid" aria-label="Các tiện ích khác">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              onClick={onClose}
              onPointerDown={() => prefetchRoute(t.to)}
              onFocus={() => prefetchRoute(t.to)}
              className={({ isActive }) => `mobile-menu__item${isActive ? ' active' : ''}`}
            >
              <span className="mobile-menu__icon"><t.icon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
              <span className="mobile-menu__label">{t.label}</span>
              {t.badge ? <span className="sidebar-badge" aria-label={`${t.badge} mục chờ xử lý`}>{t.badge > 99 ? '99+' : t.badge}</span> : <ChevronRight size={15} className="mobile-menu__arrow" aria-hidden="true" />}
            </NavLink>
          ))}
        </nav>
      </section>
    </div>,
    document.body,
  );
}

export default function Layout() {
  const { user, token, logout } = useAuthStore();
  const { company_name, company_logo_url } = useSettingsStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const moreButtonRef = useRef(null);
  const isStaff = user?.role === 'staff' || user?.role === 'employee';
  const isAdmin = user?.role === 'admin';
  const userId = user?._id || user?.id;
  const userRole = user?.role;
  const isStaffExempt = isStaff && Boolean(user?.is_attendance_exempt);
  const departmentScope = (user?.department_ids || [user?.department_id]).map(d => d?._id || d || '').sort().join(',');
  const pendingScope = `${userId}:${userRole}:${departmentScope}`;
  const [pending, setPending] = useState(null);
  const pendingCount = pending?.scope === pendingScope && pending?.token === token ? pending.count : 0;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const closeMoreMenu = useCallback(() => setIsMoreOpen(false), []);

  // Tải trước các trang chính khi trình duyệt rảnh rỗi
  useEffect(() => {
    return prefetchAllCoreRoutes({ user: { _id: userId, role: userRole, is_attendance_exempt: isStaffExempt }, currentPath: pathname });
  }, [userId, userRole, isStaffExempt, pathname]);

  useEffect(() => {
    if (isStaff || !userId) return undefined;
    let cancelled = false;
    let fetching = false;
    const fetchPendingCount = async () => {
      if (cancelled || fetching || document.hidden || navigator.onLine === false) return;
      fetching = true;
      try {
        const count = await fetchPendingCountCached();
        if (!cancelled && useAuthStore.getState().token === token) {
          setPending({ scope: pendingScope, token, count });
        }
      } catch {} finally {
        fetching = false;
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    document.addEventListener('visibilitychange', fetchPendingCount);
    window.addEventListener('online', fetchPendingCount);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', fetchPendingCount);
      window.removeEventListener('online', fetchPendingCount);
    };
  }, [isStaff, userId, token, pendingScope]);

  useEffect(() => { closeMoreMenu(); }, [pathname, userId, userRole, closeMoreMenu]);

  const tabs = [
    ...(!isStaff || isStaffExempt ? [{ to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' }] : []),
    ...(!isStaffExempt ? [{ to: '/checkin', icon: Clock, label: 'Chấm công' }] : []),
    ...(!isStaffExempt ? [{ to: '/requests', icon: FileText, label: 'Đơn từ', badge: pendingCount > 0 ? pendingCount : null }] : []),
    { to: '/tts-schedule', icon: CalendarDays, label: 'Lịch tuần' },
    { to: '/projects', icon: FolderKanban, label: 'Dự án' },
    { to: '/expenses', icon: Receipt, label: 'Chi tiêu' },
    { to: '/reports', icon: BarChart2, label: 'Bảng công' },
    { to: '/history', icon: History, label: 'Lịch sử' },
    { to: '/leaderboard', icon: Trophy, label: 'Xếp hạng' },
    { to: '/vehicles', icon: Bike, label: 'Gửi xe' },
    ...(!isStaff ? [{ to: '/staff', icon: Users, label: 'Nhân viên' }] : []),
    ...(isAdmin ? [{ to: '/emails', icon: Mail, label: 'Gửi Email' }] : []),
    ...(isAdmin ? [{ to: '/settings', icon: Settings, label: 'Cài đặt' }] : []),
    { to: '/profile', icon: User, label: 'Cá nhân' },
  ];

  const primaryPaths = isStaffExempt
    ? ['/dashboard', '/projects', '/reports', '/profile']
    : isStaff
      ? ['/checkin', '/requests', '/history', '/profile']
      : ['/dashboard', '/checkin', '/requests', '/reports'];
  const primaryTabs = primaryPaths.map(path => tabs.find(t => t.to === path)).filter(Boolean);
  const moreTabs = tabs.filter(t => !primaryPaths.includes(t.to));
  const isCurrentTab = (tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`);
  const activeMoreTab = moreTabs.find(isCurrentTab);
  const currentLabel = tabs.find(isCurrentTab)?.label || 'Trang chính';
  const moreBadge = moreTabs.reduce((total, tab) => total + (tab.badge || 0), 0);

  return (
    <div className="app-shell" inert={isMoreOpen ? true : undefined}>
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
              onPointerEnter={() => prefetchRoute(t.to)}
              onFocus={() => prefetchRoute(t.to)}
              className={({ isActive }) => `desktop-nav__item${isActive ? ' active' : ''}`}
            >
              <t.icon size={20} strokeWidth={1.8} />
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
        <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
      </main>

      {/* Mobile Bottom Navigation (visible < 1024px) */}
      <nav className="bottom-nav bottom-nav--compact" aria-label="Điều hướng chính trên điện thoại">
        {primaryTabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            onPointerDown={() => prefetchRoute(t.to)}
            onFocus={() => prefetchRoute(t.to)}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
            style={{ position: 'relative' }}
          >
            <span className="bottom-nav__icon" style={{ position: 'relative' }}>
              <t.icon size={20} strokeWidth={1.8} aria-hidden="true" />
              {t.badge && (
                <span className="nav-badge" aria-label={`${t.badge} mục chờ xử lý`}>{t.badge > 99 ? '99+' : t.badge}</span>
              )}
            </span>
            <span className="bottom-nav__label">{t.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          ref={moreButtonRef}
          className={`bottom-nav__item${activeMoreTab || isMoreOpen ? ' active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          aria-controls={isMoreOpen ? 'mobile-more-menu' : undefined}
          aria-label={activeMoreTab ? `Mở thêm tiện ích. Đang xem ${activeMoreTab.label}` : 'Mở thêm tiện ích'}
          onClick={() => setIsMoreOpen(true)}
        >
          <span className="bottom-nav__icon">
            <Grid2X2 size={20} strokeWidth={1.8} aria-hidden="true" />
            {moreBadge > 0 && <span className="nav-badge" aria-label={`${moreBadge} mục chờ xử lý`}>{moreBadge > 99 ? '99+' : moreBadge}</span>}
          </span>
          <span className="bottom-nav__label">{activeMoreTab?.label || 'Thêm'}</span>
        </button>
      </nav>
      {isMoreOpen && <MobileMoreMenu tabs={moreTabs} currentLabel={currentLabel} onClose={closeMoreMenu} triggerRef={moreButtonRef} />}
    </div>
  );
}
