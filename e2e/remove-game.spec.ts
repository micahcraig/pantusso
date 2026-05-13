import { test, expect, type Page } from '@playwright/test'

async function goToGame(page: Page, opponentPattern: RegExp) {
  await page.locator('a.game-row').filter({ hasText: opponentPattern }).first().click()
  await page.waitForURL(/\/games\//)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)
})

test('Remove Game button is visible to admin on a scheduled game', async ({ page }) => {
  await goToGame(page, /County Crushers/)
  await expect(page.getByRole('button', { name: 'Remove Game' })).toBeVisible()
})

test('remove game hides it from schedule and shows it in removed section', async ({ page }) => {
  await goToGame(page, /County Crushers/)
  await page.getByRole('button', { name: 'Remove Game' }).click()

  // Game page shows Removed badge
  await expect(page.getByText('Removed')).toBeVisible()
  // Remove Game button is gone; Restore Game appears
  await expect(page.getByRole('button', { name: 'Remove Game' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore Game' })).toBeVisible()

  // Navigate back to season
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await page.waitForURL(/\/seasons\//)

  // County Crushers must NOT appear in the main schedule list
  const mainList = page.locator('.card').first()
  await expect(
    page.locator('a.game-row').filter({ hasText: /County Crushers/ })
  ).toHaveCount(0)

  // Removed games collapsible should be present and contain County Crushers
  await page.getByText(/removed game/).click()
  await expect(page.getByText('County Crushers')).toBeVisible()
})

test('restore game puts it back in the schedule', async ({ page }) => {
  // First remove it
  await goToGame(page, /County Crushers/)
  await page.getByRole('button', { name: 'Remove Game' }).click()
  await expect(page.getByRole('button', { name: 'Restore Game' })).toBeVisible()

  // Restore it
  await page.getByRole('button', { name: 'Restore Game' }).click()
  await expect(page.getByText('Scheduled')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Game' })).toBeVisible()

  // Navigate back to season — County Crushers is back in main schedule
  await page.getByRole('link', { name: /Spring 2026/ }).click()
  await page.waitForURL(/\/seasons\//)
  await expect(
    page.locator('a.game-row').filter({ hasText: /County Crushers/ })
  ).toBeVisible()
})
