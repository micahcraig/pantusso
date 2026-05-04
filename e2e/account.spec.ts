import { test, expect } from '@playwright/test'

test('account page is reachable via the nav user link', async ({ page }) => {
  await page.goto('/seasons')
  await page.locator('a[href="/account"]').click()
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible()
})

test('shows the change password form', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible()
  await expect(page.getByLabel('Current password')).toBeVisible()
  await expect(page.getByLabel('New password')).toBeVisible()
  await expect(page.getByLabel('Confirm new password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
})

test('shows an error for an incorrect current password', async ({ page }) => {
  await page.goto('/account')
  await page.getByLabel('Current password').fill('notmypassword')
  await page.getByLabel('New password').fill('newpassword123')
  await page.getByLabel('Confirm new password').fill('newpassword123')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Current password is incorrect')).toBeVisible()
})

test('shows an error when new passwords do not match', async ({ page }) => {
  await page.goto('/account')
  await page.getByLabel('Current password').fill('changeme')
  await page.getByLabel('New password').fill('newpassword123')
  await page.getByLabel('Confirm new password').fill('differentpass')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('New passwords do not match')).toBeVisible()
})

test('changes password successfully then resets it', async ({ page }) => {
  await page.goto('/account')

  // Change to a temporary password
  await page.getByLabel('Current password').fill('changeme')
  await page.getByLabel('New password').fill('temporary123')
  await page.getByLabel('Confirm new password').fill('temporary123')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password updated successfully')).toBeVisible()

  // Immediately reset back so other tests are unaffected
  await page.getByLabel('Current password').fill('temporary123')
  await page.getByLabel('New password').fill('changeme')
  await page.getByLabel('Confirm new password').fill('changeme')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password updated successfully')).toBeVisible()
})
