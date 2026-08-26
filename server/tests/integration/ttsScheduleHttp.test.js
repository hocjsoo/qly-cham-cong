const request = require('supertest');
const app = require('../../src/app');

async function runTtsScheduleHttpTests(assert) {
  console.log('\n🌐 [TEST SUITE: TTS SCHEDULE HTTP & AUTH BOUNDARY]');
  const readResponse = await request(app).get('/api/tts-schedules?week_start=2026-08-31');
  assert(readResponse.status === 401,
    'TC-TTS-HTTP-01: Chặn xem Lịch TTS khi chưa đăng nhập');
  const writeResponse = await request(app).put('/api/tts-schedules/my-registration').send({ week_start: '2026-08-31' });
  assert(writeResponse.status === 401,
    'TC-TTS-HTTP-02: Chặn đăng ký Lịch TTS khi chưa đăng nhập');
}

module.exports = runTtsScheduleHttpTests;
