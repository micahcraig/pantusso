import { test, expect } from '@playwright/test'

test('shows the roster page with active players', async ({ page }) => {
  await page.goto('/roster')
  await expect(page.getByRole('heading', { name: 'Roster' })).toBeVisible()
  await expect(page.getByText('Marcus Johnson')).toBeVisible()
  await expect(page.getByText('Sarah Chen')).toBeVisible()
})

test('shows the active player count', async ({ page }) => {
  await page.goto('/roster')
  await expect(page.getByText('12 active players')).toBeVisible()
})

test('shows jersey numbers', async ({ page }) => {
  await page.goto('/roster')
  await expect(page.getByText('#7')).toBeVisible()   // Marcus Johnson
  await expect(page.getByText('#12')).toBeVisible()  // Sarah Chen
})

test('navigates to player detail when a row is clicked', async ({ page }) => {
  await page.goto('/roster')
  await page.getByText('Marcus Johnson').click()
  await expect(page).toHaveURL(/\/roster\//)
  await expect(page.getByText('Marcus Johnson')).toBeVisible()
})

test('shows position badges on roster rows', async ({ page }) => {
  await page.goto('/roster')
  // Marcus Johnson plays P and SS
  await expect(page.getByText('P').first()).toBeVisible()
  await expect(page.getByText('SS').first()).toBeVisible()
})

test('shows the + Add Player form at the bottom', async ({ page }) => {
  await page.goto('/roster')
  await expect(page.getByText('+ Add Player')).toBeVisible()
})
