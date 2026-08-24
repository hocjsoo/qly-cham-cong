// ==============================================
// app.js - Entry point của Backend Server (MongoDB Atlas + API)
// ET Office Portal
// ==============================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./database/db');
const seedInitialData = require('./database/seed');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Vercel, Render.com) để lấy chính xác Client IP cho Rate Limiter
app.set('trust proxy', 1);

// Kết nối Database & Seed Data
connectDB().then(() => {
  seedInitialData();
});

// ==============================================
// MIDDLEWARE CƠ BẢN
// ==============================================
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==============================================
// RATE LIMITING - Chống spam request
// ==============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, // Tăng lên 5000 request / 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.ip === '127.0.0.1' ||
    req.ip === '::1' ||
    req.ip === '::ffff:127.0.0.1' ||
    process.env.NODE_ENV !== 'production',
  message: { error: 'Quá nhiều yêu cầu từ IP này, thử lại sau 15 phút.' }
});

const checkInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Thao tác quá nhanh, vui lòng chờ 1 phút.' }
});

app.use('/api', generalLimiter);

// ==============================================
// ROUTES IMPORTS & MOUNTING
// ==============================================
const authRoutes          = require('./routes/auth.routes');
const attendanceRoutes    = require('./routes/attendance.routes');
const requestRoutes       = require('./routes/request.routes');
const dashboardRoutes     = require('./routes/dashboard.routes');
const userRoutes          = require('./routes/user.routes');
const departmentRoutes   = require('./routes/department.routes');
const reportRoutes        = require('./routes/report.routes');
const locationRoutes      = require('./routes/location.routes');
const projectRoutes       = require('./routes/project.routes');
const leaveBalanceRoutes  = require('./routes/leave-balance.routes');
const exportRoutes        = require('./routes/export.routes');
const correctionRoutes    = require('./routes/correction.routes');
const systemSettingRoutes = require('./routes/systemSetting.routes');
const notificationRoutes  = require('./routes/notification.routes');
const holidayRoutes       = require('./routes/holiday.routes');
const timesheetLockRoutes = require('./routes/timesheetLock.routes');
const announcementRoutes  = require('./routes/announcement.routes');
const expenseRoutes       = require('./routes/expense.routes');

app.use('/api/auth',          authRoutes);
app.use('/api/attendance',    checkInLimiter, attendanceRoutes);
app.use('/api/requests',      requestRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/departments',   departmentRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/locations',     locationRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/api/leave-balance', leaveBalanceRoutes);
app.use('/api/export',        exportRoutes);
app.use('/api/corrections',   correctionRoutes);
app.use('/api/settings',      systemSettingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/holidays',      holidayRoutes);
app.use('/api/timesheet-lock',timesheetLockRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/expenses',      expenseRoutes);

// HEALTH CHECK API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    db: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// ==============================================
// PHỤC VỤ STATIC FILES FRONTEND REACT (NẾU CÓ)
// ==============================================
const clientDistPath = path.join(__dirname, '../../client/dist');
const indexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(indexPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: '🚀 ET Office Portal Backend API is Live!',
      health: '/api/health',
      docs: 'API is ready for Vercel Frontend Connection'
    });
  });
}

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('Lỗi server:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Lỗi server nội bộ',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// KHỞI ĐỘNG SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║     ET OFFICE PORTAL — LIVE FULLSTACK SERVER         ║
  ║     🚀 Đang chạy tại port ${PORT}                      ║
  ║     🌐 Web Client & API sẵn sàng!                    ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
