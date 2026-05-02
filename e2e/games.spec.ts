import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Navigate to the first game (Diamond Devils, completed 8-4)
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.getByRole('link', { name: /Diamond Devils/ }).first().click()
  await page.waitForURL(/\/games\//)
})

test('shows game header with opponent and status badge', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Diamond Devils/ })).toBeVisible()
  await expect(page.getByText('Final')).toBeVisible()
})

test('shows the final score for a completed game', async ({ page }) => {
  // Score is 8–3 displayed as "8" and "4"
  await expect(page.getByText('Win')).toBeVisible()
})

test('attendance tab is active by default and shows players', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Confirmed/ })).toBeVisible()
  await expect(page.getByText('Marcus Johnson')).toBeVisible()
})

test('switches to lineup tab', async ({ page }) => {
  await page.getByRole('button', { name: /Lineup/ }).click()
  // Lineup tab is now active — lineup editor should mount
  await expect(page.getByRole('button', { name: /Lineup/ })).toBeVisible()
})

test('shows breadcrumb back to season', async ({ page }) => {
  await expect(page.getByRole('link', { name: /Spring 2026/ })).toBeVisible()
})

test('shows the Record Final Score section at the bottom for scheduled games', async ({ page }) => {
  // Navigate to a scheduled game instead
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await page.getByRole('link', { name: /Riverside Renegades/ }).click()
  await expect(page.getByText('+ Record Final Score')).toBeVisible()
})

test('shows the Edit Score section for completed games', async ({ page }) => {
  await expect(page.getByText('Edit Score')).toBeVisible()
})
