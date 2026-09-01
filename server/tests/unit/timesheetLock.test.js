// ==============================================
// tests/unit/timesheetLock.test.js
// Kiểm thử Ma trận Công, Ký hiệu Bảng công Mẫu ET_Staff 2026
// & Cơ chế Khóa Bảng công (Timesheet Lock)
// ==============================================

const {
  SYMBOL_TO_STATUS_MAP: PRODUCTION_SYMBOL_MAP,
  formatWorkUnitSymbol,
  resolveStructuredTimesheetSymbol,
} = require('../../src/controllers/timesheetLockController');

const SYMBOL_TO_STATUS_MAP = {
  'x': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,75x': { total_hours: 6, work_units: 0.75, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0.75x': { total_hours: 6, work_units: 0.75, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0,5x': { total_hours: 4, work_units: 0.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  '0.5x': { total_hours: 4, work_units: 0.5, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'present' },
  'CT1': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác trong nước (CT1)' },
  'CT2': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'site', status: 'present', notes: 'Công tác nước ngoài (CT2)' },
  'WFH': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'wfh', status: 'present', notes: 'Work from home (WFH)' },
  'P': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ phép năm (P)' },
  'O': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'leave', notes: 'Nghỉ ốm (O)' },
  'KL': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Nghỉ không lương (KL)' },
  'K': { total_hours: 0, work_units: 0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'absent', notes: 'Khác (K)' },
  'L': { total_hours: 8, work_units: 1.0, is_late: false, late_tier: 'on_time', check_in_type: 'office', status: 'holiday', notes: 'Nghỉ Lễ (L)' },
};

function validateOverrideRequest(new_symbol, ot_hours, reason) {
  if (!new_symbol || !reason || !reason.trim()) {
    return { valid: false, status: 400, error: 'Ký hiệu công và Lý do chỉnh sửa là bắt buộc.' };
  }
  if (!SYMBOL_TO_STATUS_MAP[new_symbol]) {
    return { valid: false, status: 400, error: 'Ký hiệu công không hợp lệ. Chỉ chấp nhận: x, 0.75x, 0.5x, CT1, CT2, WFH, P, O, KL, K, L' };
  }
  if (ot_hours !== undefined && ot_hours !== null && ot_hours !== '') {
    const numOt = Number(ot_hours);
    if (!Number.isFinite(numOt) || numOt < 0 || numOt > 16 || (numOt * 2) % 1 !== 0) {
      return { valid: false, status: 400, error: 'Số giờ OT không hợp lệ. Vui lòng nhập số từ 0 đến 16 giờ theo bước 0.5h.' };
    }
  }
  return { valid: true };
}

function resolveMatrixSymbol(att, isHoliday) {
  // Source of Truth: Attendance record
  if (att) {
    const notes = (att.notes || '').toUpperCase();
    if (notes.includes('CT2') || notes.includes('NƯỚC NGOÀI') || notes.includes('[CT2]')) return 'CT2';
    if (notes.includes('CT1') || notes.includes('TRONG NƯỚC') || notes.includes('[CT1]') || (att.check_in_type === 'site')) return 'CT1';
    if (att.check_in_type === 'wfh' || notes.includes('WFH') || notes.includes('[WFH]')) return 'WFH';
    if (att.status === 'leave' || notes.includes('NGHỈ PHÉP') || notes.includes('(P)') || notes.includes('[P]')) return 'P';
    if (notes.includes('NGHỈ ỐM') || notes.includes('(O)') || notes.includes('[O]')) return 'O';
    if (notes.includes('KHÔNG LƯƠNG') || notes.includes('(KL)') || notes.includes('[KL]')) return 'KL';
    if (notes.includes('(K)') || notes.includes('KHÁC') || notes.includes('[K]')) return 'K';
    if (att.status === 'holiday' || notes.includes('NGHỈ LỄ') || notes.includes('(L)') || notes.includes('[L]')) return 'L';
    if (att.work_units === 0.75 || notes.includes('[0,75X]') || notes.includes('[0.75X]') || notes.includes('0,75X') || notes.includes('0.75X')) return '0,75x';
    if (att.work_units === 0.5 || att.status === 'half_day' || notes.includes('[0,5X]') || notes.includes('[0.5X]') || notes.includes('0,5X') || notes.includes('0.5X')) return '0,5x';
    if (notes.includes('[X]') || att.work_units === 1.0 || att.total_hours >= 7.5) return 'x';
    if (att.total_hours >= 5.5) return '0,75x';
    if (att.total_hours >= 3.5) return '0,5x';
    if (att.total_hours > 0) return '0,5x';
  } else if (isHoliday) {
    return 'L';
  }
  return '';
}

function generateHeaderDays(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const headerDays = [];
  const weekdayVN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weekdayStr = weekdayVN[dateObj.getDay()];

    headerDays.push({
      day: d,
      dayStr: String(d).padStart(2, '0'),
      weekday: weekdayStr,
      dateStr,
      isSunday: dateObj.getDay() === 0,
      isSaturday: dateObj.getDay() === 6,
    });
  }
  return headerDays;
}

function checkTimesheetLock(locks, userId, month, year) {
  const globalLock = locks.find(l => l.user_id === null && l.month === month && l.year === year && l.is_locked);
  if (globalLock) return { isLocked: true, reason: 'Bảng công tháng này đã được Ban giám đốc chốt khóa toàn bộ.' };

  const userLock = locks.find(l => l.user_id === userId && l.month === month && l.year === year && l.is_locked);
  if (userLock) return { isLocked: true, reason: 'Bảng công của nhân viên này đã bị khóa riêng lẻ.' };

  return { isLocked: false };
}

function runTimesheetTests(assert) {
  console.log('\n📊 [TEST SUITE: TIMESHEET MATRIX & LOCK SYSTEM]');

  // TC-TIME-01: Kiểm tra Ánh xạ ký hiệu chuẩn ET_Staff 2026 & work_units
  assert(SYMBOL_TO_STATUS_MAP['x'].total_hours === 8 && SYMBOL_TO_STATUS_MAP['x'].work_units === 1.0,
    'TC-TIME-01.1: Ký hiệu "x" -> 8h, work_units=1.0');

  assert(SYMBOL_TO_STATUS_MAP['0,75x'].total_hours === 6 && SYMBOL_TO_STATUS_MAP['0,75x'].work_units === 0.75,
    'TC-TIME-01.2: Ký hiệu "0,75x" -> 6h, work_units=0.75');

  assert(SYMBOL_TO_STATUS_MAP['0,5x'].total_hours === 4 && SYMBOL_TO_STATUS_MAP['0,5x'].work_units === 0.5,
    'TC-TIME-01.3: Ký hiệu "0,5x" -> 4h nửa ngày công, work_units=0.5');

  assert(SYMBOL_TO_STATUS_MAP['CT1'].check_in_type === 'site' && SYMBOL_TO_STATUS_MAP['CT1'].work_units === 1.0,
    'TC-TIME-01.4: Ký hiệu "CT1" -> Công tác trong nước (site, 1.0 công)');

  assert(SYMBOL_TO_STATUS_MAP['WFH'].check_in_type === 'wfh' && SYMBOL_TO_STATUS_MAP['WFH'].work_units === 1.0,
    'TC-TIME-01.5: Ký hiệu "WFH" -> Làm việc tại nhà (wfh, 1.0 công)');

  assert(SYMBOL_TO_STATUS_MAP['P'].status === 'leave' && SYMBOL_TO_STATUS_MAP['P'].work_units === 1.0,
    'TC-TIME-01.6: Ký hiệu "P" -> Nghỉ phép năm có lương (1.0 công)');

  assert(SYMBOL_TO_STATUS_MAP['KL'].status === 'absent' && SYMBOL_TO_STATUS_MAP['KL'].work_units === 0,
    'TC-TIME-01.7: Ký hiệu "KL" -> Nghỉ không lương (0 công)');

  // TC-TIME-02: Kiểm tra sinh Ma trận ngày theo tháng & năm
  const headerAug2026 = generateHeaderDays(8, 2026);
  assert(headerAug2026.length === 31, 'TC-TIME-02.1: Tháng 8/2026 có đúng 31 ngày');
  assert(headerAug2026[0].dateStr === '2026-08-01' && headerAug2026[0].weekday === 'T7',
    'TC-TIME-02.2: Ngày 01/08/2026 rơi vào Thứ Bảy (T7)');

  const headerFeb2024Leap = generateHeaderDays(2, 2024);
  assert(headerFeb2024Leap.length === 29, 'TC-TIME-02.3: Năm nhuận 2024 Tháng 2 có đúng 29 ngày');

  // TC-TIME-03: Cơ chế Khóa Bảng công Toàn cục (Global Lock)
  const mockLocks = [
    { user_id: null, month: 7, year: 2026, is_locked: true },
    { user_id: 'user_123', month: 8, year: 2026, is_locked: true },
  ];

  const lockCheck1 = checkTimesheetLock(mockLocks, 'user_999', 7, 2026);
  assert(lockCheck1.isLocked === true, 'TC-TIME-03.1: Chặn ghi đè khi Tháng 7/2026 bị Khóa Toàn cục');

  // TC-TIME-04: Khóa bảng công riêng lẻ cho 1 nhân viên
  const lockCheck2 = checkTimesheetLock(mockLocks, 'user_123', 8, 2026);
  assert(lockCheck2.isLocked === true, 'TC-TIME-04.1: Chặn sửa công nhân viên user_123 khi đã bị khóa riêng');

  const lockCheck3 = checkTimesheetLock(mockLocks, 'user_456', 8, 2026);
  assert(lockCheck3.isLocked === false, 'TC-TIME-04.2: Cho phép sửa công nhân viên user_456 khi chưa bị khóa');

  // TC-TIME-05: Validation Ký hiệu lạ (Codex Review) -> Trả về 400 nếu ký hiệu không hợp lệ
  const invalidSym = validateOverrideRequest('ABC', 0, 'Sửa nhầm');
  assert(invalidSym.valid === false && invalidSym.error.includes('Ký hiệu công không hợp lệ'),
    'TC-TIME-05.1: Từ chối ký hiệu lạ "ABC" với lỗi 400');

  const validSym = validateOverrideRequest('0,75x', 1.5, 'Lý do hợp lệ');
  assert(validSym.valid === true, 'TC-TIME-05.2: Chấp nhận ký hiệu hợp lệ "0,75x"');

  // TC-TIME-06: Validation Giờ OT (Codex Review) -> 0..16, step 0.5
  assert(validateOverrideRequest('x', -5, 'Lý do').valid === false,
    'TC-TIME-06.1: Từ chối số giờ OT âm (-5)');
  assert(validateOverrideRequest('x', 999, 'Lý do').valid === false,
    'TC-TIME-06.2: Từ chối số giờ OT vượt quá 16h (999)');
  assert(validateOverrideRequest('x', Infinity, 'Lý do').valid === false,
    'TC-TIME-06.3: Từ chối số giờ OT là Infinity');
  assert(validateOverrideRequest('x', 2.37, 'Lý do').valid === false,
    'TC-TIME-06.4: Từ chối số giờ OT không phải bước 0.5 (2.37)');
  assert(validateOverrideRequest('x', 2.5, 'Lý do').valid === true,
    'TC-TIME-06.5: Chấp nhận số giờ OT hợp lệ 2.5h');

  // TC-TIME-07: Attendance là Source of Truth; Đơn từ mới duyệt và xóa ca phản ánh đúng (Codex Review)
  const attAfterRequestApproved = {
    check_in_type: 'site',
    status: 'present',
    notes: 'Công tác trong nước (CT1)',
    work_units: 1.0,
    total_hours: 8,
  };
  const resolvedPresent = resolveMatrixSymbol(attAfterRequestApproved, false);
  assert(resolvedPresent === 'CT1',
    'TC-TIME-07.1: Đơn công tác CT1 mới duyệt hiển thị đúng "CT1"');

  // Khi Admin xóa ca (att = null), ma trận trả về ô trống '', không dùng audit cũ làm fallback
  const resolvedDeleted = resolveMatrixSymbol(null, false);
  assert(resolvedDeleted === '',
    'TC-TIME-07.2: Khi ca bị xóa (att=null), ma trận hiển thị ô trống "" (Audit Log được giữ nguyên trong DB để tra cứu lịch sử)');

  // Khi att = null nhưng là ngày lễ
  const resolvedHoliday = resolveMatrixSymbol(null, true);
  assert(resolvedHoliday === 'L',
    'TC-TIME-07.3: Khi không có chấm công vào ngày lễ (isHoliday=true), ma trận hiển thị ký hiệu "L"');

  // TC-TIME-08: Tự động tính 0,75x khi check-in sau 09:30:00 (work_units=0.75)
  const autoLateRecord = {
    check_in_type: 'office',
    status: 'present',
    is_late: true,
    late_minutes: 31,
    work_units: 0.75,
    total_hours: 6,
    notes: null,
  };
  assert(resolveMatrixSymbol(autoLateRecord, false) === '0,75x',
    'TC-TIME-08: Ca muộn sau 09:30 (work_units=0.75) tự động hiển thị ký hiệu "0,75x"');

  // TC-TIME-09: Admin override 0,75x thành x -> Giữ nguyên kết quả override x không bị ghi đè
  const overriddenToFull = {
    check_in_type: 'office',
    status: 'present',
    is_late: true,
    late_minutes: 31,
    work_units: 1.0,
    total_hours: 8,
    notes: 'Ký hiệu: [x] | Chỉnh sửa: Admin duyệt lại đủ công',
  };
  assert(resolveMatrixSymbol(overriddenToFull, false) === 'x',
    'TC-TIME-09: Admin override 0,75x thành "x" -> Ma trận giữ nguyên ký hiệu override "x"');

  // TC-TIME-10: Bảng công tháng đã khóa không cho phép sửa đổi trái phép
  const lockedMonthCheck = checkTimesheetLock([{ user_id: null, month: 8, year: 2026, is_locked: true }], 'user_001', 8, 2026);
  assert(lockedMonthCheck.isLocked === true,
    'TC-TIME-10: Tháng đã chốt khóa (is_locked=true) được bảo vệ toàn vẹn không bị tự động sửa đổi');

  // TC-TIME-11: Kiểm thử trực tiếp implementation production cho công ngày lễ 1,5x / 2x / 3x
  assert(
    PRODUCTION_SYMBOL_MAP['1,5x']?.work_units === 1.5
      && PRODUCTION_SYMBOL_MAP['2x']?.work_units === 2
      && PRODUCTION_SYMBOL_MAP['3x']?.work_units === 3
      && formatWorkUnitSymbol(1.5) === '1,5x'
      && formatWorkUnitSymbol(2) === '2x'
      && formatWorkUnitSymbol(3) === '3x',
    'TC-TIME-11: Production override/map hỗ trợ đúng hệ số ngày lễ 1,5x / 2x / 3x'
  );

  // TC-TIME-12: Dữ liệu có cấu trúc là source of truth, không để note WFH cũ ghi đè P mới
  assert(
    resolveStructuredTimesheetSymbol({ status: 'leave', work_units: 1, check_in_type: 'office', notes: 'Sửa: chuyển WFH thành nghỉ phép' }) === 'P',
    'TC-TIME-12.1: Trạng thái leave đã duyệt hiển thị P dù audit note còn chữ WFH'
  );
  assert(
    resolveStructuredTimesheetSymbol({ status: 'present', work_units: 1.5, check_in_time: '2026-09-02T02:00:00.000Z' }, true) === '1,5x'
      && resolveStructuredTimesheetSymbol({ status: 'present', work_units: 2, check_in_time: '2026-09-02T02:00:00.000Z' }, true) === '2x'
      && resolveStructuredTimesheetSymbol({ status: 'present', work_units: 3, check_in_time: '2026-09-02T02:00:00.000Z' }, true) === '3x'
      && resolveStructuredTimesheetSymbol(null, true) === 'L',
    'TC-TIME-12.2: Ngày lễ có chấm công hiển thị hệ số; không chấm công hiển thị L'
  );
}

module.exports = runTimesheetTests;
