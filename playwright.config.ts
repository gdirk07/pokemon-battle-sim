import { defineConfig, devices } from '@playwright/test';

/**
 * Each worker starts its own backend + fake Streamer.bot on unique ports (see e2e/fixtures.ts),
 * so battle tests run in parallel. The backend serves the built overlay from frontend/dist.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
  },

  // The overlay runs in OBS's browser source (Chromium/CEF), so battles are only exercised in Chromium.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
