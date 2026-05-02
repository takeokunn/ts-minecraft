import { expect, test } from '@playwright/test'

test('built app boots without runtime ReferenceError', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // Wait for the main menu to be interactive before proceeding.
  await page.waitForSelector('#mm-new-world', { state: 'visible', timeout: 10_000 })

  // Navigate through the main menu to start a new game session.
  await page.click('#mm-new-world')
  await page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
  await page.click('#mm-nw-confirm')

  // Wait for FPS to become non-zero, signaling the game loop is running.
  await page.waitForFunction(
    () => {
      const el = document.getElementById('fps-value')
      return el !== null && parseFloat(el.textContent ?? '0') > 0
    },
    { timeout: 30_000, polling: 200 }
  )

  await expect(page).toHaveTitle('ts-minecraft')
  await expect(page.locator('#fps-counter')).toContainText('FPS:')
  await expect(page.locator('#health-display')).toContainText('20/20')

  const runtimeErrors = consoleErrors.filter((message) =>
    message.includes('ReferenceError: Cannot access') ||
    message.includes('TypeError:') ||
    message.includes('SyntaxError:')
  )

  expect(runtimeErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
