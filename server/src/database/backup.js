// server/src/database/backup.js
// Script sao lưu cơ sở dữ liệu MongoDB Atlas tự động ra tệp nén JSON.GZ
// Không thêm phụ thuộc bên ngoài (sử dụng native Node.js zlib & fs)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');

async function exportDatabaseBackup(options = {}) {
  const targetDir = options.outputDir || path.resolve(__dirname, '../../backups');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/:/g, '-');

  let db = options.db;
  let shouldDisconnect = false;

  if (!db) {
    const mongoUri = options.mongoUri || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI không được tìm thấy trong biến môi trường.');
    }
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) {
      await mongoose.connect(mongoUri);
      shouldDisconnect = true;
    }
    db = mongoose.connection.db;
  }

  try {
    const dbName = db.databaseName;
    const collections = await db.listCollections().toArray();

    const backupPayload = {
      database: dbName,
      created_at: now.toISOString(),
      date_vn: `${dateStr} ${timeStr}`,
      total_collections: collections.length,
      collections: {},
    };

    let totalDocuments = 0;

    for (const colInfo of collections) {
      const colName = colInfo.name;
      // Bỏ qua các system collections nếu có
      if (colName.startsWith('system.')) continue;

      const docs = await db.collection(colName).find({}).toArray();
      backupPayload.collections[colName] = docs;
      totalDocuments += docs.length;
    }

    backupPayload.total_documents = totalDocuments;

    const rawJson = JSON.stringify(backupPayload);
    const compressed = zlib.gzipSync(Buffer.from(rawJson, 'utf-8'));

    const filename = `backup_${dbName}_${dateStr}_${timeStr}.json.gz`;
    const outputPath = path.join(targetDir, filename);

    fs.writeFileSync(outputPath, compressed);

    const stats = fs.statSync(outputPath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    const result = {
      success: true,
      database: dbName,
      outputPath,
      filename,
      sizeKb: `${sizeKb} KB`,
      totalCollections: collections.length,
      totalDocuments,
      timestamp: now.toISOString(),
    };

    return result;
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }
}

// Chạy trực tiếp từ dòng lệnh: node server/src/database/backup.js
if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  exportDatabaseBackup()
    .then(res => {
      console.log('==============================================');
      console.log('✅ SAO LƯU DỮ LIỆU ATLAS THÀNH CÔNG');
      console.log('==============================================');
      console.log(`- Database     : ${res.database}`);
      console.log(`- Collections  : ${res.totalCollections}`);
      console.log(`- Documents    : ${res.totalDocuments}`);
      console.log(`- Dung lượng   : ${res.sizeKb}`);
      console.log(`- Tệp sao lưu  : ${res.outputPath}`);
      console.log('==============================================');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Lỗi sao lưu database:', err.message);
      process.exit(1);
    });
}

module.exports = { exportDatabaseBackup };
