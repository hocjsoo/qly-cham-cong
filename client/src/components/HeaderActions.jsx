// client/src/components/HeaderActions.jsx
// Combined Notification Center + Theme Toggle for Page Headers across Mobile & Desktop

import NotificationCenter from './NotificationCenter';
import ThemeToggle from './ThemeToggle';

export default function HeaderActions() {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
      <NotificationCenter />
      <ThemeToggle />
    </div>
  );
}
