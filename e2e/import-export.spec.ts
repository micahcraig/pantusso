import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

test('export button is visible on season detail page', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible()
})

test('export downloads a valid JSON file', async ({ page }) => {
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])

  expect(download.suggestedFilename()).toMatch(/\.json$/)

  const downloadPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(downloadPath)
  const contents = fs.readFileSync(downloadPath, 'utf-8')
  const json = JSON.parse(contents)

  expect(json.version).toBe(2)
  expect(json.season.name).toBe('Spring 2026')
  expect(Array.isArray(json.players)).toBe(true)
  expect(json.players.length).toBeGreaterThan(0)
  expect(Array.isArray(json.games)).toBe(true)
  expect(Array.isArray(json.activityLogs)).toBe(true)
})

test('import button is visible on seasons list', async ({ page }) => {
  await page.goto('/seasons')
  await expect(page.getByRole('button', { name: 'Import Season' })).toBeVisible()
})

test('full export then import round-trip creates a new season', async ({ page }) => {
  // Step 1: navigate to Spring 2026 and export
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])

  const downloadPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(downloadPath)
  const exportedJson = fs.readFileSync(downloadPath, 'utf-8')
  const exportedData = JSON.parse(exportedJson)

  // Rename the season so we can tell the new one apart
  exportedData.season.name = 'Imported Season Test'
  const modifiedPath = path.join(os.tmpdir(), 'imported-season-test.json')
  fs.writeFileSync(modifiedPath, JSON.stringify(exportedData))

  // Step 2: import the modified JSON
  await page.goto('/seasons')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(modifiedPath)

  // Should navigate to the new season's detail page
  await page.waitForURL(/\/seasons\//)
  await expect(page.getByRole('heading', { name: 'Imported Season Test' })).toBeVisible()
})

test('imported season contains opponent names from original', async ({ page }) => {
  // Export Spring 2026
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])

  const downloadPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(downloadPath)
  const exportedData = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'))

  // Capture at least one opponent name from the export
  const firstOpponentName = exportedData.games[0]?.opponentName as string | undefined

  exportedData.season.name = 'Opponent Verification Import'
  const testPath = path.join(os.tmpdir(), 'opponent-verification.json')
  fs.writeFileSync(testPath, JSON.stringify(exportedData))

  // Import
  await page.goto('/seasons')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(testPath)
  await page.waitForURL(/\/seasons\//)

  await expect(page.getByRole('heading', { name: 'Opponent Verification Import' })).toBeVisible()

  if (firstOpponentName) {
    await expect(page.getByText(firstOpponentName).first()).toBeVisible()
  }
})

test('importing invalid JSON shows an error', async ({ page }) => {
  await page.goto('/seasons')

  const badPath = path.join(os.tmpdir(), 'bad-import.json')
  fs.writeFileSync(badPath, 'not valid json at all')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(badPath)

  await expect(page.getByText('Failed to read or parse file')).toBeVisible()
})

test('imported season appears in the seasons list', async ({ page }) => {
  // Export and re-import with a distinct name
  await page.goto('/seasons')
  await page.getByText('Spring 2026').click()
  await page.waitForURL(/\/seasons\//)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])

  const downloadPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(downloadPath)
  const data = JSON.parse(fs.readFileSync(downloadPath, 'utf-8'))
  data.season.name = 'List Visibility Import'
  const testPath = path.join(os.tmpdir(), 'list-visibility.json')
  fs.writeFileSync(testPath, JSON.stringify(data))

  await page.goto('/seasons')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(testPath)
  await page.waitForURL(/\/seasons\//)

  // Navigate back to seasons list and confirm it appears
  await page.goto('/seasons')
  await expect(page.getByText('List Visibility Import').first()).toBeVisible()
})
