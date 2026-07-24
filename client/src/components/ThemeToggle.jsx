// src/components/ThemeToggle.jsx
// Nút chuyển Dark/Light mode — Lưu vào localStorage

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

function getInitialTheme() {
  const saved = localStorage.getItem('et-theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('et-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <button
      onClick={toggle}
      className="theme-toggle-btn"
      aria-label="Đổi giao diện sáng/tối"
      title={theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
