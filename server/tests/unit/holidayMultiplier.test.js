// Production regression tests for configurable holiday work multipliers.

const Holiday = require('../../src/models/Holiday');
const {
  createHoliday,
  updateHoliday,
  normalizeHolidayMultiplier,
} = require('../../src/controllers/holidayController');

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function runHolidayMultiplierTests(assert) {
  console.log('\n🎉 [TEST SUITE: HOLIDAY WORK MULTIPLIERS]');

  const legacyHoliday = new Holiday({ name: 'Ngày lễ cũ', date: '2026-09-02' });
  const validationResults = await Promise.all([1.5, 2, 3].map(async multiplier => {
    const holiday = new Holiday({ name: `Hệ số ${multiplier}`, date: '2026-09-02', work_multiplier: multiplier });
    try {
      await holiday.validate();
      return true;
    } catch {
      return false;
    }
  }));
  const invalidHoliday = new Holiday({ name: 'Sai hệ số', date: '2026-09-02', work_multiplier: 4 });
  let invalidMultiplierRejected = false;
  try {
    await invalidHoliday.validate();
  } catch (error) {
    invalidMultiplierRejected = Boolean(error?.errors?.work_multiplier);
  }

  assert(
    legacyHoliday.work_multiplier === 1.5 && validationResults.every(Boolean) && invalidMultiplierRejected,
    'TC-HOL-MUL-01: Schema production mặc định 1,5x, chỉ chấp nhận 1,5x / 2x / 3x'
  );

  assert(
    normalizeHolidayMultiplier(undefined) === null
      && normalizeHolidayMultiplier(1.5) === 1.5
      && normalizeHolidayMultiplier('2') === 2
      && normalizeHolidayMultiplier(3) === 3
      && normalizeHolidayMultiplier(4) === null,
    'TC-HOL-MUL-02: Helper production chuẩn hóa legacy và từ chối hệ số ngoài whitelist'
  );

  const createRes = createResponse();
  await createHoliday(
    { body: { name: 'Sai', date: '2026-09-02', work_multiplier: 4 }, user: { _id: 'admin-test' } },
    createRes
  );
  assert(
    createRes.statusCode === 400 && /1\.5, 2 hoặc 3/.test(createRes.body?.error || ''),
    'TC-HOL-MUL-03: API tạo ngày lễ fail-fast 400 với hệ số không hợp lệ, không chạm DB'
  );

  const updateRes = createResponse();
  await updateHoliday(
    { params: { id: 'holiday-test' }, body: { work_multiplier: 0 }, user: { _id: 'admin-test' } },
    updateRes
  );
  assert(
    updateRes.statusCode === 400 && /1\.5, 2 hoặc 3/.test(updateRes.body?.error || ''),
    'TC-HOL-MUL-04: API sửa ngày lễ fail-fast 400 với hệ số không hợp lệ, không chạm DB'
  );
}

module.exports = runHolidayMultiplierTests;
