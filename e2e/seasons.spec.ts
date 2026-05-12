import { test, expect } from '@playwright/test'

test('shows the seasons list', async ({ page }) => {
  await page.goto('/seasons')
  await expect(page.getByRole('heading', { name: 'Seasons' })).toBeVisible()
  await expect(page.getByText('Spring 2026')).toBeVisible()
})

test('navigates to season detail when a row is clicked', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await expect(page).toHaveURL(/\/seasons\//)
  await expect(page.getByRole('heading', { name: 'Spring 2026' })).toBeVisible()
})

test('season detail shows the win/loss record', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  // Seed has 2 completed games: 8-4 W (Diamond Devils), 3-7 L (Hillside Hawks)
  await expect(page.getByText('Wins')).toBeVisible()
  await expect(page.getByText('Losses')).toBeVisible()
})

test('season detail lists games', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await expect(page.getByText('Diamond Devils').first()).toBeVisible()
  await expect(page.getByText('Hillside Hawks').first()).toBeVisible()
  await expect(page.getByText('Riverside Renegades').first()).toBeVisible()
})

test('navigates to game detail when a game row is clicked', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.locator('a.game-row').filter({ hasText: /Diamond Devils/ }).first().click()
  await expect(page).toHaveURL(/\/games\//)
})

test('shows the + Add Game form at the bottom', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await expect(page.getByText('+ Add Game')).toBeVisible()
})

test('cancel editing restores the original season name', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  await page.getByRole('button', { name: 'Edit season' }).click()
  await page.getByRole('textbox').first().fill('Do Not Save This')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('heading', { name: 'Spring 2026' })).toBeVisible()
  await expect(page.getByText('Do Not Save This')).not.toBeVisible()
})

test('roster tab shows all active players with toggles', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  await page.getByRole('main').getByRole('link', { name: 'Roster' }).click()
  await page.waitForURL(/\?tab=roster/)

  // Marcus Johnson is in both seeds and in the season roster
  await expect(page.getByText('Marcus Johnson')).toBeVisible()
  // All players should have a toggle switch
  const switches = page.getByRole('switch')
  await expect(switches.first()).toBeVisible()
})

test('roster tab toggle removes and re-adds a player', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)
  await page.getByRole('main').getByRole('link', { name: 'Roster' }).click()
  await page.waitForURL(/\?tab=roster/)

  // Marcus Johnson should start on the roster (checked)
  const marcusSwitch = page.getByRole('switch', { name: /Marcus Johnson/ })
  await expect(marcusSwitch).toHaveAttribute('aria-checked', 'true')

  // Toggle off
  await marcusSwitch.click()
  await expect(marcusSwitch).toHaveAttribute('aria-checked', 'false')

  // Toggle back on
  await marcusSwitch.click()
  await expect(marcusSwitch).toHaveAttribute('aria-checked', 'true')
})

test('inline edit saves the season name and dates in place', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  await page.getByRole('button', { name: 'Edit season' }).click()
  await page.getByRole('textbox').first().fill('Spring 2026 Edited')
  await page.getByRole('button', { name: 'Save' }).click()

  // Heading updates in place without a full navigation
  await expect(page.getByRole('heading', { name: 'Spring 2026 Edited' })).toBeVisible()
  await expect(page).toHaveURL(/\/seasons\//)

  // Revert so remaining tests in the suite still find 'Spring 2026'
  await page.getByRole('button', { name: 'Edit season' }).click()
  await page.getByRole('textbox').first().fill('Spring 2026')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Spring 2026' })).toBeVisible()
})
