// ==============================================
// database/db.js - Kết nối MongoDB Atlas via Mongoose
// ==============================================

const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Fix DNS resolution cho Windows ISP đối với mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignored if custom dns cannot be set
}

const connectDB = async () => {
  // BẢO VỆ ZERO-IMPACT: Trong môi trường kiểm thử (test), tuyệt đối không kết nối Atlas Prod
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!uri || uri.includes('<db_password>')) {
    console.warn('⚠️ CẢNH BÁO: Chưa điền <db_password> trong file server/.env!');
    console.warn('👉 Mở file server/.env và dán mật khẩu MongoDB Atlas thật của bạn vào.');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ Kết nối MongoDB Atlas thành công: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ Lỗi kết nối MongoDB: ${error.message}`);
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.error('👉 Lỗi sai Mật khẩu hoặc Sai tên Database User trên MongoDB Atlas!');
      console.error('👉 Đồng thời nhớ kiểm tra Network Access trên Atlas đã add IP "0.0.0.0/0" chưa.');
    }
    throw error;
  }
};

module.exports = connectDB;
