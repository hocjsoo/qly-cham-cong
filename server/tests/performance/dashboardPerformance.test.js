// Dashboard query regression tests. Models are stubbed; no database is connected.
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Attendance = require('../../src/models/Attendance');
const Project = require('../../src/models/Project');
const { getTodaySummary } = require('../../src/controllers/dashboardController');
const { buildLeaderUserScope, combineUserFilters } = require('../../src/utils/roleScope');

async function runDashboardPerformanceTests(assert) {
  console.log('\n[TEST SUITE: DASHBOARD QUERY PERFORMANCE]');
  const originals = { userFind: User.find, attendanceFind: Attendance.find, projectFind: Project.find };
  const id = index => new mongoose.Types.ObjectId(index.toString(16).padStart(24, '0'));
  const statuses = ['checked_in', 'checked_out', 'leave', 'holiday', 'absent'];
  const users = Array.from({ length: 50 }, (_, index) => ({
    _id: id(index + 1), full_name: `Employee ${index + 1}`, role: 'employee',
    email: `employee${index + 1}@example.test`,
    department_id: { _id: id(90), name: 'Design' },
    department_ids: [{ _id: id(90), name: 'Design' }, { _id: id(91), name: 'Site' }],
  }));
  const rawAttendance = users.map((user, index) => ({
    _id: id(index + 100), user_id: user._id, date: '2026-09-04', check_in_type: 'office',
    check_in_time: index % 5 < 2 ? new Date('2026-09-04T01:00:00Z') : null,
    check_out_time: index % 5 === 1 ? new Date('2026-09-04T10:00:00Z') : null,
    status: index % 5 < 2 ? 'present' : statuses[index % 5],
    work_units: index % 5 < 2 ? 1 : 0, total_hours: index % 5 === 1 ? 8 : 0,
    selfie_url: `data:image/jpeg;base64,${'a'.repeat(128 * 1024)}`,
    device_fingerprint: 'hardware-fingerprint', check_in_note: 'Not used by dashboard',
  }));
  let events = [];
  let attendanceFilter;
  let userFilter;
  let projects = [{ _id: id(200), name: 'Assigned project' }];
  let projectFilters = [];
  let returnedAttendanceBytes = 0;
  let projectFailure = false;

  function query(data, label) {
    let projection;
    let lean = false;
    const chain = {
      select(fields) { projection = fields; return chain; },
      populate() { return chain; },
      sort() { return chain; },
      limit() { return chain; },
      lean() { lean = true; return chain; },
      then(resolve, reject) {
        events.push(`${label}:start`);
        return new Promise((done, fail) => setTimeout(() => {
          events.push(`${label}:end`);
          if (label === 'project' && projectFailure) return fail(new Error('Fixture query failure'));
          if (label !== 'attendance') return done(data);
          const selected = data.map(row => projection
            ? Object.fromEntries(['_id', ...projection.split(/\s+/)].filter(field => field in row).map(field => [field, row[field]]))
            : row);
          returnedAttendanceBytes = Buffer.byteLength(JSON.stringify(selected));
          done(lean ? selected : selected.map(row => Attendance.hydrate(row)));
        }, 10)).then(resolve, reject);
      },
    };
    return chain;
  }

  async function call(actor) {
    let response;
    let status = 200;
    await getTodaySummary({ user: actor }, {
      status(code) { status = code; return this; },
      json(body) { response = body; },
    });
    return { response, status };
  }

  try {
    User.find = filter => { userFilter = filter; return query(users, 'user'); };
    Attendance.find = filter => { attendanceFilter = filter; return query(rawAttendance, 'attendance'); };
    Project.find = filter => {
      projectFilters.push(filter);
      return query(projects, 'project');
    };
    const admin = { _id: id(500), role: 'admin', full_name: 'Admin' };
    const { response, status } = await call(admin);
    assert(status === 200 && response.staff.length === 50 && response.summary.total === 50
      && response.summary.checked_in === 10 && response.summary.checked_out === 10
      && response.summary.leave === 10 && response.summary.holiday === 10
      && response.summary.absent === 10 && response.summary.present_total === 20,
    'TC-DASH-PERF-01: Summary preserves all attendance statuses for 50 employees');
    assert(response.staff[0].department_name === 'Design, Site'
      && response.staff[0].check_in_type === 'office' && response.staff[1].total_hours === 8
      && response.staff[1].work_units === 1 && response.my_projects[0].name === 'Assigned project',
    'TC-DASH-PERF-02: Projection preserves staff details and assigned projects');
    const sourceBytes = Buffer.byteLength(JSON.stringify(rawAttendance));
    assert(returnedAttendanceBytes < sourceBytes / 100,
      'TC-DASH-PERF-03: Selfie-heavy fixture transfers less than 1% of full attendance payload',
      `${sourceBytes} -> ${returnedAttendanceBytes} bytes (fixture, not production)`);
    assert(events.indexOf('project:start') < events.indexOf('attendance:end')
      && events.indexOf('attendance:start') < events.indexOf('project:end'),
    'TC-DASH-PERF-04: Independent attendance and project queries overlap');
    assert(attendanceFilter.user_id.$in.length === 50
      && attendanceFilter.date === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
    'TC-DASH-PERF-05: Attendance remains limited to selected users and Vietnam current date');

    // Legacy documents missing fields must keep Mongoose defaults after projection.
    const oldWorkUnits = rawAttendance[0].work_units;
    const oldStatus = rawAttendance[0].status;
    delete rawAttendance[0].work_units;
    delete rawAttendance[0].status;
    const legacy = await call(admin);
    assert(legacy.response.staff[0].work_units === 1 && legacy.response.staff[0].status === 'present',
      'TC-DASH-PERF-06: Legacy attendance retains hydrated work-unit and status defaults');
    rawAttendance[0].work_units = oldWorkUnits;
    rawAttendance[0].status = oldStatus;

    for (const role of ['leader', 'manager']) {
      const actor = { _id: id(501), role, full_name: 'Leader (Site)', department_ids: [id(90), id(91)] };
      projects = [];
      projectFilters = [];
      await call(actor);
      const activeFilter = {
        is_active: { $ne: false }, is_attendance_exempt: { $ne: true },
        employment_status: { $nin: ['Đã nghỉ việc', 'Da nghi viec', 'Nghỉ ốm', 'Nghỉ thai sản', 'Khác'] },
      };
      assert(JSON.stringify(userFilter) === JSON.stringify(combineUserFilters(activeFilter, buildLeaderUserScope(actor, { includeSelf: true })))
        && projectFilters.length === 1 && projectFilters[0].$or[0].members === actor._id
        && projectFilters[0].$or[2].pm_name.test(actor.full_name),
      `TC-DASH-PERF-07-${role}: Role scope and own-project filter remain intact, without admin fallback`);
    }
    projectFilters = [];
    const empty = await call(admin);
    assert(empty.status === 200 && empty.response.my_projects.length === 0 && projectFilters.length === 2
      && projectFilters[1].status.$nin.includes('cancelled'),
    'TC-DASH-PERF-08: Empty admin projects retain existing active-project fallback');

    projectFailure = true;
    const originalError = console.error;
    let failed;
    try {
      console.error = () => {};
      failed = await call(admin);
    } finally {
      console.error = originalError;
    }
    assert(failed.status === 500 && failed.response.error === 'Lỗi lấy dữ liệu dashboard.',
      'TC-DASH-PERF-09: Parallel query rejection keeps existing error response');
  } finally {
    User.find = originals.userFind;
    Attendance.find = originals.attendanceFind;
    Project.find = originals.projectFind;
  }
}

module.exports = runDashboardPerformanceTests;
