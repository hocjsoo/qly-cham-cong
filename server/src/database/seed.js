// server/src/database/seed.js
// Khởi tạo dữ liệu ban đầu cho MongoDB (Seed Data) — Production Ready

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const OfficeLocation = require('../models/OfficeLocation');
const SystemSetting = require('../models/SystemSetting');

const seedInitialData = async () => {
  try {
    // 1. Tạo phòng ban mặc định cho Kiến trúc ET
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      await Department.insertMany([
        { name: 'Kiến trúc', description: 'Phòng thiết kế kiến trúc & ý tưởng' },
        { name: 'Kết cấu', description: 'Phòng thiết kế kết cấu & kỹ thuật' },
        { name: 'Nội thất', description: 'Phòng thiết kế & thi công nội thất' },
        { name: 'Dự án', description: 'Phòng quản lý dự án & giám sát công trình' },
        { name: 'Hành chính', description: 'Phòng hành chính nhân sự & kế toán' },
      ]);
      console.log('🌱 Seeded default departments (Kiến trúc ET)');
    }

    // 2. Tạo vị trí văn phòng mặc định
    const locationCount = await OfficeLocation.countDocuments();
    if (locationCount === 0) {
      const officeLat = parseFloat(process.env.OFFICE_LAT || '10.7769');
      const officeLng = parseFloat(process.env.OFFICE_LNG || '106.7009');
      await OfficeLocation.create({
        name: 'Văn phòng chính Kiến trúc ET',
        address: 'Thành phố Hồ Chí Minh',
        lat: officeLat,
        lng: officeLng,
        radius_m: parseInt(process.env.OFFICE_RADIUS_METERS || '100'),
        is_active: true,
      });
      console.log('🌱 Seeded default office location');
    }

    // 3. Tạo Cấu hình ca làm mặc định
    const settingCount = await SystemSetting.countDocuments({ key: 'global' });
    if (settingCount === 0) {
      await SystemSetting.create({
        key: 'global',
        company_name: 'Kiến trúc ET',
        company_logo_url: '/logo.png',
        work_start_time: '08:30',
        work_end_time: '17:30',
        lunch_break_start: '12:00',
        lunch_break_end: '13:00',
        ot_start_time: '18:00',
        ot_mode: 'manual',         // OT do giam doc xet cuoi thang
        minor_late_mins: 10,
        medium_late_mins: 30,
        working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], // Lam ca T7, nghi CN
      });
      console.log('🌱 Seeded global system settings (8:30 - 17:30, Mon-Sat, OT manual mode)');
    } else {
      // Update existing settings to add working_days Sat if not set
      const existing = await SystemSetting.findOne({ key: 'global' });
      if (existing && (!existing.working_days || existing.working_days.length <= 5)) {
        existing.working_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        if (!existing.ot_mode) existing.ot_mode = 'manual';
        if (!existing.company_name) existing.company_name = 'Kiến trúc ET';
        await existing.save();
        console.log('🌱 Updated working_days to include Saturday');
      }
    }

    // 4. Tạo tài khoản Admin mặc định (nếu chưa có bất kỳ Admin nào)
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const initialEmail = process.env.INITIAL_ADMIN_EMAIL;
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (!initialEmail || !initialPassword) {
        throw new Error('Thiếu INITIAL_ADMIN_EMAIL hoặc INITIAL_ADMIN_PASSWORD; từ chối tạo Admin với mật khẩu mặc định.');
      }
      const passwordHash = await bcrypt.hash(initialPassword, 10);
      await User.create({
        email: initialEmail,
        password_hash: passwordHash,
        full_name: 'Quản trị viên Hệ thống',
        role: 'admin',
        must_change_password: true,
        is_active: true,
      });
      console.log(`🌱 Initialized first Admin user (${initialEmail}) — Please change password upon first login`);
    }
  } catch (error) {
    console.error('❌ Seed data error:', error.message);
    if (process.env.NODE_ENV === 'production') throw error;
  }
};

module.exports = seedInitialData;
