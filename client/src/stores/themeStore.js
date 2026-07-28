// src/stores/themeStore.js
// Quản lý chế độ Sáng / Tối (Light / Dark Mode)

import { create } from 'zustand';

const getInitialTheme = () => {
  const saved = localStorage.getItem('theme');
  return saved || 'light';
};

const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    set({ theme: nextTheme });
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

// Set attribute ban đầu khi load script
document.documentElement.setAttribute('data-theme', getInitialTheme());

export default useThemeStore;
