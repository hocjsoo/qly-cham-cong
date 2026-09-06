import { defineConfig } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  use: {
    baseURL: 'http://127.0.0.1:4177',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 360, height: 800 },
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177 --strictPort --mode test',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    env: { VITE_API_URL: '/api', VITE_ENABLE_MOCK_API: 'false' },
  },
});
