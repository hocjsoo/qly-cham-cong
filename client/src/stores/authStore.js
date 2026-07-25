// src/stores/authStore.js
// Zustand store — quản lý trạng thái đăng nhập toàn app

import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  // State
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  // === ĐĂNG NHẬP ===
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });

      // Lưu vào localStorage để dùng lại khi refresh
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true, user: data.user };

    } catch (err) {
      const message = err.response?.data?.error || 'Lỗi đăng nhập';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // === ĐĂNG XUẤT ===
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  // === LẤY THÔNG TIN USER MỚI NHẤT ===
  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user });
    } catch {
      get().logout();
    }
  },

  // Helpers
  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'admin',
  isManager: () => ['admin', 'leader', 'manager'].includes(get().user?.role),
}));

export default useAuthStore;
