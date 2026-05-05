import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:             './e2e',
  globalSetup:         './e2e/global-setup.ts',
  fullyParallel:       false,
  workers:             1,    // SQLite can't handle concurrent writes across spec files
  forbidOnly:          !!process.env.CI,
  retries:             process.env.CI ? 1 : 0,
  reporter:            [['html', { open: 'never' }]],
  use: {
    baseURL:     'http://localhost:3001',
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
    url:                 'http://localhost:3001/login',
    // Use a dedicated port so the test server never shares state with the
    // dev server (port 3000), and test data in test.db stays isolated.
    env: {
      PORT:          '3001',
      DATABASE_URL:  'sqlite:./test.db',
      NEXTAUTH_URL:  'http://localhost:3001',
    },
    reuseExistingServer: !process.env.CI,
    timeout:             120_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})
