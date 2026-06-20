import { expect, test } from '@playwright/test'
import { attachFatalErrorMonitor } from './helpers/console-monitor'

test('built app boots without runtime ReferenceError', async ({ page }) => {
  const getFatalErrors = attachFatalErrorMonitor(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
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
    undefined,
    { timeout: 30_000, polling: 200 }
  )

  await expect(page).toHaveTitle('ts-minecraft')
  await expect(page.locator('#fps-counter')).toContainText('FPS:')
  await expect(page.locator('#health-value')).toHaveText('20')
  await expect(page.locator('#health-max')).toHaveText('20')

  expect(getFatalErrors().length).toBe(0)
})
