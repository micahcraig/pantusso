import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:             './e2e',
  fullyParallel:       false, // SQLite dev DB is shared; run serially to avoid conflicts
  forbidOnly:          !!process.env.CI,
  retries:             process.env.CI ? 1 : 0,
  reporter:            [['html', { open: 'never' }]],
  use: {
    baseURL:     'http://localhost:3000',
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command:             'npm run dev',
    url:                 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout:             120_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})
