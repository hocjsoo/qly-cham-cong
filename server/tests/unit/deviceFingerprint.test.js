// ==============================================
// tests/unit/deviceFingerprint.test.js
// Kiểm thử Thuật toán Chống gian lận Thiết bị (Anti-Fraud Device Session)
// ==============================================

const fs = require('fs');
const path = require('path');

function detectCrossAccountFraud(todayLogs, currentUserId, currentHardwareUuid) {
  let isFlagged = false;
  const flagReasons = [];

  const otherUsersUsingDevice = todayLogs.filter(log => {
    if (!log.user_id) return false;
    const logUserId = log.user_id.toString();
    if (logUserId === currentUserId.toString()) return false;
    // Shared office/Wi-Fi IP is audit metadata only. Only a non-empty exact
    // hardware identifier can prove the same physical device was reused.
    return Boolean(currentHardwareUuid && log.hardware_uuid === currentHardwareUuid);
  });

  if (otherUsersUsingDevice.length > 0) {
    isFlagged = true;
    const names = otherUsersUsingDevice.map(l => l.full_name || l.user_id).join(', ');
    flagReasons.push(`Phát hiện thiết bị/IP này đã chấm công cho nhân viên khác trong hôm nay (${names})`);
  }

  return { isFlagged, flagReasons, conflictingCount: otherUsersUsingDevice.length };
}

function runDeviceFraudTests(assert) {
  console.log('\n🔒 [TEST SUITE: DEVICE FINGERPRINT & ANTI-FRAUD]');

  const mockTodayLogs = [
    { user_id: 'user_A', full_name: 'Nguyễn Văn A', hardware_uuid: 'HW-UUID-8899', ip_address: '14.232.10.5' },
    { user_id: 'user_B', full_name: 'Trần Thị B', hardware_uuid: 'HW-UUID-1122', ip_address: '14.232.10.6' },
  ];

  // TC-DEV-01: Nhân viên A chấm công trên chính thiết bị của mình -> Bình thường (Không flag)
  const check1 = detectCrossAccountFraud(mockTodayLogs, 'user_A', 'HW-UUID-8899');
  assert(check1.isFlagged === false && check1.conflictingCount === 0,
    'TC-DEV-01: Nhân viên A chấm công trên thiết bị cá nhân -> Hợp lệ, không gắn cờ');

  // TC-DEV-02: Nhân viên C dùng chung máy tính của nhân viên A (cùng Hardware UUID) -> Bị Flag gian lận
  const check2 = detectCrossAccountFraud(mockTodayLogs, 'user_C', 'HW-UUID-8899');
  assert(check2.isFlagged === true && check2.conflictingCount === 1,
    'TC-DEV-02: Phát hiện tài khoản C dùng chung thiết bị HW-UUID của tài khoản A -> Gắn cờ gian lận (is_flagged=true)');

  // TC-DEV-03: Nhân viên C dùng thiết bị độc lập hoàn toàn -> Không flag
  const check3 = detectCrossAccountFraud(mockTodayLogs, 'user_C', 'HW-UUID-9999');
  assert(check3.isFlagged === false,
    'TC-DEV-03: Nhân viên C dùng thiết bị độc lập mới -> Hợp lệ, không gắn cờ');

  // TC-DEV-04: Nhiều nhân viên ngồi gần nhau/dùng chung Wi-Fi có thể cùng IP.
  const sameOfficeIpLogs = [
    ...mockTodayLogs,
    { user_id: 'user_D', full_name: 'Nhân viên D', hardware_uuid: 'HW-UUID-4455', ip_address: '14.232.10.5' },
  ];
  const check4 = detectCrossAccountFraud(sameOfficeIpLogs, 'user_C', 'HW-UUID-9999');
  assert(check4.isFlagged === false,
    'TC-DEV-04: Dùng chung IP/Wi-Fi nhưng khác hardware UUID -> Không bắt selfie, không gắn cờ');

  const check5 = detectCrossAccountFraud(sameOfficeIpLogs, 'user_C', '');
  assert(check5.isFlagged === false,
    'TC-DEV-05: Không có hardware UUID -> IP không được dùng làm bằng chứng trùng thiết bị');

  const attendanceController = fs.readFileSync(
    path.resolve(__dirname, '../../src/controllers/attendanceController.js'),
    'utf8'
  );
  const attendanceModel = fs.readFileSync(
    path.resolve(__dirname, '../../src/models/Attendance.js'),
    'utf8'
  );
  assert(
    attendanceController.includes('Attendance.findOne({\n        date: dateStr,\n        hardware_uuid: effectiveHardwareUuid,')
      && !attendanceController.includes('sameIPInNote')
      && attendanceModel.includes("attendanceSchema.index({ date: 1, hardware_uuid: 1, user_id: 1 })"),
    'TC-DEV-06: Production dùng exact indexed hardware lookup và không quét IP/note để bắt selfie'
  );
}

module.exports = runDeviceFraudTests;
