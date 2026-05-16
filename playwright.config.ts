import { defineConfig, devices } from '@playwright/test'

// Tests that exercise admin-only features (season import/export, user management, remove game).
const ADMIN_SPECS = ['**/import-export.spec.ts', '**/remove-game.spec.ts']

export default defineConfig({
  testDir:             './e2e',
  globalSetup:         './e2e/global-setup.ts',
  fullyParallel:       false,
  workers:             1,    // SQLite can't handle concurrent writes across spec files
  forbidOnly:          !!process.env.CI,
  retries:             process.env.CI ? 1 : 0,
  timeout:             45_000,
  expect:              { timeout: 15_000 },
  reporter:            [['html', { open: 'never' }]],
  use: {
    baseURL:     'http://localhost:3001',
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
  },
  projects: [
    // ── Auth setup ────────────────────────────────────────────────────────────
    {
      name:      'setup-admin',
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name:      'setup-manager',
      testMatch: /auth\.setup\.manager\.ts$/,
    },

    // ── Manager project — most tests ──────────────────────────────────────────
    // Uses a manager (non-admin) account to ensure pages work for the common role.
    {
      name: 'chromium-manager',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/manager.json',
      },
      dependencies: ['setup-manager'],
      testIgnore:   ADMIN_SPECS,
    },

    // ── Admin project — admin-only flows ─────────────────────────────────────
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup-admin'],
      testMatch: ADMIN_SPECS,
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
    reuseExistingServer: false,
    timeout:             120_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})
