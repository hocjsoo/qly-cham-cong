import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phép kết nối từ điện thoại trong cùng mạng WiFi
    port: 5173
  }
})
