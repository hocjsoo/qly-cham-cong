// ==============================================
// tests/security/fuzzingPayloads.test.js
// Kiểm thử Dữ liệu Rác, Biên Độ, Fuzzing & Chống Tấn Công (Adversarial Security Fuzzing)
// ==============================================

function validateGPSInput(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { valid: false, error: 'GPS bắt buộc để chấm công.' };
  }
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) {
    return { valid: false, error: 'Tọa độ GPS không hợp lệ (không phải số thực).' };
  }
  if (numLat < -90 || numLat > 90) {
    return { valid: false, error: 'Vĩ độ GPS phải nằm trong khoảng từ -90 đến +90 độ.' };
  }
  if (numLng < -180 || numLng > 180) {
    return { valid: false, error: 'Kinh độ GPS phải nằm trong khoảng từ -180 đến +180 độ.' };
  }
  return { valid: true, lat: numLat, lng: numLng };
}

function sanitizeAuthInput(email, password) {
  // Chống NoSQL Injection (ví dụ { "$ne": null } hoặc { "$gt": "" })
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { valid: false, error: 'Email và mật khẩu phải là chuỗi ký tự hợp lệ (String).' };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || cleanEmail.length > 254) {
    return { valid: false, error: 'Định dạng email không hợp lệ.' };
  }
  return { valid: true, email: cleanEmail };
}

function validateLeaveRequestPayload(payload) {
  const { type, start_date, end_date, reason } = payload;
  if (!type || !start_date || !reason) {
    return { valid: false, error: 'Thiếu thông tin bắt buộc.' };
  }
  if (typeof reason !== 'string' || reason.trim().length < 3) {
    return { valid: false, error: 'Lý do quá ngắn.' };
  }
  if (reason.length > 2000) {
    return { valid: false, error: 'Lý do vượt quá giới hạn cho phép (tối đa 2000 ký tự).' };
  }

  // Kiểm tra ngày bắt đầu <= ngày kết thúc
  const start = new Date(start_date);
  const end = new Date(end_date || start_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' };
  }
  if (end < start) {
    return { valid: false, error: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.' };
  }

  return { valid: true };
}

function runFuzzingTests(assert) {
  console.log('\n🛡️ [TEST SUITE: ADVERSARIAL FUZZING & INJECTION RESISTANCE]');

  // TC-FUZZ-01: GPS dạng chuỗi chữ "mười độ"
  const g1 = validateGPSInput('mười độ', 'một trăm độ');
  assert(g1.valid === false && g1.error.includes('không phải số thực'),
    'TC-FUZZ-01: Chặn GPS dạng chuỗi chữ "mười độ"');

  // TC-FUZZ-02: GPS null hoặc undefined
  const g2 = validateGPSInput(null, undefined);
  assert(g2.valid === false && g2.error.includes('GPS bắt buộc'),
    'TC-FUZZ-02: Chặn GPS null/undefined');

  // TC-FUZZ-03: GPS vượt quá biên độ trái đất (Vĩ độ 9999.9999 độ)
  const g3 = validateGPSInput(9999.9999, 106.7009);
  assert(g3.valid === false && g3.error.includes('-90 đến +90'),
    'TC-FUZZ-03: Chặn vĩ độ phi lý 9999.9999 độ (vượt ngoài phạm vi -90 đến 90)');

  // TC-FUZZ-04: GPS kinh độ vượt ngoài -180 đến +180 độ
  const g4 = validateGPSInput(10.7769, -999.999);
  assert(g4.valid === false && g4.error.includes('-180 đến +180'),
    'TC-FUZZ-04: Chặn kinh độ phi lý -999.999 độ');

  // TC-FUZZ-05: NoSQL Injection Object vào Email đăng nhập { "$ne": null }
  const auth1 = sanitizeAuthInput({ "$ne": null }, 'password123');
  assert(auth1.valid === false && auth1.error.includes('phải là chuỗi'),
    'TC-FUZZ-05: Chặn NoSQL Injection Object {$ne: null} vào trường Email');

  // TC-FUZZ-06: Đơn nghỉ phép có ngày kết thúc trước ngày bắt đầu (2026-08-20 -> 2026-08-10)
  const req1 = validateLeaveRequestPayload({
    type: 'annual_leave',
    start_date: '2026-08-20',
    end_date: '2026-08-10',
    reason: 'Xin nghỉ phép nghịch lý'
  });
  assert(req1.valid === false && req1.error.includes('không được nhỏ hơn'),
    'TC-FUZZ-06: Chặn đơn nghỉ phép có ngày kết thúc < ngày bắt đầu');

  // TC-FUZZ-07: Payload lý do quá lớn (DDoS Buffer Attack > 10,000 ký tự)
  const hugeReason = 'A'.repeat(10000);
  const req2 = validateLeaveRequestPayload({
    type: 'annual_leave',
    start_date: '2026-08-20',
    end_date: '2026-08-20',
    reason: hugeReason
  });
  assert(req2.valid === false && req2.error.includes('vượt quá giới hạn'),
    'TC-FUZZ-07: Chặn payload tràn bộ nhớ (Reason vượt quá 2000 ký tự)');
}

module.exports = runFuzzingTests;
