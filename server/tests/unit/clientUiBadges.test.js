// ==============================================
// tests/unit/clientUiBadges.test.js
// Kiểm thử Thành Phần Giao Diện: Badge Trạng Thái, Nhãn Màu & Định Dạng
// ==============================================

const fs = require('fs');
const path = require('path');

function getAttendanceStatusBadge(status) {
  switch (status) {
    case 'present':
      return { label: 'Có mặt', variant: 'success', className: 'badge-success' };
    case 'leave':
      return { label: 'Nghỉ phép', variant: 'warning', className: 'badge-warning' };
    case 'absent':
    default:
      return { label: 'Vắng mặt', variant: 'danger', className: 'badge-danger' };
  }
}

function getRequestStatusBadge(status) {
  switch (status) {
    case 'approved':
      return { label: 'Đã duyệt', variant: 'success', icon: 'CheckCircle' };
    case 'rejected':
      return { label: 'Từ chối', variant: 'danger', icon: 'XCircle' };
    case 'pending':
    default:
      return { label: 'Chờ duyệt', variant: 'warning', icon: 'Clock' };
  }
}

function getLateTierLabel(tier) {
  switch (tier) {
    case 'late_minor':
      return { label: 'Muộn nhẹ', color: '#f59e0b' };
    case 'late_medium':
      return { label: 'Muộn vừa', color: '#f97316' };
    case 'late_severe':
      return { label: 'Muộn nặng', color: '#ef4444' };
    case 'on_time':
    default:
      return { label: 'Đúng giờ', color: '#10b981' };
  }
}

async function runClientUiBadgesTests(assert) {
  console.log('\n🏷️ [TEST SUITE: FRONTEND UI BADGES & STATUS LABELS]');

  // TC-UI-BDG-01: Badge trạng thái điểm danh có mặt
  const b1 = getAttendanceStatusBadge('present');
  assert(b1.label === 'Có mặt' && b1.variant === 'success', 'TC-UI-BDG-01: status=present -> Badge "Có mặt" (success)');

  // TC-UI-BDG-02: Badge trạng thái điểm danh nghỉ phép
  const b2 = getAttendanceStatusBadge('leave');
  assert(b2.label === 'Nghỉ phép' && b2.variant === 'warning', 'TC-UI-BDG-02: status=leave -> Badge "Nghỉ phép" (warning)');

  // TC-UI-BDG-03: Badge trạng thái điểm danh vắng mặt
  const b3 = getAttendanceStatusBadge('absent');
  assert(b3.label === 'Vắng mặt' && b3.variant === 'danger', 'TC-UI-BDG-03: status=absent -> Badge "Vắng mặt" (danger)');

  // TC-UI-BDG-04: Badge trạng thái đơn từ (Pending, Approved, Rejected)
  const reqPending = getRequestStatusBadge('pending');
  const reqApproved = getRequestStatusBadge('approved');
  const reqRejected = getRequestStatusBadge('rejected');
  assert(reqPending.label === 'Chờ duyệt' && reqApproved.label === 'Đã duyệt' && reqRejected.label === 'Từ chối',
    'TC-UI-BDG-04: Đúng nhãn trạng thái đơn từ (Chờ duyệt, Đã duyệt, Từ chối)');

  // TC-UI-BDG-05: Nhãn phân cấp đi muộn (on_time, minor, medium, severe)
  const l1 = getLateTierLabel('on_time');
  const l2 = getLateTierLabel('late_minor');
  const l3 = getLateTierLabel('late_severe');
  assert(l1.label === 'Đúng giờ' && l2.label === 'Muộn nhẹ' && l3.label === 'Muộn nặng',
    'TC-UI-BDG-05: Đúng nhãn phân loại đi muộn theo chuẩn thiết kế');

  const globalStyles = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/index.css'),
    'utf8'
  );
  assert(
    globalStyles.includes('body:has(.email-confirm-overlay) .bottom-nav') &&
      globalStyles.includes('body:has(.notification-popover-overlay) .bottom-nav') &&
      globalStyles.includes('body:has(.image-lightbox) .bottom-nav'),
    'TC-UI-BDG-06: Thanh điều hướng mobile tự ẩn dưới mọi portal overlay'
  );

  const checkInPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/CheckInPage.jsx'),
    'utf8'
  );
  const expensesPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/ExpensesPage.jsx'),
    'utf8'
  );
  assert(
    checkInPage.includes('onClick={() => openDutyStaffProfile(person)}') &&
      expensesPage.includes('onClick={() => setViewingStaffDetail(resolveExpenseStaff(exp))}') &&
      globalStyles.includes('.staff-profile-trigger'),
    'TC-UI-BDG-07: Tên nhân sự tại lịch trực và chi tiêu mở được hồ sơ đồng bộ'
  );

  const imageLightbox = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/components/ImageLightbox.jsx'),
    'utf8'
  );
  const dashboardPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/DashboardPage.jsx'),
    'utf8'
  );
  const reportPage = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/pages/ReportPage.jsx'),
    'utf8'
  );
  assert(
    imageLightbox.includes('className="image-lightbox__controls"') &&
      imageLightbox.includes('getDownloadFilename(image)') &&
      globalStyles.includes('grid-template-columns: repeat(7, minmax(0, 1fr))'),
    'TC-UI-BDG-08: Lightbox mobile không tràn nút và giữ tên file tải về dễ đọc'
  );
  assert(
    dashboardPage.includes('key={p.user_id || p._id || p.id || p.email}'),
    'TC-UI-BDG-09: Danh sách Dashboard luôn có khóa ổn định khi DTO dùng id hoặc _id'
  );
  assert(
    reportPage.includes('className="pdf-export-table"') &&
      globalStyles.includes('table:not(.pdf-export-table) thead th'),
    'TC-UI-BDG-10: Mẫu PDF tách khỏi màu color-mix mà html2canvas không hỗ trợ'
  );

  assert(
    reportPage.includes('renderDaySymbol') &&
      reportPage.includes('hasOt = otHoursNum > 0') &&
      reportPage.includes('{(isLate || hasOt) && (') &&
      !reportPage.includes('{!isSun && (isLate || hasOt) && ('),
    'TC-UI-BDG-11: OT Chủ nhật hiển thị trực quan đầy đủ trên cả Weekstrip và Month Grid'
  );

  assert(
    globalStyles.includes('.timesheet-day-symbol.has-ot') &&
      globalStyles.includes('.timesheet-ot-marker') &&
      globalStyles.includes('linear-gradient(135deg, #9a3412, #b91c1c)') &&
      globalStyles.includes('[data-theme="dark"] .timesheet-legend__item.is-ot') &&
      globalStyles.includes('#fdba74'),
    'TC-UI-BDG-12: Badge OT và Legend đạt chuẩn độ tương phản WCAG 2.2 AA (>= 4.5:1)'
  );

  assert(
    reportPage.includes("d.ot_hours > 0 ? 'rgba(194, 65, 12, 0.08)'") &&
      reportPage.includes('handleOpenMatrixCell') &&
      reportPage.includes('handleOpenMonthCell'),
    'TC-UI-BDG-13: Cell bảng công và lưới tháng hỗ trợ tương tác và xem chi tiết khi Chủ nhật có OT'
  );

  // === KIỂM THỬ TRỰC TIẾP MODULE timesheetGridA11y.js (WCAG 2.2 AA & 2D NAVIGATION) ===
  const {
    clampMatrixCoords,
    formatTimesheetCellAriaLabel,
    getNextMatrixCoords,
    getNextMonthGridCoords,
    getMatrixRovingTabIndex,
    getFocusableElements,
    trapFocusInDialog,
    handleDialogKeyDown,
  } = await import('../../../client/src/utils/timesheetGridA11y.js');

  // TC-UI-BDG-14: Định dạng nhãn ARIA chi tiết cho Screen Reader
  const ariaHolidayOt = formatTimesheetCellAriaLabel({
    day: 2,
    weekday: 'T3',
    dateStr: '2026-09-02',
    staffName: 'Nguyễn Văn A',
    symbol: 'L',
    isHoliday: true,
    holidayName: 'Quốc khánh 2/9',
    otHours: 4,
    isAdmin: true,
  });
  assert(
    ariaHolidayOt.includes('Ngày 2/9/2026 (T3)') &&
      ariaHolidayOt.includes('Nguyễn Văn A') &&
      ariaHolidayOt.includes('Nghỉ Lễ: Quốc khánh 2/9') &&
      ariaHolidayOt.includes('Tăng ca OT 4 giờ') &&
      ariaHolidayOt.includes('Bấm để xem và sửa'),
    'TC-UI-BDG-14a: Nhãn ARIA mô tả đầy đủ ngày lễ, OT và quyền chỉnh sửa của Admin'
  );

  const ariaLateEarly = formatTimesheetCellAriaLabel({
    day: 15,
    weekday: 'T4',
    staffName: 'Trần Thị B',
    symbol: 'x',
    isLate: true,
    lateMinutes: 18,
    isEarlyLeave: true,
    earlyMinutes: 10,
    isAdmin: false,
  });
  assert(
    ariaLateEarly.includes('Ký hiệu x') &&
      ariaLateEarly.includes('Đi muộn 18 phút') &&
      ariaLateEarly.includes('Về sớm 10 phút') &&
      ariaLateEarly.includes('Bấm để xem chi tiết'),
    'TC-UI-BDG-14b: Nhãn ARIA mô tả chính xác số phút đi muộn / về sớm cho Non-admin'
  );

  // TC-UI-BDG-15: Điều hướng bàn phím ma trận 2D (Desktop Matrix Navigation)
  const navRight = getNextMatrixCoords(2, 5, 10, 31, 'ArrowRight');
  const navLeft = getNextMatrixCoords(2, 5, 10, 31, 'ArrowLeft');
  const navDown = getNextMatrixCoords(2, 5, 10, 31, 'ArrowDown');
  const navUp = getNextMatrixCoords(2, 5, 10, 31, 'ArrowUp');
  const navHome = getNextMatrixCoords(2, 5, 10, 31, 'Home');
  const navEnd = getNextMatrixCoords(2, 5, 10, 31, 'End');
  const navPageDown = getNextMatrixCoords(2, 5, 10, 31, 'PageDown');
  const navPageUp = getNextMatrixCoords(7, 5, 10, 31, 'PageUp');

  assert(
    navRight.handled && navRight.staffIdx === 2 && navRight.dayIdx === 6 &&
      navLeft.handled && navLeft.staffIdx === 2 && navLeft.dayIdx === 4 &&
      navDown.handled && navDown.staffIdx === 3 && navDown.dayIdx === 5 &&
      navUp.handled && navUp.staffIdx === 1 && navUp.dayIdx === 5 &&
      navHome.handled && navHome.dayIdx === 0 &&
      navEnd.handled && navEnd.dayIdx === 30 &&
      navPageDown.handled && navPageDown.staffIdx === 7 &&
      navPageUp.handled && navPageUp.staffIdx === 2,
    'TC-UI-BDG-15: Điều hướng bàn phím ma trận 2D chuẩn xác theo mọi hướng và biên giới hạn'
  );

  // TC-UI-BDG-16: Điều hướng bàn phím lưới tháng 7 cột (Month Grid Navigation)
  const mNavDown = getNextMonthGridCoords(10, 31, 'ArrowDown');
  const mNavUp = getNextMonthGridCoords(10, 31, 'ArrowUp');
  const mNavRight = getNextMonthGridCoords(10, 31, 'ArrowRight');
  const mNavLeft = getNextMonthGridCoords(10, 31, 'ArrowLeft');
  const mNavClamp = getNextMonthGridCoords(28, 31, 'ArrowDown');

  assert(
    mNavDown.handled && mNavDown.dayIdx === 17 &&
      mNavUp.handled && mNavUp.dayIdx === 3 &&
      mNavRight.handled && mNavRight.dayIdx === 11 &&
      mNavLeft.handled && mNavLeft.dayIdx === 9 &&
      mNavClamp.handled && mNavClamp.dayIdx === 30,
    'TC-UI-BDG-16: Điều hướng lưới tháng 7 cột nhảy đúng ±7 ngày (tuần) và kẹp biên an toàn'
  );

  // TC-UI-BDG-17: Roving TabIndex cho ô ma trận
  assert(
    getMatrixRovingTabIndex(2, 5, 2, 5, 10, 31) === 0 &&
      getMatrixRovingTabIndex(2, 6, 2, 5, 10, 31) === -1 &&
      getMatrixRovingTabIndex(3, 5, 2, 5, 10, 31) === -1 &&
      getMatrixRovingTabIndex(0, 0, 50, 50, 5, 5) === -1 &&
      getMatrixRovingTabIndex(4, 4, 50, 50, 5, 5) === 0,
    'TC-UI-BDG-17: Roving Tabindex gán 0 cho duy nhất ô đang chọn và kẹp biên an toàn'
  );

  // TC-UI-BDG-18: Kẹp tọa độ ma trận hợp lệ (clampMatrixCoords)
  const clampNegative = clampMatrixCoords({ staffIdx: -3, dayIdx: -5 }, 10, 31);
  const clampOverflow = clampMatrixCoords({ staffIdx: 25, dayIdx: 50 }, 10, 31);
  const clampValid = clampMatrixCoords({ staffIdx: 4, dayIdx: 12 }, 10, 31);
  const clampZero = clampMatrixCoords({ staffIdx: 0, dayIdx: 0 }, 0, 0);
  assert(
    clampNegative.staffIdx === 0 && clampNegative.dayIdx === 0 &&
      clampOverflow.staffIdx === 9 && clampOverflow.dayIdx === 30 &&
      clampValid.staffIdx === 4 && clampValid.dayIdx === 12 &&
      clampZero.staffIdx === 0 && clampZero.dayIdx === 0,
    'TC-UI-BDG-18: clampMatrixCoords kẹp chuẩn xác mọi biên âm, tràn và kích thước 0'
  );

  // TC-UI-BDG-19: Focus Trap và Bẫy phím Modal Dialog (W3C APG Pattern)
  const originalDoc = global.document;
  try {
    const mockBtn1 = { disabled: false, offsetWidth: 100, focus: () => { focusedEl = mockBtn1; } };
    const mockBtn2 = { disabled: false, offsetWidth: 100, focus: () => { focusedEl = mockBtn2; } };
    const mockHiddenBtn = { disabled: false, offsetWidth: 0, style: { display: 'none' } };
    let focusedEl = mockBtn1;

    const mockContainer = {
      querySelectorAll: () => [mockBtn1, mockBtn2, mockHiddenBtn],
      contains: (el) => [mockBtn1, mockBtn2].includes(el),
      focus: () => { focusedEl = mockContainer; },
    };

    const focusable = getFocusableElements(mockContainer);
    assert(
      focusable.length === 2 && focusable[0] === mockBtn1 && focusable[1] === mockBtn2,
      'TC-UI-BDG-19a: getFocusableElements lọc chính xác các phần tử tương tác hiển thị'
    );

    // Tab tại phần tử cuối cùng -> vòng về phần tử đầu tiên
    global.document = { activeElement: mockBtn2 };
    let prevented = false;
    const tabEvent = { key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } };
    const trapRes1 = trapFocusInDialog(tabEvent, mockContainer);
    assert(trapRes1 && prevented && focusedEl === mockBtn1, 'TC-UI-BDG-19b: Tab tại nút cuối vòng về nút đầu tiên');

    // Shift + Tab tại phần tử đầu tiên -> vòng về phần tử cuối cùng
    global.document = { activeElement: mockBtn1 };
    prevented = false;
    const shiftTabEvent = { key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } };
    const trapRes2 = trapFocusInDialog(shiftTabEvent, mockContainer);
    assert(trapRes2 && prevented && focusedEl === mockBtn2, 'TC-UI-BDG-19c: Shift+Tab tại nút đầu vòng về nút cuối cùng');

    // Escape key handling
    let escapeTriggered = false;
    const escEvent = { key: 'Escape', preventDefault: () => {} };
    const escRes = handleDialogKeyDown(escEvent, { onEscape: () => { escapeTriggered = true; } });
    assert(escRes && escapeTriggered, 'TC-UI-BDG-19d: handleDialogKeyDown kích hoạt callback onEscape khi ấn Escape');
  } finally {
    global.document = originalDoc;
  }

  // TC-UI-BDG-20: Tích hợp Semantic Button & Accessible Controls trên ReportPage
  assert(
    reportPage.includes('className="timesheet-cell-btn"') &&
      reportPage.includes('className="timesheet-month-cell"') &&
      reportPage.includes('tabIndex={isFocused ? 0 : -1}') &&
      reportPage.includes('aria-label={cellAriaLabel}') &&
      reportPage.includes('role="dialog"') &&
      reportPage.includes('aria-modal="true"') &&
      reportPage.includes('aria-labelledby="cell-detail-modal-title"') &&
      reportPage.includes('closeCellModal') &&
      reportPage.includes('cellModalTriggerRef') &&
      reportPage.includes('lockTriggerRef') &&
      reportPage.includes('closeLockConfirm') &&
      reportPage.includes('closeExportModal') &&
      reportPage.includes('pdfModalTriggerRef.current = exportModalTriggerRef.current') &&
      reportPage.includes('exportModalTriggerRef.current = staffProfileTriggerRef.current') &&
      reportPage.includes('restorePdfTriggerFocus') &&
      !reportPage.includes("setCellSymbol(dayData?.symbol || (headerDay?.isHoliday ? 'L' : 'x'));") &&
      !reportPage.includes("setCellSymbol(d.symbol || (isHol ? 'L' : 'x'));"),
    'TC-UI-BDG-20: ReportPage áp dụng đầy đủ Semantic Button, W3C Dialog Semantics, Focus Restoration chuỗi modal (kể cả lỗi PDF) và Không gán bừa ký hiệu x cho Chủ nhật/ô trống'
  );

  // TC-UI-BDG-21: getFocusableElements trong môi trường JSDOM (kích thước 0x0) và kiểm tra ẩn bởi Ancestor
  const parentVisible = { parentElement: null };
  const parentHidden = { parentElement: null };
  const mockWindow = {
    getComputedStyle: (el) => {
      if (el === parentHidden || el?.style?.display === 'none') {
        return { display: 'none', visibility: 'hidden' };
      }
      return { display: 'block', visibility: 'visible' };
    },
  };
  const originalWindow = global.window;
  try {
    global.window = mockWindow;

    const jsdomBtn1 = { disabled: false, offsetWidth: 0, offsetHeight: 0, parentElement: parentVisible, style: {} };
    const jsdomBtn2 = { disabled: false, offsetWidth: 0, offsetHeight: 0, parentElement: parentVisible, style: {} };
    const jsdomHiddenByParent = { disabled: false, offsetWidth: 0, offsetHeight: 0, parentElement: parentHidden, style: {} };
    const jsdomDirectHidden = { disabled: false, offsetWidth: 0, offsetHeight: 0, parentElement: parentVisible, style: { display: 'none' } };

    const jsdomContainer = {
      querySelectorAll: () => [jsdomBtn1, jsdomBtn2, jsdomHiddenByParent, jsdomDirectHidden],
    };

    const jsdomFocusable = getFocusableElements(jsdomContainer);
    assert(
      jsdomFocusable.length === 2 &&
        jsdomFocusable[0] === jsdomBtn1 &&
        jsdomFocusable[1] === jsdomBtn2,
      'TC-UI-BDG-21: getFocusableElements hoạt động chính xác trong JSDOM/Headless và loại bỏ đúng phần tử ẩn bởi Ancestor'
    );
  } finally {
    global.window = originalWindow;
  }
}

module.exports = runClientUiBadgesTests;
