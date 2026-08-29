const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'assets', 'screenshots');
const APP_URL = 'http://127.0.0.1:5179';
const DEBUG_PORT = 9231;
const DEMO_USER = {
  _id: 'user-admin',
  id: 'user-admin',
  employee_code: 'ET001',
  full_name: 'Nguyễn Danh Học',
  email: 'admin@etoffice.vn',
  phone: '0901 234 567',
  role: 'admin',
  position: 'Phó Giám đốc',
  employee_type: 'NS',
  department_name: 'Ban Giám Đốc',
  is_active: true,
  bank_name: 'Vietcombank',
  bank_account: '0011001234567',
  bank_holder: 'NGUYEN DANH HOC',
  license_plate: '29E1-888.88',
  vehicle_type: 'Honda SH',
  vehicle_color: 'Xám',
  parking_location: 'Tòa 17T10 Nguyễn Thị Định',
};

function findBrowser() {
  const candidates = [
    process.env.DOCS_BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const browser = candidates.find((candidate) => fs.existsSync(candidate));
  if (!browser) throw new Error('Không tìm thấy Chrome/Edge. Đặt biến DOCS_BROWSER_PATH rồi chạy lại.');
  return browser;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) return resolve();
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1500, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) return reject(new Error(`Timeout khi chờ ${url}`));
      setTimeout(probe, 250);
    };
    probe();
  });
}

function openWebSocket(url) {
  const parsed = new URL(url);
  const key = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');

  return new Promise((resolve, reject) => {
    const request = http.request({
      host: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
      },
    });

    request.on('upgrade', (_response, socket) => {
      let nextId = 1;
      let buffer = Buffer.alloc(0);
      const pending = new Map();

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 2) {
          let payloadLength = buffer[1] & 0x7f;
          let offset = 2;
          if (payloadLength === 126) {
            if (buffer.length < 4) break;
            payloadLength = buffer.readUInt16BE(2);
            offset = 4;
          } else if (payloadLength === 127) {
            if (buffer.length < 10) break;
            payloadLength = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }
          if (buffer.length < offset + payloadLength) break;
          const payload = buffer.subarray(offset, offset + payloadLength);
          buffer = buffer.subarray(offset + payloadLength);
          try {
            const message = JSON.parse(payload.toString('utf8'));
            if (message.id && pending.has(message.id)) {
              const handler = pending.get(message.id);
              pending.delete(message.id);
              if (message.error) handler.reject(new Error(message.error.message));
              else handler.resolve(message.result || {});
            }
          } catch {
            // Ignore DevTools events that are not command responses.
          }
        }
      });

      const send = (method, params = {}) => {
        const id = nextId++;
        const payload = Buffer.from(JSON.stringify({ id, method, params }));
        const mask = Buffer.from([0, 0, 0, 0]);
        let header;
        if (payload.length < 126) {
          header = Buffer.from([0x81, 0x80 | payload.length, ...mask]);
        } else {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(payload.length, 2);
        }
        socket.write(Buffer.concat([header, payload]));
        return new Promise((resolveCommand, rejectCommand) => {
          pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
        });
      };

      resolve({ send, close: () => socket.end() });
    });
    request.on('error', reject);
    request.end();
  });
}

async function getPageTarget() {
  const data = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });
  return data.find((target) => target.type === 'page' && target.url.includes('5179'));
}

async function waitForPage(client, expectedText, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body?.innerText || '';
        const loading = document.querySelector('.skeleton-card, .tts-loading-skeleton, [aria-label="Đang tải lịch tuần"]');
        return document.readyState === 'complete' && !loading && text.includes(${JSON.stringify(expectedText)});
      })()`,
      returnByValue: true,
    });
    if (result.result?.value) return;
    await wait(250);
  }
  throw new Error(`Trang chưa render hoàn chỉnh: ${expectedText}`);
}

async function capture(client, route, fileName, expectedText, setupExpression = '') {
  await client.send('Page.navigate', { url: `${APP_URL}${route}` });
  await waitForPage(client, expectedText);
  if (setupExpression) {
    await client.send('Runtime.evaluate', { expression: setupExpression });
    await wait(350);
  }
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      let style = document.getElementById('docs-capture-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'docs-capture-style';
        style.textContent = '*{animation:none!important;transition:none!important;caret-color:transparent!important}';
        document.head.appendChild(style);
      }
      window.scrollTo(0, 0);
    })()`,
  });
  await wait(250);
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), Buffer.from(data, 'base64'));
  console.log(`Captured ${fileName}`);
}

async function createShowcase(client) {
  const images = ['dashboard.png', '00-mobile-checkin.png', '04-projects.png', '06-timesheet-matrix.png'];
  const sources = images.map((fileName) => {
    const base64 = fs.readFileSync(path.join(OUTPUT_DIR, fileName)).toString('base64');
    return `data:image/png;base64,${base64}`;
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:1600px;height:900px;overflow:hidden;background:#070a0f;color:#fff;font-family:Inter,Segoe UI,sans-serif}
    body:before{content:"";position:absolute;inset:-20%;background:radial-gradient(circle at 15% 15%,#2563eb55,transparent 36%),radial-gradient(circle at 82% 20%,#8b5cf633,transparent 30%),radial-gradient(circle at 50% 100%,#10b98122,transparent 36%)}
    .wrap{position:relative;height:100%;padding:56px 64px}.eyebrow{font-size:17px;color:#60a5fa;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.title{font-size:50px;line-height:1.05;font-weight:900;margin:10px 0 10px}.sub{font-size:20px;color:#aeb9c9;max-width:950px}.grid{position:absolute;left:64px;right:64px;top:230px;bottom:48px;display:grid;grid-template-columns:1.2fr .48fr 1fr;grid-template-rows:1fr 1fr;gap:18px}.panel{position:relative;border:1px solid #ffffff22;border-radius:22px;overflow:hidden;background:#11161d;box-shadow:0 20px 70px #0009}.panel img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}.panel:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 1px #ffffff0c;pointer-events:none}.dashboard{grid-row:1/3}.mobile{grid-row:1/3}.mobile img{object-fit:contain;background:linear-gradient(180deg,#10151c,#080b10);padding:14px}.badge{position:absolute;right:64px;top:62px;padding:11px 16px;border:1px solid #ffffff22;border-radius:999px;background:#ffffff0d;color:#dbeafe;font-weight:800;font-size:14px;backdrop-filter:blur(14px)}
  </style></head><body><div class="wrap"><div class="eyebrow">Workforce Operations Platform</div><div class="title">ET Office Portal</div><div class="sub">GPS attendance · Hardware anti-fraud · Approval workflows · Timesheet analytics</div><div class="badge">321/321 Tests Passed · Zero-Impact</div><div class="grid"><div class="panel dashboard"><img src="${sources[0]}"></div><div class="panel mobile"><img src="${sources[1]}"></div><div class="panel"><img src="${sources[2]}"></div><div class="panel"><img src="${sources[3]}"></div></div></div></body></html>`;
  const tempHtml = path.join(os.tmpdir(), `et-office-showcase-${Date.now()}.html`);
  fs.writeFileSync(tempHtml, html, 'utf8');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: `file:///${tempHtml.replace(/\\/g, '/')}` });
  await waitForPage(client, 'ET Office Portal');
  await wait(500);
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'repo-showcase.png'), Buffer.from(data, 'base64'));
  fs.unlinkSync(tempHtml);
  console.log('Captured repo-showcase.png');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-office-docs-'));
  const processes = [];
  let client;

  try {
    const mockApi = spawn(process.execPath, [path.join(__dirname, 'mock-api.cjs')], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    processes.push(mockApi);
    await waitForHttp('http://127.0.0.1:5000/api/health');

    const viteCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const viteArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run dev -- --port 5179 --host 127.0.0.1']
      : ['run', 'dev', '--', '--port', '5179', '--host', '127.0.0.1'];
    const vite = spawn(viteCommand, viteArgs, {
      cwd: CLIENT_DIR,
      env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:5000/api' },
      stdio: 'ignore',
      windowsHide: true,
    });
    processes.push(vite);
    await waitForHttp(`${APP_URL}/login`);

    const browser = spawn(findBrowser(), [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
      `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, `${APP_URL}/login`,
    ], { stdio: 'ignore' });
    processes.push(browser);
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json`);

    const target = await getPageTarget();
    if (!target) throw new Error('Không tìm thấy page target của trình duyệt.');
    client = await openWebSocket(target.webSocketDebuggerUrl);
    await client.send('Browser.grantPermissions', { permissions: ['geolocation'], origin: APP_URL });
    await client.send('Emulation.setGeolocationOverride', { latitude: 21.0067, longitude: 105.8028, accuracy: 8 });
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

    await client.send('Runtime.evaluate', { expression: 'localStorage.clear(); sessionStorage.clear();' });
    await capture(client, '/login', 'login.png', 'Đăng nhập');

    await client.send('Runtime.evaluate', {
      expression: `localStorage.setItem('token','docs-demo-token');localStorage.setItem('user',${JSON.stringify(JSON.stringify(DEMO_USER))});localStorage.setItem('theme','dark');`,
    });

    await capture(client, '/dashboard', 'dashboard.png', 'Dashboard');
    await capture(client, '/checkin', '01-checkin.png', 'Đang làm việc từ');
    await capture(client, '/requests?tab=pending', '02-requests.png', 'Lê Hoàng Nam');
    await capture(client, '/tts-schedule', '03-tts-schedule.png', 'Phạm Khánh Linh');
    await capture(client, '/projects', '04-projects.png', 'Penthouse Ecopark Grand');
    await capture(client, '/expenses', '05-expenses.png', 'Mua mẫu sơn');
    await capture(client, '/reports', '06-timesheet-matrix.png', 'Nguyễn Danh Học');
    await capture(client, '/history', '07-history.png', 'Lịch sử chấm công');
    await capture(client, '/leaderboard', '08-leaderboard.png', 'Trần Minh Anh');
    await capture(client, '/vehicles', '09-vehicles.png', '29E1-888.88');
    await capture(client, '/profile', '10-profile.png', 'Thông tin hồ sơ');
    await capture(client, '/staff', '11-staff.png', 'Nguyễn Danh Học');

    await client.send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 2, mobile: true });
    await capture(client, '/checkin', '00-mobile-checkin.png', 'Đang làm việc từ');
    await createShowcase(client);
  } finally {
    client?.close();
    for (const processItem of processes.reverse()) processItem.kill();
    await wait(500);
    const safeTempRoot = path.resolve(os.tmpdir());
    const resolvedProfile = path.resolve(profileDir);
    if (resolvedProfile.startsWith(safeTempRoot + path.sep)) {
      try {
        fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      } catch {
        // The browser may keep profile files locked briefly on Windows; OS temp cleanup handles them later.
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

