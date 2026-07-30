// src/services/api.js
// Axios instance hỗ trợ Render.com & Vercel deployment với timeout 15s

import axios from 'axios';
import { mockRequest } from './mockApi';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000, // Timeout 15s phù hợp với Render.com free tier cold start
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor Request: Gắn JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor Response: Tự động dùng Offline Mock Engine nếu server sập hoặc trả HTML
api.interceptors.response.use(
  async (response) => {
    // Nếu API trả về chuỗi HTML (<!DOCTYPE html>), đây là do Vercel rewrite route chưa kết nối tới backend
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE')) {
      console.warn('⚠️ API trả về HTML index.html thay vì JSON. Chuyển sang OFFLINE MOCK MODE!');
      try {
        const config = response.config;
        const method = (config.method || 'get').toLowerCase();
        const url = config.url || '';
        let data = {};
        if (config.data) {
          data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        }
        return await mockRequest(method, url, data);
      } catch (mockErr) {
        return response;
      }
    }
    return response;
  },
  async (error) => {
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';

    if (isNetworkError || error.response?.status >= 500 || error.response?.status === 404) {
      console.warn('⚠️ Server Backend không phản hồi. Tự động chuyển sang OFFLINE MOCK MODE!');
      try {
        const config = error.config || {};
        const method = (config.method || 'get').toLowerCase();
        const url = config.url || '';
        let data = {};
        if (config.data) {
          data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        }

        const mockRes = await mockRequest(method, url, data);
        return mockRes;
      } catch (mockErr) {
        return Promise.reject(mockErr);
      }
    }

    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
