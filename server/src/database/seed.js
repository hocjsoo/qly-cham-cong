// server/src/database/seed.js
// Khởi tạo dữ liệu ban đầu cho MongoDB (Seed Data)

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const OfficeLocation = require('../models/OfficeLocation');

const seedInitialData = async () => {
  try {
    // 1. Tạo phòng ban mặc định
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      await Department.insertMany([
        { name: 'Kiến trúc', description: 'Phòng thiết kế kiến trúc' },
        { name: 'Kết cấu', description: 'Phòng thiết kế kết cấu' },
        { name: 'Nội thất', description: 'Phòng thiết kế nội thất' },
        { name: 'Hành chính', description: 'Phòng hành chính nhân sự' },
      ]);
      console.log('🌱 Seeded default departments');
    }

    // 2. Tạo vị trí văn phòng mặc định
    const locationCount = await OfficeLocation.countDocuments();
    if (locationCount === 0) {
      const officeLat = parseFloat(process.env.OFFICE_LAT || '10.7769');
      const officeLng = parseFloat(process.env.OFFICE_LNG || '106.7009');
      await OfficeLocation.create({
        name: 'Văn phòng chính',
        lat: officeLat,
        lng: officeLng,
        radius_m: parseInt(process.env.OFFICE_RADIUS_METERS || '100'),
        is_active: true,
      });
      console.log('🌱 Seeded default office location');
    }

    // 3. Tạo tài khoản Admin mặc định
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      await User.create({
        email: 'admin@etoffice.vn',
        password_hash: passwordHash,
        full_name: 'Quản trị viên',
        role: 'admin',
        is_active: true,
      });
      console.log('🌱 Seeded default Admin user (admin@etoffice.vn / Admin@123)');
    }
  } catch (error) {
    console.error('❌ Seed data error:', error.message);
  }
};

module.exports = seedInitialData;
