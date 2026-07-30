// src/utils/deviceFingerprint.js
// Thu thập Deep Hardware Fingerprint (WebGL + Canvas + Audio + Screen) chống chấm công hộ nhiều tài khoản trên 1 thiết bị

export async function getDeviceFingerprint() {
  const components = [];

  // 1. Screen & Hardware Metrics (Độ phân giải thực, số nhân CPU, điểm chạm)
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(String(navigator.hardwareConcurrency || 0));
  components.push(String(navigator.maxTouchPoints || 0));
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown');
  components.push(navigator.language || 'unknown');

  // 2. WebGL Hardware Vendor & Renderer (Chữ ký card màn hình phần cứng)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(`webgl:${vendor}~${renderer}`);
      }
    }
  } catch {
    components.push('no-webgl');
  }

  // 3. Canvas 2D Rendering Digest (Đặc tính font & đồ họa GPU)
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, "Times New Roman"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(30, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ET Office AntiFraud 🏗️', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('ET Office AntiFraud 🏗️', 4, 17);
    components.push(canvas.toDataURL().slice(-80));
  } catch {
    components.push('no-canvas');
  }

  // 4. AudioContext Oscillator Fingerprint (Đặc tính card âm thanh phần cứng)
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const sampleRate = audioCtx.sampleRate;
      components.push(`audio:${sampleRate}`);
      audioCtx.close();
    }
  } catch {
    components.push('no-audio');
  }

  // Hash tất cả thành 1 hardware_uuid duy nhất đại diện cho phần cứng thiết bị
  const raw = components.join('|');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hardware_uuid = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    fingerprint: hardware_uuid,
    hardware_uuid,
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
  if (/Macintosh/i.test(ua)) return 'MacBook / Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Thiết bị di động/PC';
}
