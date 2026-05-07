import { test, expect } from '@playwright/test'

// These tests use a fresh context — no stored auth state
test.use({ storageState: { cookies: [], origins: [] } })

test('redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/seasons')
  await expect(page).toHaveURL(/\/login/)
})

test('shows an error for invalid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('wrong@example.com')
  await page.getByLabel('Password').fill('badpassword')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid email or password.')).toBeVisible()
})

test('logs in successfully and lands on /seasons', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password').fill('changeme')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/seasons/)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Seasons' })).toBeVisible()
})

test('signs out and redirects to /login', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password').fill('changeme')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/seasons/)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
})
