import { test, expect, type Page } from '@playwright/test'

async function goToGame(page: Page, opponentPattern: RegExp) {
  await page.locator('a.game-row').filter({ hasText: opponentPattern }).first().click()
  await page.waitForURL(/\/games\//)
  await page.waitForLoadState('networkidle')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)
})

// Safety net: if a test fails before restoring the game, put it back so
// later tests (and seasons.spec.ts) start with a clean slate.
test.afterEach(async ({ page }) => {
  try {
    await page.goto('/seasons')
    await page.getByText('Spring 2026').click()
    await page.waitForURL(/\/seasons\//)
    if (await page.locator('a.game-row:visible').filter({ hasText: /Riverside Renegades/ }).count() > 0) return
    await page.getByText(/removed game/).click()
    await page.locator('a.game-row').filter({ hasText: /Riverside Renegades/ }).first().click()
    await page.waitForURL(/\/games\//)
    await page.getByRole('button', { name: 'Restore Game' }).click()
    await page.waitForLoadState('networkidle')
  } catch { /* best-effort */ }
})

test('Remove Game button is visible to admin on a scheduled game', async ({ page }) => {
  await goToGame(page, /Riverside Renegades/)
  await expect(page.getByRole('button', { name: 'Remove Game' })).toBeVisible()
})

test('remove game hides it from schedule and shows it in removed section', async ({ page }) => {
  await goToGame(page, /Riverside Renegades/)
  await page.getByRole('button', { name: 'Remove Game' }).click()
  await page.waitForLoadState('networkidle')

  // Game page shows Removed badge; Remove Game gone; Restore Game appears
  await expect(page.getByText('Removed')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Game' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore Game' })).toBeVisible()

  // Navigate back to season
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await page.waitForURL(/\/seasons\//)

  // Riverside Renegades must not appear as a visible row in the main schedule.
  // The row still exists in the DOM (inside the closed removed-games collapsible),
  // so we check visibility rather than count.
  await expect(
    page.locator('a.game-row:visible').filter({ hasText: /Riverside Renegades/ })
  ).toHaveCount(0)

  // Removed games collapsible should be present and contain Riverside Renegades
  await page.getByText(/removed game/).click()
  await expect(page.locator('a.game-row').filter({ hasText: /Riverside Renegades/ })).toBeVisible()

  // Restore Riverside Renegades so subsequent tests start with clean state
  await page.locator('a.game-row').filter({ hasText: /Riverside Renegades/ }).first().click()
  await page.waitForURL(/\/games\//)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Restore Game' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Remove Game' })).toBeVisible()
})

test('restore game puts it back in the schedule', async ({ page }) => {
  // Remove Riverside Renegades first
  await goToGame(page, /Riverside Renegades/)
  await page.getByRole('button', { name: 'Remove Game' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Restore Game' })).toBeVisible()

  // Restore it
  await page.getByRole('button', { name: 'Restore Game' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Scheduled')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Game' })).toBeVisible()

  // Navigate back to season — Riverside Renegades is back as a visible row
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await page.waitForURL(/\/seasons\//)
  await expect(
    page.locator('a.game-row:visible').filter({ hasText: /Riverside Renegades/ })
  ).toBeVisible()
})
