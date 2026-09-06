import { test, expect } from '@playwright/test';

const testUser = {
  _id: '000000000000000000000001', full_name: 'Nhân viên thử nghiệm',
  role: 'admin', department_ids: [], employee_code: 'TEST01',
};

const historyPayload = (month = 9) => ({
  records: [{
    _id: `record-${month}`, date: `2026-${String(month).padStart(2, '0')}-01`,
    check_in_time: `2026-${String(month).padStart(2, '0')}-01T02:00:00Z`,
    check_out_time: `2026-${String(month).padStart(2, '0')}-01T11:00:00Z`,
    total_hours: 8, work_units: 1, status: 'checked_out', check_in_type: 'office',
    notes: `Dữ liệu tháng ${month}`,
  }],
  summary: { total_days: 22, present_days: 1, total_hours: 8, ot_hours: 0 },
});

const expensePayload = description => ({
  expenses: [{
    _id: 'expense-test', description, date: '2026-09-01', amount: 100000,
    approval_status: 'pending', payment_status: 'unpaid', user_id: testUser,
  }],
  summary: { totalCount: 1, totalPages: 1, totalPendingCount: 1, totalPendingAmount: 100000 },
});

async function setupIsolatedApp(page, user = testUser) {
  await page.addInitScript(userData => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', 'isolated-ui-test-token');
    // Keep tests deterministic and exercise the low-data path without background imports.
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } });
  }, user);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4177') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data = [];
    if (url.pathname === '/api/settings') data = { company_name: 'ET Office Test', company_logo_url: '/logo.png', work_start_time: '09:00', work_end_time: '18:30' };
    if (url.pathname === '/api/notifications') data = { notifications: [], unread_count: 0 };
    if (url.pathname === '/api/dashboard/pending-count') data = { pending_count: 3 };
    if (url.pathname === '/api/attendance/history') data = historyPayload(Number(url.searchParams.get('month')) || 9);
    if (url.pathname === '/api/expenses') data = expensePayload('Khoản chi ban đầu');
    if (url.pathname === '/api/reports/leaderboard') data = { rankings: [], myRank: null };
    if (url.pathname === '/api/tts-schedules') data = { schedule: {}, allowed_dates: [], tts_users: [], people: [] };
    return route.fulfill({ json: data });
  });
}

for (const { role, exempt = false } of [
  { role: 'admin' }, { role: 'leader' }, { role: 'manager' },
  { role: 'employee' }, { role: 'staff' }, { role: 'employee', exempt: true },
]) {
  test(`mobile navigation: ${role}${exempt ? ' exempt' : ''}`, async ({ page }) => {
    await setupIsolatedApp(page, { ...testUser, role, is_attendance_exempt: exempt });
    if (role === 'admin') await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/history');
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính trên điện thoại' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(4);
    await expect(nav.getByRole('button')).toHaveCount(1);
    const bounds = await nav.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, right: el.getBoundingClientRect().right }));
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.right).toBeLessThanOrEqual(320);
    await nav.getByRole('button').click();
    const dialog = page.getByRole('dialog', { name: 'Tiện ích' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Cài đặt', exact: true })).toHaveCount(role === 'admin' ? 1 : 0);
    await expect(dialog.getByRole('link', { name: 'Nhân viên', exact: true })).toHaveCount(['admin', 'leader', 'manager'].includes(role) ? 1 : 0);
    if (role === 'admin') {
      await page.screenshot({ path: 'test-results/mobile-menu-light.png', animations: 'disabled' });
    }
    if (exempt) {
      await expect(page.locator('a[href="/checkin"]')).toHaveCount(0);
      await expect(page.locator('a[href="/requests"]')).toHaveCount(0);
    }
  });
}

test('menu traps focus, restores focus, supports dark theme and desktop resize', async ({ page }) => {
  await setupIsolatedApp(page);
  await page.goto('/history');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính trên điện thoại' });
  const more = nav.getByRole('button');
  await more.click();
  const dialog = page.getByRole('dialog', { name: 'Tiện ích' });
  const close = dialog.getByRole('button', { name: 'Đóng menu tiện ích' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await more.click();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-menu-dark.png', animations: 'disabled' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  await expect(nav).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('slow lazy route keeps navigation available', async ({ page }) => {
  await setupIsolatedApp(page);
  let releaseChunk;
  const chunkGate = new Promise(resolve => { releaseChunk = resolve; });
  let chunkStarted;
  const started = new Promise(resolve => { chunkStarted = resolve; });
  await page.route('**/src/pages/ExpensesPage.jsx*', async route => {
    chunkStarted();
    await chunkGate;
    await route.continue();
  });
  await page.goto('/history');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính trên điện thoại' });
  await nav.getByRole('button').click();
  await page.getByRole('dialog', { name: 'Tiện ích' }).getByRole('link', { name: 'Chi tiêu' }).click();
  await started;
  try {
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button')).toBeEnabled();
    await expect(page.locator('.app-shell')).not.toHaveAttribute('inert');
  } finally { releaseChunk(); }
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByText('Khoản chi ban đầu', { exact: true })).toBeVisible();
});

test('history aborts the older month before rendering the next month', async ({ page }) => {
  await setupIsolatedApp(page);
  await page.clock.setFixedTime(new Date('2026-09-06T03:00:00Z'));
  let releaseOld;
  const oldGate = new Promise(resolve => { releaseOld = resolve; });
  let oldStarted;
  const started = new Promise(resolve => { oldStarted = resolve; });
  await page.route('**/api/attendance/history?**', async route => {
    const month = Number(new URL(route.request().url()).searchParams.get('month'));
    if (month === 8) { oldStarted(); await oldGate; }
    await route.fulfill({ json: historyPayload(month) }).catch(() => {});
  });
  await page.goto('/history');
  await page.getByTitle('Danh sách thẻ').click();
  await expect(page.getByText(/01\/09 ·/)).toBeVisible();
  const aborted = page.waitForEvent('requestfailed', { predicate: req => req.url().includes('/attendance/history?month=8&') });
  await page.getByRole('button', { name: 'Tháng trước', exact: true }).click();
  await started;
  await page.getByRole('button', { name: 'Tháng sau', exact: true }).click();
  await aborted;
  releaseOld();
  await expect(page.getByText(/01\/09 ·/)).toBeVisible();
  await expect(page.getByText(/01\/08 ·/)).toHaveCount(0);
  await expect(page.getByText('Lỗi tải lịch sử', { exact: true })).toHaveCount(0);
});

test('expenses cancels an old search while the next search is debouncing', async ({ page }) => {
  await setupIsolatedApp(page);
  let releaseOld;
  const oldGate = new Promise(resolve => { releaseOld = resolve; });
  let oldStarted;
  const started = new Promise(resolve => { oldStarted = resolve; });
  await page.route('**/api/expenses?**', async route => {
    const search = new URL(route.request().url()).searchParams.get('search');
    if (search === 'cũ') { oldStarted(); await oldGate; }
    await route.fulfill({ json: expensePayload(search === 'cũ' ? 'Kết quả cũ' : search === 'mới' ? 'Kết quả mới' : 'Khoản chi ban đầu') }).catch(() => {});
  });
  await page.goto('/expenses');
  const search = page.getByPlaceholder('Tìm nội dung, người chi, số tiền...');
  await expect(page.getByText('Khoản chi ban đầu', { exact: true })).toBeVisible();
  const aborted = page.waitForEvent('requestfailed', { predicate: req => new URL(req.url()).searchParams.get('search') === 'cũ' });
  await search.fill('cũ');
  await started;
  await search.fill('mới');
  await aborted;
  releaseOld();
  await expect(page.getByText('Kết quả mới', { exact: true })).toBeVisible();
  await expect(page.getByText('Kết quả cũ', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Lỗi tải danh sách chi tiêu', { exact: true })).toHaveCount(0);
});

test('weekly schedule stays readable but cannot be edited before its refresh completes', async ({ page }) => {
  await setupIsolatedApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const trainee = { _id: '000000000000000000000002', full_name: 'TTS thử nghiệm', employee_code: 'TTS01' };
  let saved = false;
  let releaseRefresh;
  const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  let refreshStarted;
  const started = new Promise(resolve => { refreshStarted = resolve; });
  await page.route('**/api/tts-schedules**', async route => {
    if (route.request().method() === 'PUT') {
      saved = true;
      return route.fulfill({ json: { success: true } });
    }
    if (saved) { refreshStarted(); await refreshGate; }
    return route.fulfill({ json: {
      can_manage: true, can_manage_duties: true, is_registration_locked: false,
      allowed_dates: ['2026-09-07'], tts_users: [trainee], people: [trainee],
      schedule: { status: 'open', week_end: '2026-09-12', registrations: [], duties: [], instructions: { before_work: saved ? 'Hướng dẫn mới' : 'Hướng dẫn ban đầu' } },
    } });
  });
  await page.goto('/tts-schedule');
  const slot = page.getByRole('button', { name: 'TTS thử nghiệm, Thứ 2 buổi sáng: chưa đăng ký', exact: true });
  await expect(slot).toBeEnabled();
  await page.getByRole('button', { name: 'Sửa nội dung', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nội dung trực nhật', exact: true });
  await dialog.getByLabel('Trước giờ làm').fill('Hướng dẫn mới');
  await dialog.getByRole('button', { name: 'Lưu nội dung' }).click();
  await started;
  try {
    await expect(page.getByText('Đang cập nhật lịch tuần…', { exact: true })).toBeVisible();
    await expect(slot).toBeVisible();
    await expect(slot).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sửa nội dung', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sửa phân công', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Khóa lịch', exact: true })).toBeDisabled();
  } finally { releaseRefresh(); }
  await expect(page.getByText('Hướng dẫn mới', { exact: true })).toBeVisible();
  await expect(slot).toBeEnabled();
});
