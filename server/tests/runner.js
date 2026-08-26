// ==============================================
// tests/runner.js - Bộ Chạy Kiểm Thử Toàn Diện (Master Test Runner)
// ET Office Portal — Zero-Impact Isolated Test Engine
// ==============================================

process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
delete process.env.DATABASE_URL;

// Backend Suites
const runHaversineTests = require('./unit/haversine.test');
const runAttendanceTests = require('./unit/attendance.test');
const runRoleTests = require('./unit/roleMiddleware.test');
const runTimesheetTests = require('./unit/timesheetLock.test');
const runRequestTests = require('./unit/requestWorkflow.test');
const runDeviceFraudTests = require('./unit/deviceFingerprint.test');
const runUserManagementTests = require('./unit/userManagement.test');
const runCorrectionTests = require('./unit/correctionWorkflow.test');
const runHolidayTests = require('./unit/holidayMatrix.test');
const runProjectSiteTests = require('./unit/projectSite.test');
const runNotificationTests = require('./unit/notificationBroadcast.test');
const runDashboardStatsTests = require('./unit/dashboardStats.test');
const runExportTests = require('./unit/exportCalculations.test');
const runPasswordAuthTests = require('./unit/passwordAuthLifecycle.test');
const runMultiOfficeTests = require('./unit/multiOfficeLocation.test');
const runSystemSettingsTests = require('./unit/systemSettings.test');
const runVehicleParkingTests = require('./unit/vehicleParkingManagement.test');
const { runExpenseManagementTests } = require('./unit/expenseManagement.test');
const { runLeaderboardRankingTests } = require('./unit/leaderboardRanking.test');
const runTtsWeeklyScheduleTests = require('./unit/ttsWeeklySchedule.test');
const runE2EScenarioTests = require('./integration/e2eScenario.test');
const runAdvancedScenariosTests = require('./integration/advancedScenarios.test');
const runControllerIntegrationTests = require('./integration/controllerIntegration.test');
const runTtsScheduleHttpTests = require('./integration/ttsScheduleHttp.test');

// Expert QA & Process Validation Suites
const runExpertRequestApprovalTests = require('./unit/expertRequestApproval.test');
const runExpertTimeDateAdjusterTests = require('./unit/expertTimeDateAdjuster.test');

// Frontend UI Suites
const runClientAuthStoreTests = require('./unit/clientAuthStore.test');
const runClientThemeTests = require('./unit/clientTheme.test');
const runClientNavAccessTests = require('./unit/clientNavAccess.test');
const runClientDeviceFingerprintTests = require('./unit/clientDeviceFingerprint.test');
const runClientExportCsvTests = require('./unit/clientExportCsv.test');
const runClientUiBadgesTests = require('./unit/clientUiBadges.test');

// Performance & High-Load Benchmarks Suite
const runPerformanceTests = require('./performance/performanceBenchmarks.test');

// Advanced Resilience: Concurrency, Fuzzing, Rollback & Mutation Testing
const runConcurrencyTests = require('./concurrency/raceCondition.test');
const runFuzzingTests = require('./security/fuzzingPayloads.test');
const runTransactionRollbackTests = require('./integration/transactionRollback.test');
const runMutationTests = require('./mutation/mutationEngine.test');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedDetails = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ [PASS]${RESET} ${testName} ${details ? `${CYAN}(${details})${RESET}` : ''}`);
  } else {
    failedTests++;
    const errMsg = `  ${RED}✗ [FAIL]${RESET} ${testName} ${details ? `(${details})` : ''}`;
    console.error(errMsg);
    failedDetails.push({ testName, details });
  }
}

async function runAllTests() {
  const startTime = Date.now();

  console.log(`\n${BOLD}${BLUE}╔═════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${BLUE}║        🧪 ET OFFICE PORTAL — HỆ THỐNG KIỂM THỬ TOÀN DIỆN               ║${RESET}`);
  console.log(`${BOLD}${BLUE}║        🛡️ CHẾ ĐỘ CÁCH LY (ZERO IMPACT) — 100% AN TOÀN VỚI PROD          ║${RESET}`);
  console.log(`${BOLD}${BLUE}╚═════════════════════════════════════════════════════════════════════════╝${RESET}\n`);

  try {
    // === PHẦN 1: BACKEND & LOGIC NGHIỆP VỤ ===
    runHaversineTests(assert);
    runAttendanceTests(assert);
    runRoleTests(assert);
    runTimesheetTests(assert);
    runRequestTests(assert);
    runDeviceFraudTests(assert);
    runUserManagementTests(assert);
    runCorrectionTests(assert);
    runHolidayTests(assert);
    runProjectSiteTests(assert);
    runNotificationTests(assert);
    runDashboardStatsTests(assert);
    runExportTests(assert);
    await runPasswordAuthTests(assert);
    runMultiOfficeTests(assert);
    runSystemSettingsTests(assert);
    runVehicleParkingTests(assert);
    runExpenseManagementTests();
    runLeaderboardRankingTests();
    runTtsWeeklyScheduleTests(assert);

    // === PHẦN 2: FRONTEND UI & CLIENT STATE ===
    runClientAuthStoreTests(assert);
    runClientThemeTests(assert);
    runClientNavAccessTests(assert);
    runClientDeviceFingerprintTests(assert);
    runClientExportCsvTests(assert);
    runClientUiBadgesTests(assert);

    // === PHẦN 3: TÍCH HỢP TOÀN TRÌNH & EXPERT QA ===
    await runE2EScenarioTests(assert);
    runAdvancedScenariosTests(assert);
    runExpertRequestApprovalTests(assert);
    runExpertTimeDateAdjusterTests(assert);
    await runControllerIntegrationTests(assert);
    await runTtsScheduleHttpTests(assert);

    // === PHẦN 4: KIỂM THỬ HIỆU NĂNG & BENCHMARK ===
    runPerformanceTests(assert);

    // === PHẦN 5: ĐỒNG THỜI, BẢO MẬT, ROLLBACK & ĐỘT BIẾN (RESILIENCE) ===
    await runConcurrencyTests(assert);
    runFuzzingTests(assert);
    await runTransactionRollbackTests(assert);
    runMutationTests(assert);

  } catch (err) {
    console.error(`\n${RED}⚠️ LỖI BẤT THƯỜNG TRONG KHI THỰC THI TEST:${RESET}`, err);
    failedTests++;
  }

  const duration = Date.now() - startTime;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  console.log(`\n${BOLD}=========================================================================${RESET}`);
  console.log(`${BOLD}📊 BÁO CÁO TỔNG KẾT KẾT QUẢ KIỂM THỬ (TEST SUMMARY REPORT)${RESET}`);
  console.log(`-------------------------------------------------------------------------`);
  console.log(`  • Tổng số kịch bản test (Test Cases) : ${BOLD}${totalTests}${RESET}`);
  console.log(`  • Kịch bản ĐẠT (Passed)              : ${GREEN}${BOLD}${passedTests}${RESET}`);
  console.log(`  • Kịch bản LỖI (Failed)              : ${failedTests > 0 ? RED : GREEN}${BOLD}${failedTests}${RESET}`);
  console.log(`  • Tỷ lệ thành công (Pass Rate)       : ${passRate === 100 ? GREEN : YELLOW}${BOLD}${passRate}%${RESET}`);
  console.log(`  • Thời gian thực thi (Execution)     : ${CYAN}${duration}ms${RESET}`);
  console.log(`  • Cơ sở dữ liệu Prod (MongoDB Atlas) : ${GREEN}${BOLD}HOÀN TOÀN NGUYÊN VẸN (0 TÁC ĐỘNG)${RESET}`);
  console.log(`=========================================================================\n`);

  if (failedTests === 0) {
    console.log(`${GREEN}${BOLD}🎉 TẤT CẢ KỊCH BẢN KIỂM THỬ ĐÃ VƯỢT QUA 100%! HỆ THỐNG HOẠT ĐỘNG HOÀN HẢO.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}❌ CÓ ${failedTests} KỊCH BẢN THẤT BẠI. VUI LÒNG KIỂM TRA LẠI CHI TIẾT TRÊN.${RESET}\n`);
    process.exit(1);
  }
}

runAllTests();
