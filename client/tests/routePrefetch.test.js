import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createRoutePrefetcher } from '../src/utils/routePrefetch.js';

const routes = ['/checkin', '/dashboard', '/requests', '/history', '/staff', '/profile', '/reports', '/projects'];
const flush = () => setImmediate();

function fixture({ idle = true, overrides = {} } = {}) {
  let nextId = 0;
  const scheduled = new Map();
  const imported = [];
  const delays = [];
  const browser = {
    navigator: { onLine: true, connection: { saveData: false, effectiveType: '4g' } },
    document: { visibilityState: 'visible' },
    setTimeout: (callback, delay) => {
      delays.push(delay);
      scheduled.set(++nextId, callback);
      return nextId;
    },
    clearTimeout: id => scheduled.delete(id),
  };
  if (idle) {
    browser.requestIdleCallback = callback => {
      scheduled.set(++nextId, callback);
      return nextId;
    };
    browser.cancelIdleCallback = id => scheduled.delete(id);
  }
  const loaders = Object.fromEntries(routes.map(path => [path, () => {
    imported.push(path);
    return overrides[path]?.();
  }]));
  const prefetcher = createRoutePrefetcher({ loaders, getWindow: () => browser });
  const runNext = async (idleTime = 50) => {
    const next = scheduled.entries().next().value;
    assert.ok(next, 'Expected a scheduled idle callback or fallback timer');
    scheduled.delete(next[0]);
    next[1](idle ? { timeRemaining: () => idleTime } : undefined);
    await flush();
  };
  return { ...prefetcher, browser, imported, scheduled, delays, runNext };
}

test('automatic prefetch loads at most two relevant routes per app session', async () => {
  const f = fixture();
  f.prefetchAllCoreRoutes({ user: { role: 'employee' }, currentPath: '/checkin' });
  assert.equal(f.imported.length, 0);
  assert.equal(f.scheduled.size, 1);
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests']);
  assert.equal(f.scheduled.size, 1);
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests', '/history']);
  assert.equal(f.scheduled.size, 0);
  f.prefetchAllCoreRoutes({ user: { role: 'employee' }, currentPath: '/profile' });
  assert.equal(f.scheduled.size, 0, 'Navigating again must not restart a full preload sweep');
});

test('role and exemption rules select useful routes and skip current/heavy pages', async () => {
  for (const role of ['admin', 'leader', 'manager']) {
    const f = fixture();
    f.prefetchAllCoreRoutes({ user: { role }, currentPath: '/requests' });
    await f.runNext();
    await f.runNext();
    assert.deepEqual(f.imported, ['/checkin', '/history']);
  }
  for (const role of ['employee', 'staff']) {
    const f = fixture();
    f.prefetchAllCoreRoutes({ user: { role, is_attendance_exempt: true }, currentPath: '/dashboard' });
    await f.runNext();
    await f.runNext();
    assert.deepEqual(f.imported, ['/profile', '/projects']);
  }
  const anonymous = fixture();
  anonymous.prefetchAllCoreRoutes();
  anonymous.prefetchAllCoreRoutes({ user: { role: 'unknown' } });
  assert.equal(anonymous.scheduled.size, 0);
});

test('Save-Data, slow connections, offline and hidden tabs suppress speculative loads', async () => {
  const restrict = [
    browser => { browser.navigator.connection.saveData = true; },
    browser => { browser.navigator.connection.effectiveType = '2g'; },
    browser => { browser.navigator.connection.effectiveType = 'slow-2g'; },
    browser => { browser.navigator.onLine = false; },
    browser => { browser.document.visibilityState = 'hidden'; },
  ];
  for (const setRestriction of restrict) {
    const f = fixture();
    setRestriction(f.browser);
    f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
    assert.equal(await f.prefetchRoute('/reports'), false);
    assert.equal(f.scheduled.size, 0);
    assert.equal(f.imported.length, 0);
  }
});

test('network and visibility are rechecked before each scheduled import', async () => {
  const f = fixture();
  f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  await f.runNext();
  f.browser.document.visibilityState = 'hidden';
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests']);
  assert.equal(f.scheduled.size, 0);
});

test('cleanup cancels idle work, including replacement by another user', async () => {
  const f = fixture();
  const cancel = f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  cancel();
  cancel();
  assert.equal(f.scheduled.size, 0);
  f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  f.prefetchAllCoreRoutes({ user: { role: 'staff', is_attendance_exempt: true } });
  assert.equal(f.scheduled.size, 1);
  await f.runNext();
  assert.deepEqual(f.imported, ['/profile']);
});

test('each import finishes before the next idle slot and cancellation stops its successor', async () => {
  let finishImport;
  const f = fixture({ overrides: { '/requests': () => new Promise(resolve => { finishImport = resolve; }) } });
  const cancel = f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests']);
  assert.equal(f.scheduled.size, 0);
  cancel();
  finishImport();
  await flush();
  assert.equal(f.scheduled.size, 0);
});

test('a busy idle slot is rescheduled without importing', async () => {
  const f = fixture();
  f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  await f.runNext(0);
  assert.equal(f.imported.length, 0);
  assert.equal(f.scheduled.size, 1);
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests']);
});

test('fallback timers are staggered and can be cancelled', async () => {
  const f = fixture({ idle: false });
  const cancel = f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  assert.deepEqual(f.delays, [1800]);
  await f.runNext();
  assert.deepEqual(f.delays, [1800, 1800]);
  assert.deepEqual(f.imported, ['/requests']);
  cancel();
  assert.equal(f.scheduled.size, 0);
});

test('hover and focus share one pending import and reuse successful imports', async () => {
  let finishImport;
  const f = fixture({ overrides: { '/reports': () => new Promise(resolve => { finishImport = resolve; }) } });
  const hover = f.prefetchRoute('/reports');
  const focus = f.prefetchRoute('/reports');
  assert.equal(hover, focus);
  await flush();
  assert.deepEqual(f.imported, ['/reports']);
  finishImport();
  assert.equal(await hover, true);
  assert.equal(await f.prefetchRoute('/reports'), true);
  assert.deepEqual(f.imported, ['/reports']);
  assert.equal(await f.prefetchRoute('/missing'), false);
  assert.equal(await f.prefetchRoute('__proto__'), false);
});

test('failed imports are retryable without unhandled rejections or a consumed automatic budget', async () => {
  let attempts = 0;
  const f = fixture({ overrides: { '/requests': () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Temporary chunk load failure');
  } } });
  f.prefetchAllCoreRoutes({ user: { role: 'admin' } });
  await f.runNext();
  assert.equal(await f.prefetchRoute('/requests'), true);
  assert.equal(attempts, 2);
  await f.runNext();
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests', '/requests', '/checkin', '/history']);
  assert.equal(f.scheduled.size, 0);
});

test('intent-loaded pages are skipped by automatic prefetch without consuming its budget', async () => {
  const f = fixture();
  f.prefetchAllCoreRoutes({ user: { role: 'employee' }, currentPath: '/checkin' });
  await f.prefetchRoute('/requests');
  await f.runNext();
  await f.runNext();
  assert.deepEqual(f.imported, ['/requests', '/history', '/profile']);
});

test('running without a browser is a safe no-op', async () => {
  const f = createRoutePrefetcher({ getWindow: () => undefined });
  assert.equal(await f.prefetchRoute('/checkin'), false);
  assert.doesNotThrow(() => f.prefetchAllCoreRoutes({ user: { role: 'admin' } })());
});
