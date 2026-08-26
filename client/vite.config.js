import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phép kết nối từ điện thoại trong cùng mạng WiFi
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('purify')) return 'vendor-pdf';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('zustand') || id.includes('axios')) return 'vendor-core';
          }
        }
      }
    }
  }
})

