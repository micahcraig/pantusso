import { test, expect } from '@playwright/test'

// Public page — no auth needed
test.use({ storageState: { cookies: [], origins: [] } })

test('shows not-found for an invalid token', async ({ page }) => {
  const response = await page.goto('/availability/not-a-real-token')
  // Next.js notFound() produces a 404
  expect(response?.status()).toBe(404)
})

test('availability page is accessible without login', async ({ page }) => {
  // Confirm the route itself responds (not redirected to /login)
  const response = await page.goto('/availability/not-a-real-token')
  expect(response?.status()).not.toBe(302)
  expect(response?.url()).not.toContain('/login')
})
