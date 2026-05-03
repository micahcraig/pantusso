import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:             './e2e',
  fullyParallel:       false,
  forbidOnly:          !!process.env.CI,
  retries:             process.env.CI ? 1 : 0,
  reporter:            [['html', { open: 'never' }]],
  use: {
    baseURL:    'http://localhost:3001',
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
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
    reuseExistingServer: false,
    timeout:             120_000,
    stdout:              'ignore',
    stderr:              'pipe',
    env: {
      DATABASE_URL:    process.env.DATABASE_URL ?? '',
      NEXTAUTH_SECRET: 'e2e-mysql-test-secret',
      NEXTAUTH_URL:    'http://localhost:3001',
      PORT:            '3001',
    },
  },
})
