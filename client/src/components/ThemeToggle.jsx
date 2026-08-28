// src/components/ThemeToggle.jsx
// Nút chuyển Dark/Light mode — dùng chung nguồn trạng thái toàn ứng dụng

import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../stores/themeStore';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label="Đổi giao diện sáng/tối"
      title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
