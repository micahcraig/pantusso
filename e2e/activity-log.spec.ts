import { test, expect, type Page } from '@playwright/test'

async function getSeasonId(page: Page): Promise<string> {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)
  return new URL(page.url()).pathname.split('/')[2]
}

async function openGame(page: Page, seasonId: string, hasText: string): Promise<string> {
  await page.goto(`/seasons/${seasonId}`)
  await page.locator('a.game-row').filter({ hasText }).first().click()
  await page.waitForURL(/\/games\//)
  return new URL(page.url()).pathname.split('/')[2]
}

test('game_added: adding a game appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)

  await page.locator('details').filter({ hasText: '+ Add Game' }).locator('summary').click()
  await page.locator('select[name="opponentId"]').selectOption({ label: 'Diamond Devils' })
  await page.locator('input[name="date"]').fill('2026-06-15')
  await page.locator('input[name="time"]').fill('18:30')
  await page.locator('input[name="location"]').fill('Test Field')
  await page.locator('select[name="homeOrAway"]').selectOption('home')
  await page.getByRole('button', { name: 'Add Game' }).click()

  // Wait for new game row to appear in the schedule
  await expect(page.getByText('Test Field').first()).toBeVisible()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/New game scheduled/)).toBeVisible()
  await expect(page.getByText(/Diamond Devils/).first()).toBeVisible()
})

test('score_recorded: recording a final score appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)
  await openGame(page, seasonId, 'County Crushers')

  await page.getByText('+ Record Final Score').click()
  await page.locator('input[name="ourScore"]').fill('5')
  await page.locator('input[name="opponentScore"]').fill('3')
  await page.getByRole('button', { name: 'Mark as Final' }).click()

  await expect(page.getByText('Final').first()).toBeVisible()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/Score recorded/)).toBeVisible()
  await expect(page.getByText(/County Crushers/).first()).toBeVisible()
})

test('game_cancelled: cancelling a game appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)
  await openGame(page, seasonId, 'Metro Mudhens')

  await page.getByRole('button', { name: 'Cancel Game' }).click()

  await expect(page.getByText('Cancelled').first()).toBeVisible()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/Metro Mudhens/).first()).toBeVisible()
  await expect(page.getByText(/was cancelled/).first()).toBeVisible()
})

test('game_rescheduled: rescheduling a game appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)

  // Both seeds have a scheduled Diamond Devils game (game6). After game_added adds
  // another Diamond Devils game on Jun 15, this is the first scheduled one by date.
  await page.goto(`/seasons/${seasonId}`)
  await page.locator('a.game-row')
    .filter({ hasText: 'Diamond Devils' })
    .filter({ hasText: 'Scheduled' })
    .first()
    .click()
  await page.waitForURL(/\/games\//)
  const gameId = new URL(page.url()).pathname.split('/')[2]

  const res = await page.request.patch(`/api/games/${gameId}`, {
    data: { date: '2026-05-31' },
  })
  expect(res.ok()).toBeTruthy()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/Diamond Devils rescheduled/)).toBeVisible()
  await expect(page.getByText(/May 31/).first()).toBeVisible()
})

test('attendance_updated: admin changing attendance appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)
  // County Crushers (game4) has all players at 'unknown' in both seeds.
  // The score_recorded test already marked it Final, but attendance is still editable via the API.
  const gameId = await openGame(page, seasonId, 'County Crushers')

  // Get the attendance roster and find Marcus Johnson (present in both seeds)
  const attendanceRes = await page.request.get(`/api/games/${gameId}/attendance`)
  const roster = await attendanceRes.json() as Array<{ playerId: string; name: string }>
  const marcus = roster.find(p => p.name === 'Marcus Johnson')
  expect(marcus).toBeDefined()

  const res = await page.request.patch(`/api/games/${gameId}/attendance`, {
    data: { updates: [{ playerId: marcus!.playerId, attendance: 'confirmed' }] },
  })
  expect(res.ok()).toBeTruthy()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/Marcus Johnson/).first()).toBeVisible()
  await expect(page.getByText(/marked as/).first()).toBeVisible()
  await expect(page.getByText(/County Crushers/).first()).toBeVisible()
})

test('availability_updated: player updating availability appears in Season Updates', async ({ page }) => {
  const seasonId = await getSeasonId(page)

  // Get Marcus Johnson's availability token via href (avoids click-interception from
  // the clipboard button rendered inside the roster row link)
  await page.goto('/roster')
  const marcusHref = await page.locator('a').filter({ hasText: 'Marcus Johnson' }).first().getAttribute('href')
  await page.goto(marcusHref!)
  await page.waitForURL(/\/roster\//)
  const code = await page.locator('code').textContent()
  const token = code!.split('/availability/')[1].trim()

  // Riverside Renegades (game3) exists in both seeds; use it as the target game
  const gameId = await openGame(page, seasonId, 'Riverside Renegades')

  const res = await page.request.patch(`/api/availability/${token}`, {
    data: { updates: [{ gameId, attendance: 'maybe' }] },
  })
  expect(res.ok()).toBeTruthy()

  await page.goto(`/seasons/${seasonId}?tab=updates`)
  await expect(page.getByText(/Marcus Johnson/).first()).toBeVisible()
  await expect(page.getByText(/marked themselves as/).first()).toBeVisible()
  await expect(page.getByText(/Riverside Renegades/).first()).toBeVisible()
})
