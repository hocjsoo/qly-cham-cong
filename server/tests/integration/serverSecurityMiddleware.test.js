const request = require('supertest');
const app = require('../../src/app');

async function runServerSecurityMiddlewareTests(assert) {
  console.log('\n🧱 [TEST SUITE: SERVER SECURITY MIDDLEWARE]');

  const allowed = await request(app)
    .get('/api/health')
    .set('Origin', 'https://qly-cham-cong.vercel.app');
  assert(
    allowed.status === 200 &&
      allowed.headers['access-control-allow-origin'] === 'https://qly-cham-cong.vercel.app',
    'TC-MW-01: CORS cho phép đúng frontend production đã cấu hình'
  );

  const blocked = await request(app)
    .get('/api/health')
    .set('Origin', 'https://evil.example');
  assert(
    blocked.status === 403 && blocked.body.error.includes('CORS'),
    'TC-MW-02: CORS chặn origin lạ với HTTP 403'
  );

  assert(
    allowed.headers['x-content-type-options'] === 'nosniff' &&
      allowed.headers['x-frame-options'] === 'SAMEORIGIN' &&
      allowed.headers['x-powered-by'] === undefined,
    'TC-MW-03: Helmet bật header bảo mật và ẩn dấu vết Express'
  );
}

module.exports = runServerSecurityMiddlewareTests;
