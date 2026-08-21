// ==============================================
// tests/unit/deviceFingerprint.test.js
// Kiểm thử Thuật toán Chống gian lận Thiết bị (Anti-Fraud Device Session)
// ==============================================

function detectCrossAccountFraud(todayLogs, currentUserId, currentHardwareUuid, currentIP) {
  let isFlagged = false;
  const flagReasons = [];

  const otherUsersUsingDevice = todayLogs.filter(log => {
    if (!log.user_id) return false;
    const logUserId = log.user_id.toString();
    if (logUserId === currentUserId.toString()) return false;
    return (currentHardwareUuid && log.hardware_uuid === currentHardwareUuid) || (currentIP && log.ip_address === currentIP);
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
  const check1 = detectCrossAccountFraud(mockTodayLogs, 'user_A', 'HW-UUID-8899', '14.232.10.5');
  assert(check1.isFlagged === false && check1.conflictingCount === 0,
    'TC-DEV-01: Nhân viên A chấm công trên thiết bị cá nhân -> Hợp lệ, không gắn cờ');

  // TC-DEV-02: Nhân viên C dùng chung máy tính của nhân viên A (cùng Hardware UUID) -> Bị Flag gian lận
  const check2 = detectCrossAccountFraud(mockTodayLogs, 'user_C', 'HW-UUID-8899', '14.232.10.99');
  assert(check2.isFlagged === true && check2.conflictingCount === 1,
    'TC-DEV-02: Phát hiện tài khoản C dùng chung thiết bị HW-UUID của tài khoản A -> Gắn cờ gian lận (is_flagged=true)');

  // TC-DEV-03: Nhân viên C dùng thiết bị độc lập hoàn toàn -> Không flag
  const check3 = detectCrossAccountFraud(mockTodayLogs, 'user_C', 'HW-UUID-9999', '14.232.10.99');
  assert(check3.isFlagged === false,
    'TC-DEV-03: Nhân viên C dùng thiết bị độc lập mới -> Hợp lệ, không gắn cờ');
}

module.exports = runDeviceFraudTests;
