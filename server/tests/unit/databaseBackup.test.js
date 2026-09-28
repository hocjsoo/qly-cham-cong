// server/tests/unit/databaseBackup.test.js
// Kiểm thử Zero-Impact: Kiểm tra cơ chế sao lưu nén GZIP và toàn vẹn dữ liệu

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { exportDatabaseBackup } = require('../../src/database/backup');

async function runDatabaseBackupTests(assert) {
  console.log('\n💾 [TEST SUITE: DATABASE BACKUP & DATA RESILIENCE]');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-backup-test-'));

  try {
    // 1. Kiểm tra bắt lỗi khi thiếu MONGODB_URI và không truyền db
    let errorCaught = false;
    try {
      await exportDatabaseBackup({ mongoUri: '' });
    } catch (e) {
      errorCaught = e.message.includes('MONGODB_URI');
    }
    assert(errorCaught, 'TC-BAK-01: Bắt lỗi rõ ràng khi không có cấu hình chuỗi kết nối MONGODB_URI');

    // 2. Kiểm thử tạo file và nén gzip toàn vẹn với mock db độc lập (Zero-Impact, không chạm mongoose.connection)
    const mockDocs = [
      { id: 1, name: 'Nguyễn Văn A', role: 'admin' },
      { id: 2, name: 'Trần Thị B', role: 'employee' }
    ];

    const fakeDb = {
      databaseName: 'mock_test_db',
      listCollections: () => ({
        toArray: async () => [{ name: 'users' }, { name: 'system.indexes' }]
      }),
      collection: (name) => ({
        find: () => ({
          toArray: async () => (name === 'users' ? mockDocs : [])
        })
      })
    };

    const backupResult = await exportDatabaseBackup({
      db: fakeDb,
      outputDir: tempDir
    });

    assert(
      backupResult && backupResult.success === true && fs.existsSync(backupResult.outputPath),
      'TC-BAK-02: Tạo tệp sao lưu nén định dạng .json.gz thành công trong thư mục chỉ định'
    );

    // 3. Giải nén và kiểm tra tính toàn vẹn 100% dữ liệu
    const compressedBuf = fs.readFileSync(backupResult.outputPath);
    const decompressedJson = JSON.parse(zlib.gunzipSync(compressedBuf).toString('utf-8'));

    assert(
      decompressedJson.database === 'mock_test_db' &&
      decompressedJson.collections.users?.length === 2 &&
      decompressedJson.collections.users[0].name === 'Nguyễn Văn A' &&
      !decompressedJson.collections['system.indexes'],
      'TC-BAK-03: Dữ liệu giải nén nguyên vẹn 100%, bỏ qua system collections'
    );

  } finally {
    // Dọn dẹp temp directory sau khi test
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = runDatabaseBackupTests;
