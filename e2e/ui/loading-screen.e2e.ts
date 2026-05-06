import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { waitForMainMenu } from '../helpers/wait-helpers'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'

test.describe('Loading screen transition', () => {
  test('keeps loading visible for a minimum duration before gameplay starts', async ({ page }) => {
    test.setTimeout(90_000)
    const getFatalErrors = attachFatalErrorMonitor(page)

    const game = new GamePage(page)
    await game.gotoMainMenuOnly()
    const loading = page.locator('#loading-screen')

    // Deterministic entry: always wait for main menu before starting a session.
    await waitForMainMenu(page, 60_000)
    await page.click('#mm-new-world')
    await page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
    await page.click('#mm-nw-confirm')
    await expect(loading).toBeVisible({ timeout: 30_000 })

    const visibleAt = Date.now()
    await page.waitForTimeout(1_000)
    await expect(loading).toBeVisible()
    await expect(loading).toBeHidden({ timeout: 30_000 })
    const visibleDurationMs = Date.now() - visibleAt

    // session.ts enforces a 2.5s minimum loading duration. We start timing
    // after visibility is observed, so keep CI jitter margin but still catch
    // regressions where the loading screen disappears too early.
    expect(visibleDurationMs >= 1_800).toBe(true)

    await game.waitForReady()
    expect((await game.getFPS()) > 0).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })
})
