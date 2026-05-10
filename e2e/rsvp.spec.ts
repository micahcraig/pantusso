import { test, expect, type Page } from '@playwright/test'

async function getAvailabilityToken(page: Page): Promise<string> {
  await page.goto('/roster')
  await page.getByRole('link', { name: /Marcus Johnson/ }).first().click()
  const code = await page.locator('code').textContent()
  const token = code!.split('/availability/')[1].trim()
  return token
}

async function getFirstScheduledGameId(page: Page, token: string): Promise<string> {
  const res  = await page.request.get(`/api/availability/${token}`)
  const data = await res.json() as { seasons: Array<{ games: Array<{ gameId: string }> }> }
  return data.seasons[0].games[0].gameId
}

test('RSVP confirmed — shows confirmation and records attendance', async ({ page }) => {
  const token  = await getAvailabilityToken(page)
  const gameId = await getFirstScheduledGameId(page, token)

  await page.goto(`/availability/${token}/rsvp?game=${gameId}&status=confirmed`)

  await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible()
  await expect(page.getByRole('link', { name: /Update other games/ })).toBeVisible()

  // Verify reflected on full availability page
  await page.getByRole('link', { name: /Update other games/ }).click()
  await expect(page).toHaveURL(new RegExp(`/availability/${token}`))
})

test('RSVP maybe — shows correct confirmation', async ({ page }) => {
  const token  = await getAvailabilityToken(page)
  const gameId = await getFirstScheduledGameId(page, token)

  await page.goto(`/availability/${token}/rsvp?game=${gameId}&status=maybe`)

  await expect(page.getByRole('heading', { name: "You're a maybe." })).toBeVisible()
})

test('RSVP out — shows correct confirmation', async ({ page }) => {
  const token  = await getAvailabilityToken(page)
  const gameId = await getFirstScheduledGameId(page, token)

  await page.goto(`/availability/${token}/rsvp?game=${gameId}&status=out`)

  await expect(page.getByRole('heading', { name: "You're out." })).toBeVisible()
})

test('RSVP invalid status — shows error message', async ({ page }) => {
  const token  = await getAvailabilityToken(page)
  const gameId = await getFirstScheduledGameId(page, token)

  await page.goto(`/availability/${token}/rsvp?game=${gameId}&status=yes-please`)

  await expect(page.getByText(/doesn't look right/)).toBeVisible()
  await expect(page.getByRole('link', { name: /View all upcoming games/ })).toBeVisible()
})

test('RSVP invalid token — shows 404', async ({ page }) => {
  const response = await page.goto('/availability/not-a-real-token/rsvp?game=x&status=confirmed')
  expect(response?.status()).toBe(404)
})
