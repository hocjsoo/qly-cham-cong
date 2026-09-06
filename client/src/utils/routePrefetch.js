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

const AUTOMATIC_ROUTE_BUDGET = 2;
const getBrowser = () => typeof window === 'undefined' ? undefined : window;

function canPrefetch(browser) {
  if (!browser || browser.navigator?.onLine === false || browser.document?.visibilityState === 'hidden') return false;
  const connection = browser.navigator?.connection;
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
}

function getCoreRoutes(user) {
  if (['admin', 'leader', 'manager'].includes(user?.role)) {
    return ['/requests', '/checkin', '/history', '/profile'];
  }
  if (['employee', 'staff'].includes(user?.role)) {
    return user.is_attendance_exempt
      ? ['/profile', '/projects', '/history']
      : ['/requests', '/history', '/checkin', '/profile'];
  }
  return [];
}

// The factory keeps the real scheduler testable without importing page components.
export function createRoutePrefetcher({ loaders = routeLoaders, getWindow = getBrowser } = {}) {
  const prefetchedRoutes = new Map();
  let automaticRoutesStarted = 0;
  let cancelActiveCore = () => {};

  function prefetchRoute(path) {
    const loader = Object.hasOwn(loaders, path) && loaders[path];
    if (typeof loader !== 'function' || !canPrefetch(getWindow())) return Promise.resolve(false);
    if (prefetchedRoutes.has(path)) return prefetchedRoutes.get(path);

    const pending = Promise.resolve().then(loader).then(() => true).catch(() => {
      prefetchedRoutes.delete(path);
      return false;
    });
    prefetchedRoutes.set(path, pending);
    return pending;
  }

  /**
   * Prefetch core application route chunks in idle time.
   * Staggers imports so initial rendering is never delayed.
   */
  function prefetchAllCoreRoutes({ user, currentPath } = {}) {
    cancelActiveCore();
    const browser = getWindow();
    const queue = getCoreRoutes(user).filter(path => path !== currentPath);
    let cancelled = false;
    let cancelScheduled = () => {};

    const cancel = () => {
      cancelled = true;
      cancelScheduled();
    };
    cancelActiveCore = cancel;

    const scheduleNext = () => {
      if (cancelled || !canPrefetch(browser) || automaticRoutesStarted >= AUTOMATIC_ROUTE_BUDGET) return;
      while (queue.length && prefetchedRoutes.has(queue[0])) queue.shift();
      if (!queue.length) return;

      const run = (deadline) => {
        cancelScheduled = () => {};
        if (cancelled || !canPrefetch(browser)) return;
        if (deadline && deadline.timeRemaining() < 5) {
          scheduleNext();
          return;
        }
        while (queue.length && prefetchedRoutes.has(queue[0])) queue.shift();
        if (!queue.length || automaticRoutesStarted >= AUTOMATIC_ROUTE_BUDGET) return;

        automaticRoutesStarted += 1;
        prefetchRoute(queue.shift()).then(loaded => {
          if (!loaded) automaticRoutesStarted -= 1;
          // A dynamic import already in progress cannot be aborted; cancel stops its successor.
          scheduleNext();
        });
      };

      if (typeof browser.requestIdleCallback === 'function' && typeof browser.cancelIdleCallback === 'function') {
        const handle = browser.requestIdleCallback(run);
        cancelScheduled = () => browser.cancelIdleCallback(handle);
      } else {
        const handle = browser.setTimeout(run, 1800);
        cancelScheduled = () => browser.clearTimeout(handle);
      }
    };

    scheduleNext();
    return cancel;
  }

  return { prefetchRoute, prefetchAllCoreRoutes };
}

const defaultPrefetcher = createRoutePrefetcher();
export const prefetchRoute = defaultPrefetcher.prefetchRoute;
export const prefetchAllCoreRoutes = defaultPrefetcher.prefetchAllCoreRoutes;
