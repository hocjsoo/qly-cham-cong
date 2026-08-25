// src/stores/settingsStore.js
// Quản lý cấu hình toàn hệ thống (Tên công ty, Logo công ty, Giờ làm việc)

import { create } from 'zustand';
import api from '../services/api';
import { applyDynamicBranding } from '../utils/dynamicBranding';

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
        const companyName = data.company_name || 'ET Architects';
        const logoUrl = data.company_logo_url || '';

        set({
          company_name: companyName,
          company_logo_url: logoUrl,
          settings: data,
          loading: false,
        });

        // Áp dụng favicon, Apple Touch Icon và Web App Manifest PWA theo logo đã cài đặt
        applyDynamicBranding(companyName, logoUrl);
      }
    } catch {
      set({ loading: false });
    }
  },

  setCompanyLogo: (logoUrl) => {
    const currentName = get().company_name;
    set((state) => ({
      company_logo_url: logoUrl,
      settings: state.settings ? { ...state.settings, company_logo_url: logoUrl } : null,
    }));

    applyDynamicBranding(currentName, logoUrl);
  },

  updateSettingsState: (newSettings) => {
    const companyName = newSettings.company_name || 'ET Architects';
    const logoUrl = newSettings.company_logo_url || '';

    set({
      company_name: companyName,
      company_logo_url: logoUrl,
      settings: newSettings,
    });

    applyDynamicBranding(companyName, logoUrl);
  },
}));

export default useSettingsStore;
