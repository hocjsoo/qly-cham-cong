// src/stores/themeStore.js
// Quản lý chế độ Sáng / Tối (Light / Dark Mode)

import { create } from 'zustand';

const normalizeTheme = (theme) => theme === 'light' ? 'light' : 'dark';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('theme') || localStorage.getItem('et-theme');
    return normalizeTheme(saved);
  } catch {
    return 'dark';
  }
};

const applyTheme = (theme) => {
  const resolvedTheme = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', resolvedTheme);

  const themeColorMeta = document.querySelector("meta[name='theme-color']");
  if (themeColorMeta) {
    themeColorMeta.content = resolvedTheme === 'light' ? '#f4f3ef' : '#17191b';
  }

  return resolvedTheme;
};

const persistTheme = (theme) => {
  try {
    localStorage.setItem('theme', theme);
    localStorage.removeItem('et-theme');
  } catch {}
};

const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    persistTheme(nextTheme);
    applyTheme(nextTheme);
    set({ theme: nextTheme });
  },

  setTheme: (theme) => {
    const resolvedTheme = normalizeTheme(theme);
    persistTheme(resolvedTheme);
    applyTheme(resolvedTheme);
    set({ theme: resolvedTheme });
  },
}));

// Set attribute ban đầu khi load script
applyTheme(getInitialTheme());

export default useThemeStore;
