// ==============================================
// tests/unit/clientDeviceFingerprint.test.js
// Kiểm thử Thuật toán Băm Phần Cứng & Nhận Diện Thiết Bị Client
// ==============================================

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

function detectOSFromUserAgent(ua) {
  let os = 'Thiết bị di động/PC';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) {
    const match = ua.match(/;\s*([^;]+)\s*Build/);
    os = match ? `Android (${match[1].trim()})` : 'Điện thoại Android';
  } else if (/Macintosh/i.test(ua)) os = 'MacBook / Mac OS';
  else if (/Linux/i.test(ua)) os = 'Linux PC';
  return os;
}

function detectBrowserFromUserAgent(ua) {
  let browser = 'Trình duyệt Web';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  return browser;
}

function runClientDeviceFingerprintTests(assert) {
  console.log('\n💻 [TEST SUITE: CLIENT DEVICE FINGERPRINT & DETECTION]');

  // TC-UI-DEV-01: Thuật toán Băm đơn giản Deterministic 64-bit Hash
  const hash1 = simpleHash('screen:1920x1080x24|cpu:8|touch:0|tz:Asia/Ho_Chi_Minh');
  const hash2 = simpleHash('screen:1920x1080x24|cpu:8|touch:0|tz:Asia/Ho_Chi_Minh');
  assert(hash1.length === 16 && hash1 === hash2,
    'TC-UI-DEV-01: Hash phần cứng ra đúng chuỗi 16 hex nhất quán tuyệt đối giữa các lần gọi');

  // TC-UI-DEV-02: Thay đổi thông số phần cứng -> Tạo mã hash khác biệt
  const hash3 = simpleHash('screen:1440x900x24|cpu:4|touch:0|tz:Asia/Ho_Chi_Minh');
  assert(hash1 !== hash3,
    'TC-UI-DEV-02: Thiết bị khác thông số -> Tạo mã định danh phần cứng khác biệt');

  // TC-UI-DEV-03: Nhận diện hệ điều hành Windows
  const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  assert(detectOSFromUserAgent(winUA) === 'Windows 10/11',
    'TC-UI-DEV-03: Nhận diện chính xác hệ điều hành Windows 10/11');

  // TC-UI-DEV-04: Nhận diện hệ điều hành iOS iPhone
  const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  assert(detectOSFromUserAgent(iosUA) === 'iPhone',
    'TC-UI-DEV-04: Nhận diện chính xác thiết bị iPhone');

  // TC-UI-DEV-05: Nhận diện hệ điều hành Android
  const androidUA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  assert(detectOSFromUserAgent(androidUA).includes('Android'),
    'TC-UI-DEV-05: Nhận diện chính xác hệ điều hành Android');

  // TC-UI-DEV-06: Nhận diện trình duyệt Google Chrome & Edge
  const edgeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  assert(detectBrowserFromUserAgent(winUA) === 'Google Chrome', 'TC-UI-DEV-06.1: Nhận diện Google Chrome');
  assert(detectBrowserFromUserAgent(edgeUA) === 'Microsoft Edge', 'TC-UI-DEV-06.2: Nhận diện Microsoft Edge');
}

module.exports = runClientDeviceFingerprintTests;
