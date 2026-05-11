import { test, expect, type Page } from '@playwright/test'

async function goToGame(page: Page, opponentPattern: RegExp) {
  await page
    .locator('a.game-row')
    .filter({ hasText: opponentPattern })
    .first()
    .click()
  await page.waitForURL(/\/games\//)
}

test.beforeEach(async ({ page }) => {
  // Navigate to the first game (Diamond Devils, completed 8-4)
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await goToGame(page, /Diamond Devils/)
})

test('shows game header with opponent and status badge', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Diamond Devils/ })).toBeVisible()
  await expect(page.getByText('Final')).toBeVisible()
})

test('shows the final score for a completed game', async ({ page }) => {
  await expect(page.getByText('Win')).toBeVisible()
})

test('attendance tab is active by default and shows players', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Confirmed/ })).toBeVisible()
  await expect(page.getByText('Marcus Johnson')).toBeVisible()
})

test('switches to lineup tab', async ({ page }) => {
  await page.getByRole('button', { name: /Lineup/ }).click()
  await expect(page.getByRole('button', { name: /Lineup/ })).toBeVisible()
})

test('shows breadcrumb back to season', async ({ page }) => {
  await expect(page.getByRole('link', { name: /Spring 2026/ })).toBeVisible()
})

test('shows the Record Final Score section at the bottom for scheduled games', async ({ page }) => {
  // Navigate to a scheduled game instead
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await goToGame(page, /Riverside Renegades/)
  await expect(page.getByText('+ Record Final Score')).toBeVisible()
})

test('shows the Edit Score section for completed games', async ({ page }) => {
  await expect(page.getByText('Edit Score')).toBeVisible()
})
