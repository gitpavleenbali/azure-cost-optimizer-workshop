import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages-browser',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:4398/azure-cost-optimizer-workshop/', trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'node tests/pages-server.mjs', url: 'http://127.0.0.1:4398/azure-cost-optimizer-workshop/', reuseExistingServer: false },
});