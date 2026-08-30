const { getSettings } = require('../../src/controllers/systemSettingController');
const SystemSetting = require('../../src/models/SystemSetting');

function validateSystemSettings(settings) {
  const errors = [];

  const { work_start_time, work_end_time, lunch_break_start, lunch_break_end, minor_late_mins, medium_late_mins } = settings;

  if (work_start_time && work_end_time) {
    if (work_start_time >= work_end_time) {
      errors.push('Giờ bắt đầu ca làm việc phải trước giờ kết thúc ca.');
    }
  }

  if (lunch_break_start && lunch_break_end) {
    if (lunch_break_start >= lunch_break_end) {
      errors.push('Giờ bắt đầu nghỉ trưa phải trước giờ kết thúc nghỉ trưa.');
    }
  }

  if (minor_late_mins !== undefined && medium_late_mins !== undefined) {
    if (Number(minor_late_mins) <= 0 || Number(medium_late_mins) <= Number(minor_late_mins)) {
      errors.push('Ngưỡng muộn vừa phải lớn hơn ngưỡng muộn nhẹ và lớn hơn 0.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

async function runSystemSettingsTests(assert) {
  console.log('\n⚙️ [TEST SUITE: SYSTEM SETTINGS VALIDATION & CONTROLLER ZERO-MUTATION]');

  // TC-SET-01: Cấu hình ca làm việc chuẩn hợp lệ
  const validConfig = {
    work_start_time: '08:30',
    work_end_time: '17:30',
    lunch_break_start: '12:00',
    lunch_break_end: '13:00',
    minor_late_mins: 10,
    medium_late_mins: 30,
  };
  const res1 = validateSystemSettings(validConfig);
  assert(res1.isValid === true && res1.errors.length === 0,
    'TC-SET-01: Cấu hình ca làm việc & ngưỡng đi muộn chuẩn hợp lệ');

  // TC-SET-02: Bắt lỗi khi giờ bắt đầu ca muộn hơn giờ kết thúc
  const invalidShift = { ...validConfig, work_start_time: '18:00', work_end_time: '17:30' };
  const res2 = validateSystemSettings(invalidShift);
  assert(res2.isValid === false && res2.errors[0].includes('trước giờ kết thúc'),
    'TC-SET-02: Bắt lỗi khi giờ bắt đầu ca làm việc >= giờ kết thúc ca');

  // TC-SET-03: Bắt lỗi khi ngưỡng muộn nhẹ lớn hơn hoặc bằng ngưỡng muộn vừa
  const invalidThreshold = { ...validConfig, minor_late_mins: 40, medium_late_mins: 30 };
  const res3 = validateSystemSettings(invalidThreshold);
  assert(res3.isValid === false && res3.errors[0].includes('Ngưỡng muộn vừa phải lớn hơn'),
    'TC-SET-03: Bắt lỗi khi ngưỡng muộn nhẹ (40p) >= ngưỡng muộn vừa (30p)');

  // TC-SET-04: Kiểm thử trực tiếp Controller getSettings: Chuẩn hóa in-memory và cam kết KHÔNG ghi DB (Zero Mutation)
  const originalFindOne = SystemSetting.findOne;
  const originalUpdateOne = SystemSetting.updateOne;
  const originalSave = SystemSetting.prototype.save;

  let updateOneCallCount = 0;
  let saveCallCount = 0;

  SystemSetting.updateOne = async () => {
    updateOneCallCount++;
    return { acknowledged: true };
  };

  SystemSetting.prototype.save = async function() {
    saveCallCount++;
    return this;
  };

  const mockDbSetting = {
    key: 'global',
    work_start_time: '09:00',
    work_end_time: '18:30',
    request_guidelines: {
      late: { desc: 'Sử dụng khi nhân sự đến sau giờ làm việc quy định (08:30)' },
      early_leave: { desc: 'Sử dụng khi nhân sự rời công ty trước giờ kết thúc làm việc (17:30)' },
      custom_type: { desc: 'Quy định riêng của công ty liên quan mốc 08:30 không được sửa' },
    },
    toObject() {
      return {
        key: this.key,
        work_start_time: this.work_start_time,
        work_end_time: this.work_end_time,
        request_guidelines: { ...this.request_guidelines },
      };
    }
  };

  SystemSetting.findOne = async (query) => {
    if (query?.key === 'global') return mockDbSetting;
    return null;
  };

  let responseData = null;
  const mockReq = {};
  const mockRes = {
    json(data) {
      responseData = data;
      return this;
    },
    status() {
      return this;
    }
  };

  try {
    await getSettings(mockReq, mockRes);

    assert(responseData !== null, 'TC-SET-04a: getSettings controller phải trả về dữ liệu JSON');
    assert(responseData.request_guidelines.late.desc.includes('09:00'), 'TC-SET-04b: getSettings chuẩn hóa giờ đi muộn sang 09:00');
    assert(responseData.request_guidelines.early_leave.desc.includes('18:30'), 'TC-SET-04c: getSettings chuẩn hóa giờ về sớm sang 18:30');
    assert(responseData.request_guidelines.custom_type.desc.includes('08:30'), 'TC-SET-04d: getSettings bảo toàn nguyên vẹn hướng dẫn tùy biến của Admin');
    assert(updateOneCallCount === 0, 'TC-SET-04e: getSettings cam kết 100% read-only, updateOne KHÔNG được gọi');
    assert(saveCallCount === 0, 'TC-SET-04f: getSettings cam kết 100% read-only, save KHÔNG được gọi');
  } finally {
    SystemSetting.findOne = originalFindOne;
    SystemSetting.updateOne = originalUpdateOne;
    SystemSetting.prototype.save = originalSave;
  }
}

module.exports = runSystemSettingsTests;
