// ==============================================
// client/src/utils/timesheetGridA11y.js
// Hỗ trợ Điều Hướng Bàn Phím 2D & Roving Tabindex Chuẩn W3C WAI-ARIA
// ==============================================

/**
 * Chuẩn hóa và kẹp tọa độ focus hợp lệ trong giới hạn ma trận
 */
export function clampMatrixCoords(coords, totalStaff, totalDays) {
  if (totalStaff <= 0 || totalDays <= 0) {
    return { staffIdx: 0, dayIdx: 0 };
  }
  return {
    staffIdx: Math.max(0, Math.min(totalStaff - 1, Number(coords?.staffIdx) || 0)),
    dayIdx: Math.max(0, Math.min(totalDays - 1, Number(coords?.dayIdx) || 0)),
  };
}

/**
 * Tính toán tọa độ tiếp theo trong Ma trận chấm công 2D (Desktop Matrix)
 * Hỗ trợ các phím: ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End, PageUp, PageDown
 */
export function getNextMatrixCoords(currentStaffIdx, currentDayIdx, totalStaff, totalDays, key) {
  if (totalStaff <= 0 || totalDays <= 0) {
    return { staffIdx: 0, dayIdx: 0, handled: false };
  }

  const staffIdx = Math.max(0, Math.min(totalStaff - 1, currentStaffIdx));
  const dayIdx = Math.max(0, Math.min(totalDays - 1, currentDayIdx));

  switch (key) {
    case 'ArrowRight':
      return {
        staffIdx,
        dayIdx: Math.min(totalDays - 1, dayIdx + 1),
        handled: true,
      };
    case 'ArrowLeft':
      return {
        staffIdx,
        dayIdx: Math.max(0, dayIdx - 1),
        handled: true,
      };
    case 'ArrowDown':
      return {
        staffIdx: Math.min(totalStaff - 1, staffIdx + 1),
        dayIdx,
        handled: true,
      };
    case 'ArrowUp':
      return {
        staffIdx: Math.max(0, staffIdx - 1),
        dayIdx,
        handled: true,
      };
    case 'Home':
      return {
        staffIdx,
        dayIdx: 0,
        handled: true,
      };
    case 'End':
      return {
        staffIdx,
        dayIdx: totalDays - 1,
        handled: true,
      };
    case 'PageUp':
      return {
        staffIdx: Math.max(0, staffIdx - 5),
        dayIdx,
        handled: true,
      };
    case 'PageDown':
      return {
        staffIdx: Math.min(totalStaff - 1, staffIdx + 5),
        dayIdx,
        handled: true,
      };
    default:
      return { staffIdx, dayIdx, handled: false };
  }
}

/**
 * Tính toán tọa độ tiếp theo trong Lưới tháng 7 cột (Month Grid)
 * ArrowDown / ArrowUp nhảy 7 ngày (1 tuần)
 */
export function getNextMonthGridCoords(currentDayIdx, totalDays, key) {
  if (totalDays <= 0) {
    return { dayIdx: 0, handled: false };
  }

  const dayIdx = Math.max(0, Math.min(totalDays - 1, currentDayIdx));

  switch (key) {
    case 'ArrowRight':
      return {
        dayIdx: Math.min(totalDays - 1, dayIdx + 1),
        handled: true,
      };
    case 'ArrowLeft':
      return {
        dayIdx: Math.max(0, dayIdx - 1),
        handled: true,
      };
    case 'ArrowDown':
      return {
        dayIdx: Math.min(totalDays - 1, dayIdx + 7),
        handled: true,
      };
    case 'ArrowUp':
      return {
        dayIdx: Math.max(0, dayIdx - 7),
        handled: true,
      };
    case 'Home':
      return {
        dayIdx: 0,
        handled: true,
      };
    case 'End':
      return {
        dayIdx: totalDays - 1,
        handled: true,
      };
    default:
      return { dayIdx, handled: false };
  }
}

/**
 * Xác định tabIndex theo cơ chế Roving TabIndex:
 * Chỉ ô đang được chọn/focus mới có tabIndex=0, toàn bộ các ô còn lại trong ma trận có tabIndex=-1.
 * Tự động kẹp tọa độ vào phạm vi hợp lệ (totalStaff, totalDays) để không bao giờ mất điểm Tab!
 */
export function getMatrixRovingTabIndex(staffIdx, dayIdx, focusedStaffIdx, focusedDayIdx, totalStaff, totalDays) {
  let targetStaff = typeof focusedStaffIdx === 'number' ? focusedStaffIdx : 0;
  let targetDay = typeof focusedDayIdx === 'number' ? focusedDayIdx : 0;

  if (typeof totalStaff === 'number' && totalStaff > 0) {
    targetStaff = Math.max(0, Math.min(totalStaff - 1, targetStaff));
  }
  if (typeof totalDays === 'number' && totalDays > 0) {
    targetDay = Math.max(0, Math.min(totalDays - 1, targetDay));
  }

  return staffIdx === targetStaff && dayIdx === targetDay ? 0 : -1;
}

/**
 * Tạo nhãn ARIA đầy đủ ngữ cảnh cho người dùng khiếm thị / dùng Screen Reader
 */
export function formatTimesheetCellAriaLabel({
  day,
  weekday,
  dateStr,
  staffName,
  symbol,
  isSunday,
  isHoliday,
  holidayName,
  otHours = 0,
  isLate = false,
  lateMinutes = 0,
  isEarlyLeave = false,
  earlyMinutes = 0,
  isInteractive = true,
  isAdmin = false,
}) {
  const parts = [];

  // 1. Thông tin ngày, thứ, tháng, năm đầy đủ
  if (dateStr) {
    const partsDate = String(dateStr).split('-');
    if (partsDate.length === 3) {
      const [y, m, d] = partsDate;
      parts.push(`Ngày ${Number(d)}/${Number(m)}/${y}${weekday ? ` (${weekday})` : ''}`);
    } else {
      parts.push(`Ngày ${dateStr}${weekday ? ` (${weekday})` : ''}`);
    }
  } else if (day) {
    parts.push(`Ngày ${day}${weekday ? ` (${weekday})` : ''}`);
  }

  // 2. Tên nhân sự
  if (staffName) {
    parts.push(`của ${staffName}`);
  }

  // 3. Trạng thái ngày nghỉ lễ / chủ nhật / công
  if (isHoliday) {
    parts.push(`Nghỉ Lễ: ${holidayName || 'Ngày lễ'}`);
  } else if (symbol) {
    parts.push(`Ký hiệu ${symbol}`);
  } else if (isSunday) {
    parts.push('Chủ nhật');
  } else {
    parts.push('Không có công');
  }

  // 4. Thông tin tăng ca OT
  const otNum = Number(otHours) || 0;
  if (otNum > 0) {
    parts.push(`Tăng ca OT ${otNum} giờ`);
  }

  // 5. Đi muộn / về sớm
  if (isLate) {
    parts.push(`Đi muộn ${lateMinutes || 0} phút`);
  }
  if (isEarlyLeave) {
    parts.push(`Về sớm ${earlyMinutes || 0} phút`);
  }

  // 6. Gợi ý tương tác
  if (isInteractive) {
    parts.push(isAdmin ? 'Bấm để xem và sửa' : 'Bấm để xem chi tiết');
  } else {
    parts.push('Không có dữ liệu');
  }

  return parts.join(', ');
}

/**
 * Lấy danh sách các phần tử có thể nhận focus (focusable elements) bên trong container
 */
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return [];
  }
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const elements = Array.from(container.querySelectorAll(selector));
  return elements.filter(el => {
    if (el.disabled || (typeof el.getAttribute === 'function' && el.getAttribute('aria-hidden') === 'true') || el.hidden) {
      return false;
    }

    if (typeof el.checkVisibility === 'function') {
      try {
        if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) {
          return false;
        }
      } catch {}
    }

    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        let curr = el;
        while (curr && curr !== container && (typeof document === 'undefined' || curr !== document?.body)) {
          const style = window.getComputedStyle(curr);
          if (style && (style.display === 'none' || style.visibility === 'hidden')) {
            return false;
          }
          curr = curr.parentElement;
        }
      } catch {
        // Fallback if getComputedStyle fails in headless / mock environment
      }
    }

    // Inline style check fallback
    if (el.style?.display === 'none' || el.style?.visibility === 'hidden') {
      return false;
    }

    return true;
  });
}

/**
 * Focus Trap bên trong Modal Dialog theo chuẩn W3C WAI-ARIA
 * Khóa phím Tab và Shift+Tab bên trong dialog, ngăn focus nhảy ra ngoài background
 */
export function trapFocusInDialog(event, container) {
  if (!event || event.key !== 'Tab' || !container) return false;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    if (typeof container.focus === 'function') {
      container.focus();
    }
    return true;
  }

  const firstElement = focusable[0];
  const lastElement = focusable[focusable.length - 1];
  const activeEl = (typeof document !== 'undefined' ? document.activeElement : null);

  if (event.shiftKey) {
    // Shift + Tab: Đang ở phần tử đầu tiên hoặc focus nằm ngoài modal -> nhảy về phần tử cuối cùng
    if (activeEl === firstElement || !container.contains(activeEl)) {
      event.preventDefault();
      if (typeof lastElement.focus === 'function') {
        lastElement.focus();
      }
      return true;
    }
  } else {
    // Tab: Đang ở phần tử cuối cùng hoặc focus nằm ngoài modal -> nhảy về phần tử đầu tiên
    if (activeEl === lastElement || !container.contains(activeEl)) {
      event.preventDefault();
      if (typeof firstElement.focus === 'function') {
        firstElement.focus();
      }
      return true;
    }
  }

  return false;
}

/**
 * Xử lý sự kiện phím trong Modal Dialog (Escape để đóng + Tab để trap focus)
 */
export function handleDialogKeyDown(event, options = {}) {
  if (!event) return false;
  const { onEscape, container } = options;

  if (event.key === 'Escape' || event.key === 'Esc') {
    if (typeof onEscape === 'function') {
      event.preventDefault();
      onEscape();
      return true;
    }
  }

  if (event.key === 'Tab' && container) {
    return trapFocusInDialog(event, container);
  }

  return false;
}
