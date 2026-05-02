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
  await page.getByRole('link', { name: /Diamond Devils/ }).first().click()
  await expect(page).toHaveURL(/\/games\//)
})

test('shows the + Add Game form at the bottom', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await expect(page.getByText('+ Add Game')).toBeVisible()
})
