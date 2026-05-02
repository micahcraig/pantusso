import { test, expect } from '@playwright/test'

test('shows the opponents list', async ({ page }) => {
  await page.goto('/opponents')
  await expect(page.getByRole('heading', { name: 'Opponents' })).toBeVisible()
  await expect(page.getByText('Diamond Devils')).toBeVisible()
  await expect(page.getByText('Hillside Hawks')).toBeVisible()
  await expect(page.getByText('Riverside Renegades')).toBeVisible()
})

test('shows notes snippet for opponents that have notes', async ({ page }) => {
  await page.goto('/opponents')
  await expect(page.locator('summary').filter({ hasText: /Hillside Park/ })).toBeVisible()
})

test('expanding a row reveals the edit form', async ({ page }) => {
  await page.goto('/opponents')
  await page.getByText('Diamond Devils').click()
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
})

test('shows the + Add Opponent form at the bottom', async ({ page }) => {
  await page.goto('/opponents')
  await expect(page.getByText('+ Add Opponent')).toBeVisible()
})
