// ==============================================
// server.js - Production & Development HTTP Server Entry Point
// ET Office Portal
// ==============================================

require('dotenv').config();
const app = require('./app');
const connectDB = require('./database/db');
const seedInitialData = require('./database/seed');

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Kết nối Database & Khởi tạo Dữ liệu hạt giống
    await connectDB();
    await seedInitialData();

    // Khởi động HTTP Server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║     ET OFFICE PORTAL — LIVE FULLSTACK SERVER         ║
  ║     🚀 Đang chạy tại port ${PORT}                      ║
  ║     🌐 Web Client & API sẵn sàng!                    ║
  ╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Lỗi khởi động máy chủ:', error);
    process.exit(1);
  }
}

bootstrap();
