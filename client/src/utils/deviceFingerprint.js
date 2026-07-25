// src/utils/deviceFingerprint.js
// Tạo Device Fingerprint chống chấm công hộ
// Thu thập thông tin thiết bị không nhạy cảm → hash SHA-256 → gửi kèm mỗi request check-in

export async function getDeviceFingerprint() {
  const components = [];

  // 1. User Agent
  components.push(navigator.userAgent || 'unknown');

  // 2. Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // 3. Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown');

  // 4. Language
  components.push(navigator.language || 'unknown');

  // 5. Platform
  components.push(navigator.platform || 'unknown');

  // 6. Hardware concurrency (CPU cores)
  components.push(String(navigator.hardwareConcurrency || 0));

  // 7. Touch support
  components.push(String(navigator.maxTouchPoints || 0));

  // 8. Canvas fingerprint (lightweight)
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(30, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ET Office 🏗️', 2, 15);
    components.push(canvas.toDataURL().slice(-50));
  } catch {
    components.push('no-canvas');
  }

  // Hash all components into a fingerprint
  const raw = components.join('|');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    fingerprint,
    device_name: getDeviceName(),
    screen_info: `${screen.width}x${screen.height}`,
    user_agent: navigator.userAgent,
  };
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const match = ua.match(/;\s*([^;]+)\s*Build/);
    return match ? match[1].trim() : 'Android Device';
  }
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}
