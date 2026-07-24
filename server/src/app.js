// ==============================================
// app.js - Entry point của Backend Server (MongoDB Atlas + Static Client)
// ET Office Portal
// ==============================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./database/db');
const seedInitialData = require('./database/seed');

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================================
// RATE LIMITING - Chống spam request
// ==============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Quá nhiều yêu cầu từ IP này, thử lại sau 15 phút.' }
});

const checkInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Quá nhiều yêu cầu check-in. Thử lại sau 1 phút.' }
});

app.use('/api/', generalLimiter);

// ==============================================
// ROUTES API
// ==============================================
const authRoutes       = require('./routes/auth.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const requestRoutes    = require('./routes/request.routes');
const dashboardRoutes  = require('./routes/dashboard.routes');
const userRoutes       = require('./routes/user.routes');
const departmentRoutes = require('./routes/department.routes');
const reportRoutes        = require('./routes/report.routes');
const locationRoutes      = require('./routes/location.routes');
const projectRoutes       = require('./routes/project.routes');
const leaveBalanceRoutes  = require('./routes/leave-balance.routes');
const exportRoutes        = require('./routes/export.routes');
const correctionRoutes    = require('./routes/correction.routes');
const systemSettingRoutes = require('./routes/systemSetting.routes');

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




// HEALTH CHECK API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    db: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ==============================================
// PHỤC VỤ STATIC FILES FRONTEND REACT (PRODUCTION)
// ==============================================
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Tất cả route không phải /api thì trả về index.html của React Client
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  }
});

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
