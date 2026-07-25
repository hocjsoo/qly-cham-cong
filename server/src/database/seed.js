// server/src/database/seed.js
// Khởi tạo dữ liệu ban đầu cho MongoDB (Seed Data) — Production Ready

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const OfficeLocation = require('../models/OfficeLocation');
const SystemSetting = require('../models/SystemSetting');

const seedInitialData = async () => {
  try {
    // 1. Tạo phòng ban mặc định cho công ty kiến trúc ET Architects
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      await Department.insertMany([
        { name: 'Kiến trúc', description: 'Phòng thiết kế kiến trúc & ý tưởng' },
        { name: 'Kết cấu', description: 'Phòng thiết kế kết cấu & kỹ thuật' },
        { name: 'Nội thất', description: 'Phòng thiết kế & thi công nội thất' },
        { name: 'Dự án', description: 'Phòng quản lý dự án & giám sát công trình' },
        { name: 'Hành chính', description: 'Phòng hành chính nhân sự & kế toán' },
      ]);
      console.log('🌱 Seeded default departments (ET Architects)');
    }

    // 2. Tạo vị trí văn phòng mặc định
    const locationCount = await OfficeLocation.countDocuments();
    if (locationCount === 0) {
      const officeLat = parseFloat(process.env.OFFICE_LAT || '10.7769');
      const officeLng = parseFloat(process.env.OFFICE_LNG || '106.7009');
      await OfficeLocation.create({
        name: 'Văn phòng chính ET Architects',
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
        company_name: 'ET Architects',
        work_start_time: '08:30',
        work_end_time: '17:30',
        ot_start_time: '18:00',
        late_minor_mins: 10,
        late_medium_mins: 30,
        allow_wfh: true,
        auto_checkout: true,
      });
      console.log('🌱 Seeded global system settings (8:30 - 17:30, OT from 18:00)');
    }

    // 4. Tạo tài khoản Admin mặc định
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      await User.create({
        email: 'admin@etoffice.vn',
        password_hash: passwordHash,
        full_name: 'Quản trị viên HT',
        role: 'admin',
        must_change_password: false,
        is_active: true,
      });
      console.log('🌱 Seeded default Admin user (admin@etoffice.vn / Admin@123)');
    }
  } catch (error) {
    console.error('❌ Seed data error:', error.message);
  }
};

module.exports = seedInitialData;
