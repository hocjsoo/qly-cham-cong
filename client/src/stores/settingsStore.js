// src/stores/settingsStore.js
// Quản lý cấu hình toàn hệ thống (Tên công ty, Logo công ty, Giờ làm việc)

import { create } from 'zustand';
import api from '../services/api';
import {
  applyDynamicBranding,
  DEFAULT_COMPANY_ADDRESS,
  DEFAULT_COMPANY_LOGO_URL,
  DEFAULT_COMPANY_NAME,
  DEFAULT_EMAIL_FOOTER_NOTE,
  normalizeCompanyName,
} from '../utils/dynamicBranding';

let settingsRequest = null;

const useSettingsStore = create((set, get) => ({
  company_name: DEFAULT_COMPANY_NAME,
  company_logo_url: DEFAULT_COMPANY_LOGO_URL,
  company_address: DEFAULT_COMPANY_ADDRESS,
  email_footer_note: DEFAULT_EMAIL_FOOTER_NOTE,
  settings: null,
  loading: false,
  lastFetchedAt: 0,

  fetchSettings: async ({ force = false } = {}) => {
    const current = get();
    if (!force && current.settings && Date.now() - current.lastFetchedAt < 300000) {
      return current.settings;
    }
    if (settingsRequest) return settingsRequest;

    settingsRequest = (async () => {
    try {
      set({ loading: true });
      const { data } = await api.get('/settings');
      if (data) {
        const companyName = normalizeCompanyName(data.company_name);
        const logoUrl = data.company_logo_url || DEFAULT_COMPANY_LOGO_URL;
        const companyAddress = data.company_address || DEFAULT_COMPANY_ADDRESS;
        const emailFooterNote = data.email_footer_note || DEFAULT_EMAIL_FOOTER_NOTE;

        set({
          company_name: companyName,
          company_logo_url: logoUrl,
          company_address: companyAddress,
          email_footer_note: emailFooterNote,
          settings: {
            ...data,
            company_name: companyName,
            company_logo_url: logoUrl,
            company_address: companyAddress,
            email_footer_note: emailFooterNote,
          },
          loading: false,
          lastFetchedAt: Date.now(),
        });

        // Áp dụng favicon, Apple Touch Icon và Web App Manifest PWA theo logo đã cài đặt
        applyDynamicBranding(companyName, logoUrl);
        return data;
      }
    } catch {
      set({ loading: false });
      return null;
    } finally {
      settingsRequest = null;
    }
    })();

    return settingsRequest;
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
    const companyName = normalizeCompanyName(newSettings.company_name);
    const logoUrl = newSettings.company_logo_url || DEFAULT_COMPANY_LOGO_URL;
    const companyAddress = newSettings.company_address || DEFAULT_COMPANY_ADDRESS;
    const emailFooterNote = newSettings.email_footer_note || DEFAULT_EMAIL_FOOTER_NOTE;

    set({
      company_name: companyName,
      company_logo_url: logoUrl,
      company_address: companyAddress,
      email_footer_note: emailFooterNote,
      settings: {
        ...newSettings,
        company_name: companyName,
        company_logo_url: logoUrl,
        company_address: companyAddress,
        email_footer_note: emailFooterNote,
      },
      lastFetchedAt: Date.now(),
    });

    applyDynamicBranding(companyName, logoUrl);
  },
}));

export default useSettingsStore;
