// src/stores/settingsStore.js
// Quản lý cấu hình toàn hệ thống (Tên công ty, Logo công ty, Giờ làm việc)

import { create } from 'zustand';
import api from '../services/api';

const useSettingsStore = create((set, get) => ({
  company_name: 'ET Architects',
  company_logo_url: '',
  settings: null,
  loading: false,

  fetchSettings: async () => {
    try {
      set({ loading: true });
      const { data } = await api.get('/settings');
      if (data) {
        set({
          company_name: data.company_name || 'ET Architects',
          company_logo_url: data.company_logo_url || '',
          settings: data,
          loading: false,
        });

        // Dynamic favicon update if company_logo_url exists
        if (data.company_logo_url) {
          const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
          link.rel = 'shortcut icon';
          link.href = data.company_logo_url;
          document.getElementsByTagName('head')[0].appendChild(link);
        }
      }
    } catch (err) {
      set({ loading: false });
    }
  },

  setCompanyLogo: (logoUrl) => {
    set((state) => ({
      company_logo_url: logoUrl,
      settings: state.settings ? { ...state.settings, company_logo_url: logoUrl } : null,
    }));

    if (logoUrl) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.rel = 'shortcut icon';
      link.href = logoUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  },

  updateSettingsState: (newSettings) => {
    set({
      company_name: newSettings.company_name || 'ET Architects',
      company_logo_url: newSettings.company_logo_url || '',
      settings: newSettings,
    });

    if (newSettings.company_logo_url) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.rel = 'shortcut icon';
      link.href = newSettings.company_logo_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  },
}));

export default useSettingsStore;
