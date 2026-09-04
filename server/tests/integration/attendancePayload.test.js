// Exercise real controllers and Mongoose queries with isolated collection cursors.
// No database connection is opened; assertions inspect the projection sent to MongoDB.
const mongoose = require('mongoose');
const Attendance = require('../../src/models/Attendance');
const User = require('../../src/models/User');
const { getFlaggedAttendance, getPendingOvernightOt, getSelfiePhoto } = require('../../src/controllers/attendanceController');

const evaluate = (expression, row) => {
  if (typeof expression === 'string' && expression.startsWith('$')) return row[expression.slice(1)];
  if (Array.isArray(expression)) return expression.map(value => evaluate(value, row));
  if (!expression || typeof expression !== 'object') return expression;
  if (expression.$ifNull) {
    const [value, fallback] = evaluate(expression.$ifNull, row);
    return value ?? fallback;
  }
  if (expression.$in) {
    const [value, values] = evaluate(expression.$in, row);
    return values.includes(value);
  }
  if (expression.$not) return !evaluate(expression.$not[0], row);
  throw new Error('Unsupported test projection expression');
};

const projectRow = (row, projection) => {
  if (!projection || Object.keys(projection).length === 0) return { ...row };
  const result = { _id: row._id };
  for (const [key, value] of Object.entries(projection)) {
    if (value === 1 && Object.hasOwn(row, key)) result[key] = row[key];
    else if (value && typeof value === 'object') result[key] = evaluate(value, row);
  }
  return result;
};

async function invoke(controller, { role = 'admin', query = {}, params = {} } = {}) {
  const response = {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
  await controller({ user: { _id: '507f1f77bcf86cd799439001', role }, query, params }, response);
  return response;
}

async function runAttendancePayloadTests(assert) {
  console.log('\n📦 [TEST SUITE: ATTENDANCE LIST PAYLOADS — ISOLATED MONGOOSE]');
  const original = {
    modelFindById: Attendance.findById,
    find: Attendance.collection.find,
    findOne: Attendance.collection.findOne,
    countDocuments: Attendance.collection.countDocuments,
    userFind: User.collection.find,
    userDistinct: User.collection.distinct,
    userExists: User.exists,
  };
  const userId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439002');
  const fakePhoto = `data:image/jpeg;base64,${'A'.repeat(256 * 1024)}`;
  const record = {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439003'), user_id: userId,
    date: '2026-09-03', check_in_time: new Date('2026-09-03T02:00:00Z'),
    check_out_time: new Date('2026-09-03T19:00:00Z'), total_hours: 16,
    work_units: 1, is_overnight: true, ot_status: 'pending_approval', ot_hours_proposed: 7.5,
    is_flagged: true, flag_reasons: ['DEVICE_UNTRUSTED'], verification_status: 'pending_review',
    reviewed_by: null, reviewer_note: 'Kiểm tra thiết bị', hardware_uuid: 'test-hardware',
    selfie_url: fakePhoto, notes: 'unrelated historical detail', check_in_lat: 10.5,
  };
  let rows = [record];
  let findCalls = [];
  let allowed = true;
  let existsFilter;
  try {
    // Earlier suites may leave a model-level findById stub installed. Exercise
    // the real Mongoose path here, then restore the incoming state in finally.
    Attendance.findById = mongoose.Model.findById;
    Attendance.collection.find = (filter, options) => {
      findCalls.push({ filter, options });
      const selected = rows.slice(options.skip || 0, (options.skip || 0) + (options.limit || rows.length));
      return { toArray: async () => selected.map(row => projectRow(row, options.projection)) };
    };
    Attendance.collection.findOne = async (filter, options) => projectRow(record, options.projection);
    Attendance.collection.countDocuments = async () => rows.length;
    User.collection.find = () => ({ toArray: async () => [{
      _id: userId, full_name: 'Nhân sự kiểm thử', employee_code: 'TEST-01', avatar_url: null,
    }] });
    User.collection.distinct = async () => [userId];
    User.exists = async filter => { existsFilter = filter; return allowed ? { _id: userId } : null; };

    const legacy = await invoke(getFlaggedAttendance, { query: { status: 'pending', filter: 'device' } });
    const legacyFilter = findCalls[0].filter;
    const compact = await invoke(getFlaggedAttendance, { query: { compact: 'true', status: 'pending', filter: 'device' } });
    const projection = findCalls[1].options.projection;
    assert(legacy.statusCode === 200 && legacy.body.flagged[0].selfie_url === fakePhoto,
      'TC-PAYLOAD-01: Client cũ vẫn nhận ảnh khi không yêu cầu compact');
    assert(compact.statusCode === 200 && !Object.hasOwn(projection, 'selfie_url') &&
      projection.user_id === 1 && projection.has_selfie?.$not?.[0]?.$in?.[0]?.$ifNull?.[0] === '$selfie_url',
    'TC-PAYLOAD-02: Mongoose gửi projection tính has_selfie tại MongoDB, không chọn selfie_url');
    assert(compact.body.flagged[0].has_selfie === true && !Object.hasOwn(compact.body.flagged[0], 'selfie_url') &&
      compact.body.flagged[0].user_id.full_name === 'Nhân sự kiểm thử' &&
      compact.body.flagged[0].reviewer_note === record.reviewer_note &&
      typeof compact.body.flagged[0].toObject === 'undefined',
    'TC-PAYLOAD-03: Lean giữ has_selfie, thông tin người và metadata duyệt mà không có ảnh');
    assert(JSON.stringify(findCalls[1].filter) === JSON.stringify(legacyFilter) &&
      JSON.stringify(compact.body.counts) === JSON.stringify(legacy.body.counts),
    'TC-PAYLOAD-04: Compact không thay đổi bộ lọc hoặc số đếm');

    rows = [undefined, null, '', 'null', 'undefined', fakePhoto].map((selfie_url, index) => ({
      ...record, _id: new mongoose.Types.ObjectId(), date: `2026-09-${10 + index}`, selfie_url,
    }));
    const presence = await invoke(getFlaggedAttendance, { query: { compact: 'true' } });
    assert(JSON.stringify(presence.body.flagged.map(row => row.has_selfie)) === '[false,false,false,false,false,true]',
      'TC-PAYLOAD-05: Thiếu ảnh và sentinel rỗng không bị đánh dấu có ảnh');
    findCalls = [];
    await invoke(getFlaggedAttendance, { query: { compact: 'true', page: '2', limit: '2' } });
    assert(findCalls[0].options.skip === 2 && findCalls[0].options.limit === 2,
      'TC-PAYLOAD-06: Compact vẫn phân trang tại MongoDB');
    findCalls = [];
    const counts = await invoke(getFlaggedAttendance, { query: { compact: 'true', counts_only: 'true' } });
    assert(findCalls.length === 0 && counts.body.flagged.length === 0,
      'TC-PAYLOAD-07: Chỉ tải số đếm không đọc bản ghi hoặc ảnh');
    await invoke(getFlaggedAttendance, { role: 'leader', query: { compact: 'true' } });
    assert(String(findCalls[0].filter.$and[0].user_id.$in[0]) === String(userId),
      'TC-PAYLOAD-08: Compact giữ giới hạn nhân sự của Leader trong truy vấn DB');

    rows = [record];
    findCalls = [];
    const pending = await invoke(getPendingOvernightOt);
    assert(pending.statusCode === 200 && findCalls[0].filter.ot_status === 'pending_approval' &&
      !Object.hasOwn(findCalls[0].options.projection, 'selfie_url') &&
      !Object.hasOwn(findCalls[0].options.projection, 'hardware_uuid') &&
      !Object.hasOwn(pending.body.pending_ot[0], 'selfie_url') &&
      pending.body.pending_ot[0].ot_hours_proposed === 7.5 && pending.body.pending_ot[0].user_code === 'TEST-01',
    'TC-PAYLOAD-09: Danh sách OT chỉ đọc thông tin duyệt, bỏ selfie và dấu vân tay ngay tại DB');
    findCalls = [];
    const denied = await invoke(getPendingOvernightOt, { role: 'leader' });
    assert(denied.statusCode === 403 && findCalls.length === 0,
      'TC-PAYLOAD-10: Leader không đọc được danh sách duyệt OT');

    const adminPhoto = await invoke(getSelfiePhoto, { params: { id: String(record._id) } });
    const leaderPhoto = await invoke(getSelfiePhoto, { role: 'leader', params: { id: String(record._id) } });
    assert(adminPhoto.body.selfie_url === fakePhoto && leaderPhoto.body.selfie_url === fakePhoto &&
      existsFilter.$and[1].role.$ne === 'admin' && String(existsFilter.$and[0]._id) === String(userId),
    'TC-PAYLOAD-11: Admin và Leader đúng phạm vi tải riêng ảnh xác minh');
    allowed = false;
    const forbiddenPhoto = await invoke(getSelfiePhoto, { role: 'leader', params: { id: String(record._id) } });
    assert(forbiddenPhoto.statusCode === 403 && !forbiddenPhoto.body.selfie_url,
      'TC-PAYLOAD-12: Leader ngoài phạm vi bị chặn tải ảnh xác minh');

    const legacyBytes = Buffer.byteLength(JSON.stringify(legacy.body));
    const compactBytes = Buffer.byteLength(JSON.stringify(compact.body));
    assert(compactBytes < legacyBytes / 100, 'TC-PAYLOAD-13: Fixture ảnh 256 KiB giảm hơn 99% payload danh sách');
    console.log(`  Fixture 1 record / 256 KiB selfie: legacy=${legacyBytes} bytes, compact=${compactBytes} bytes; pending OT=${Buffer.byteLength(JSON.stringify(pending.body))} bytes`);
  } finally {
    Attendance.findById = original.modelFindById;
    Attendance.collection.find = original.find;
    Attendance.collection.findOne = original.findOne;
    Attendance.collection.countDocuments = original.countDocuments;
    User.collection.find = original.userFind;
    User.collection.distinct = original.userDistinct;
    User.exists = original.userExists;
  }
}

module.exports = runAttendancePayloadTests;
