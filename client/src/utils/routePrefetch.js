const routeLoaders = {
  '/checkin': () => import('../pages/CheckInPage'),
  '/dashboard': () => import('../pages/DashboardPage'),
  '/requests': () => import('../pages/RequestsPage'),
  '/history': () => import('../pages/HistoryPage'),
  '/staff': () => import('../pages/StaffPage'),
  '/profile': () => import('../pages/ProfilePage'),
  '/reports': () => import('../pages/ReportPage'),
  '/settings': () => import('../pages/SettingsPage'),
  '/projects': () => import('../pages/ProjectsPage'),
  '/vehicles': () => import('../pages/VehiclesPage'),
  '/expenses': () => import('../pages/ExpensesPage'),
  '/leaderboard': () => import('../pages/LeaderboardPage'),
  '/tts-schedule': () => import('../pages/TtsSchedulePage'),
  '/emails': () => import('../pages/EmailsPage'),
};

const prefetchedRoutes = new Set();

export function prefetchRoute(path) {
  const loader = routeLoaders[path];
  if (!loader || prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);
  loader().catch(() => prefetchedRoutes.delete(path));
}

let isPrefetchingCore = false;

/**
 * Prefetch core application route chunks in idle time.
 * Staggers imports so initial rendering is never delayed.
 */
export function prefetchAllCoreRoutes() {
  if (isPrefetchingCore) return;
  isPrefetchingCore = true;

  const coreRoutes = [
    '/checkin',
    '/dashboard',
    '/requests',
    '/history',
    '/projects',
    '/profile',
    '/staff',
  ];

  const scheduleNext = (index) => {
    if (index >= coreRoutes.length) return;
    prefetchRoute(coreRoutes[index]);
    setTimeout(() => scheduleNext(index + 1), 250);
  };

  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => scheduleNext(0), { timeout: 4000 });
    } else {
      setTimeout(() => scheduleNext(0), 1200);
    }
  }
}
