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
