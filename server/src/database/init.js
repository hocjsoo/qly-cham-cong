// server/src/database/init.js
// Script kiểm tra kết nối Database & thông báo hướng dẫn Supabase

require('dotenv').config();
const { query } = require('./db');
const fs = require('fs');
const path = require('path');

async function testConnection() {
  console.log('🔄 Đang kiểm tra kết nối Database...');
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[PASSWORD]')) {
    console.error('❌ Lỗi: Bạn chưa cấu hình DATABASE_URL trong file server/.env');
    console.log('💡 Hướng dẫn:');
    console.log('  1. Tạo project miễn phí trên https://supabase.com');
    console.log('  2. Vào Settings → Database → Connection string (URI)');
    console.log('  3. Copy URI và dán vào file server/.env (nhớ thay password)');
    process.exit(1);
  }

  try {
    const res = await query('SELECT NOW()');
    console.log('✅ Kết nối Supabase PostgreSQL thành công!');
    console.log(`⏰ Thới gian DB server: ${res.rows[0].now}`);

    // Kiểm tra xem bảng users đã tồn tại chưa
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Bảng dữ liệu đã sẵn sàng!');
    } else {
      console.log('⚠️ Bảng dữ liệu chưa được khởi tạo.');
      console.log('👉 Vui lòng dán nội dung file database/schema.sql vào Supabase SQL Editor và chạy!');
    }
  } catch (err) {
    console.error('❌ Lỗi kết nối Database:', err.message);
  } finally {
    process.exit(0);
  }
}

testConnection();
