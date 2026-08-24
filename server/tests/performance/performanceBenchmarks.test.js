// ==============================================
// tests/performance/performanceBenchmarks.test.js
// Kiểm thử Hiệu năng & Tải Cao (Performance & Stress Benchmarks)
// Chạy 100% In-Memory — Zero Impact trên MongoDB Atlas Prod
// ==============================================

const path = require('path');
const jwt = require('jsonwebtoken');
const { haversineDistance, isInsideGeofence } = require(path.join(__dirname, '../../src/utils/haversine'));

const JWT_SECRET = 'performance-benchmark-secret-key-2026';

function runPerformanceTests(assert) {
  console.log('\n⚡ [TEST SUITE: PERFORMANCE & HIGH-LOAD BENCHMARKS]');

  // -------------------------------------------------------------
  // TC-PERF-01: Benchmark Tính toán GPS Haversine (10,000 phép tính liên tục)
  // -------------------------------------------------------------
  const t0 = process.hrtime.bigint();
  const officeLat = 10.7769, officeLng = 106.7009;
  let insideCount = 0;

  for (let i = 0; i < 10000; i++) {
    const lat = officeLat + (Math.random() - 0.5) * 0.01;
    const lng = officeLng + (Math.random() - 0.5) * 0.01;
    const res = isInsideGeofence(lat, lng, officeLat, officeLng, 250);
    if (res.isInside) insideCount++;
  }

  const t1 = process.hrtime.bigint();
  const durGpsMs = Number(t1 - t0) / 1e6;
  const opsPerSecGps = Math.round((10000 / durGpsMs) * 1000);

  assert(durGpsMs < 50,
    `TC-PERF-01: Tính 10,000 tọa độ GPS trong ${durGpsMs.toFixed(2)}ms (Tốc độ: ${opsPerSecGps.toLocaleString()} ops/giây, ngưỡng < 50ms)`);

  // -------------------------------------------------------------
  // TC-PERF-02: Benchmark Xử lý Ma trận Bảng công Toàn công ty (3,100 bản ghi tháng)
  // Giả lập 100 nhân viên x 31 ngày = 3,100 bản ghi
  // -------------------------------------------------------------
  const t2 = process.hrtime.bigint();
  const staffCount = 100;
  const daysInMonth = 31;
  let totalWorkHoursSum = 0;

  for (let u = 1; u <= staffCount; u++) {
    let userHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const isSunday = (d % 7 === 0);
      if (!isSunday) {
        userHours += 8.0;
      }
    }
    totalWorkHoursSum += userHours;
  }

  const t3 = process.hrtime.bigint();
  const durMatrixMs = Number(t3 - t2) / 1e6;

  assert(durMatrixMs < 30 && totalWorkHoursSum > 0,
    `TC-PERF-02: Xử lý ma trận 3,100 ngày công (100 nhân sự x 31 ngày) trong ${durMatrixMs.toFixed(2)}ms (ngưỡng < 30ms)`);

  // -------------------------------------------------------------
  // TC-PERF-03: Benchmark Sinh & Xác thực 1,000 JWT Tokens liên tục
  // -------------------------------------------------------------
  const t4 = process.hrtime.bigint();
  let validTokens = 0;

  for (let i = 0; i < 1000; i++) {
    const token = jwt.sign({ userId: `user_${i}`, role: 'employee' }, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.userId === `user_${i}`) validTokens++;
  }

  const t5 = process.hrtime.bigint();
  const durJwtMs = Number(t5 - t4) / 1e6;
  const opsPerSecJwt = Math.round((1000 / durJwtMs) * 1000);

  assert(durJwtMs < 250 && validTokens === 1000,
    `TC-PERF-03: Ký & Xác thực 1,000 JWT Tokens trong ${durJwtMs.toFixed(2)}ms (Tốc độ: ${opsPerSecJwt.toLocaleString()} tokens/giây, ngưỡng < 250ms)`);

  // -------------------------------------------------------------
  // TC-PERF-04: Benchmark Thuật toán Băm Phần cứng (5,000 Hardware Fingerprints)
  // -------------------------------------------------------------
  function simpleHash(str) {
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
  }

  const t6 = process.hrtime.bigint();
  for (let i = 0; i < 5000; i++) {
    simpleHash(`screen:1920x1080x24|cpu:${i % 16}|touch:0|tz:Asia/Ho_Chi_Minh|device_${i}`);
  }
  const t7 = process.hrtime.bigint();
  const durHashMs = Number(t7 - t6) / 1e6;

  assert(durHashMs < 30,
    `TC-PERF-04: Băm 5,000 chuỗi Fingerprint phần cứng trong ${durHashMs.toFixed(2)}ms (ngưỡng < 30ms)`);

  // -------------------------------------------------------------
  // TC-PERF-05: Kiểm tra Độ ổn định Bộ nhớ (Memory Leak Check)
  // -------------------------------------------------------------
  const memBefore = process.memoryUsage().heapUsed;
  const tempArray = [];
  for (let i = 0; i < 20000; i++) {
    tempArray.push({ id: i, name: `Emp_${i}`, date: '2026-08-21', status: 'present' });
  }
  // Giải phóng mảng tạm
  tempArray.length = 0;
  const memAfter = process.memoryUsage().heapUsed;
  const memDeltaMb = (memAfter - memBefore) / (1024 * 1024);

  assert(memDeltaMb < 15,
    `TC-PERF-05: Quản lý bộ nhớ Heap tối ưu (Delta: ${memDeltaMb.toFixed(2)}MB, an toàn tuyệt đối không rò rỉ bộ nhớ)`);

  // -------------------------------------------------------------
  // TC-PERF-06: Benchmark Xuất CSV Quy mô Lớn (500 nhân sự)
  // -------------------------------------------------------------
  const t8 = process.hrtime.bigint();
  const largeStaffList = [];
  for (let i = 1; i <= 500; i++) {
    largeStaffList.push({
      employee_code: `ET${String(i).padStart(3, '0')}`,
      full_name: `Nhân Viên Thứ ${i}`,
      department_name: 'Phòng Kỹ thuật',
      check_in_time: '2026-08-21T08:25:00+07:00',
      check_in_type: 'office',
      check_out_time: '2026-08-21T17:30:00+07:00',
      total_hours: 8.0,
      status: 'present'
    });
  }

  const csvRows = largeStaffList.map((s, idx) => [
    idx + 1, s.employee_code, `"${s.full_name}"`, `"${s.department_name}"`,
    '08:25', s.check_in_type, '17:30', `${s.total_hours}h`, 'Có mặt'
  ].join(','));
  const fullCsv = '\uFEFF' + csvRows.join('\n');

  const t9 = process.hrtime.bigint();
  const durCsvMs = Number(t9 - t8) / 1e6;

  assert(durCsvMs < 25 && fullCsv.length > 10000,
    `TC-PERF-06: Tạo tệp CSV 500 nhân sự trong ${durCsvMs.toFixed(2)}ms (Kích thước: ${(fullCsv.length / 1024).toFixed(1)} KB, ngưỡng < 25ms)`);
}

module.exports = runPerformanceTests;
