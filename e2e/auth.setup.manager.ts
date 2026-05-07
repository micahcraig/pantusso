import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/manager.json')

setup('log in as manager and save session', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill('manager@example.com')
  await page.getByLabel('Password').fill('changeme')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/seasons/)

  await page.context().storageState({ path: authFile })
})
