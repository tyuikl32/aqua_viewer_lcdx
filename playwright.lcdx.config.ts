import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/lcdx-regression',
  outputDir: './test-results/lcdx-regression',
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:5187',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node scripts/serve-lcdx-regression.mjs',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
