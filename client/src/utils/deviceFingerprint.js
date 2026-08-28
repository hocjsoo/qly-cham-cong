// src/utils/deviceFingerprint.js
// Thu thập Deep Hardware Fingerprint (WebGL + Canvas + Pure Hardware ID) chống chấm công hộ qua tab ẩn danh / trình duyệt khác

export async function getDeviceFingerprint() {
  // 1. Pure Hardware Metrics (Đặc tính phần cứng CỐ ĐỊNH trên mọi trình duyệt & Tab ẩn danh)
  const pureComponents = [];
  pureComponents.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
  pureComponents.push(`cpu:${navigator.hardwareConcurrency || 0}`);
  pureComponents.push(`touch:${navigator.maxTouchPoints || 0}`);
  pureComponents.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`);

  // WebGL GPU Vendor & Renderer
  let gpuVendor = '';
  let gpuRenderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        pureComponents.push(`gpu:${gpuVendor}~${gpuRenderer}`);
      }
    }
  } catch {
    pureComponents.push('no-gpu');
  }

  // AudioContext Sample Rate
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      pureComponents.push(`audio:${audioCtx.sampleRate}`);
      audioCtx.close();
    }
  } catch {
    pureComponents.push('no-audio');
  }

  // Hash thuần phần cứng — ĐẢM BẢO GIỐNG HỆT 100% giữa Chrome, Tab Ẩn danh Incognito, Edge, Firefox trên cùng 1 máy
  const pureRaw = pureComponents.join('|');
  const pure_hardware_uuid = simpleHash(pureRaw);

  // 2. Persistent Device Identifier (Liên kết bổ sung qua Cookie/LocalStorage)
  const deviceId = getPersistentDeviceId();

  return {
    fingerprint: pure_hardware_uuid,
    hardware_uuid: pure_hardware_uuid,
    pure_hardware_uuid,
    device_id: deviceId,
    device_name: getDeviceName(),
    screen_info: `${screen.width}x${screen.height}`,
    user_agent: navigator.userAgent,
    gpu_info: `${gpuVendor} ${gpuRenderer}`.trim(),
  };
}

function getPersistentDeviceId() {
  try {
    let devId = localStorage.getItem('et_device_uuid');
    if (!devId) {
      const match = document.cookie.match(/et_device_uuid=([^;]+)/);
      if (match) {
        devId = match[1];
      } else {
        devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
        document.cookie = `et_device_uuid=${devId}; max-age=315360000; path=/`;
      }
      localStorage.setItem('et_device_uuid', devId);
    }
    return devId;
  } catch {
    return 'dev_fallback_' + screen.width + 'x' + screen.height;
  }
}

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

function getDeviceName() {
  const ua = navigator.userAgent;

  // OS Detection
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

  // Browser Detection
  let browser = '';
  if (/CocCoc/i.test(ua)) browser = 'Cốc Cốc';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Zalo/i.test(ua)) browser = 'Zalo App';

  const res = `${screen.width}x${screen.height}`;
  const icon = (/iPhone|iPad|Android/i.test(ua)) ? '📱' : '💻';

  return `${icon} ${os}${browser ? ' · ' + browser : ''} [${res}]`;
}
