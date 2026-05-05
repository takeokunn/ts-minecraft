import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { waitForMainMenu } from '../helpers/wait-helpers'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'

test.describe('Main Menu', () => {
  let game: GamePage

  test.beforeEach(async ({ page }) => {
    game = new GamePage(page)
    await game.gotoMainMenuOnly()
  })

  test('shows title and the two play buttons', async ({ page }) => {
    await waitForMainMenu(page)

    await expect(page.locator('#mm-new-world')).toBeVisible()
    await expect(page.locator('#mm-load-world')).toBeVisible()
    await expect(page.locator('#mm-settings')).toHaveCount(0)
    await expect(page.locator('#mm-quit')).toHaveCount(0)
  })

  test('New World flow shows world name input and confirm button', async ({ page }) => {
    await waitForMainMenu(page)

    await page.click('#mm-new-world')
    await page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })

    await expect(page.locator('#mm-nw-name')).toBeVisible()
    await expect(page.locator('#mm-nw-cancel')).toBeVisible()

    const modeText = await page.locator('#mm-nw-mode').textContent()
    expect(['Survival', 'Creative'].includes(modeText?.trim() ?? '')).toBe(true)
  })

  test('New World confirm starts game session', async ({ page }) => {
    await waitForMainMenu(page)

    await page.click('#mm-new-world')
    await page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
    await page.click('#mm-nw-confirm')

    await game.waitForReady()

    expect((await game.getFPS()) > 0).toBe(true)
  })

  test('New World cancel returns to main menu root', async ({ page }) => {
    await waitForMainMenu(page)

    await page.click('#mm-new-world')
    await page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
    await page.click('#mm-nw-cancel')

    await expect(page.locator('#mm-new-world')).toBeVisible()
  })

  test('Load World back button returns to root', async ({ page }) => {
    await waitForMainMenu(page)

    await page.click('#mm-load-world')
    await page.waitForSelector('#mm-lw-back', { state: 'visible', timeout: 5_000 })
    await page.click('#mm-lw-back')

    await expect(page.locator('#mm-new-world')).toBeVisible()
  })

  test('no fatal startup errors on menu display', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    await waitForMainMenu(page)

    expect(getFatalErrors().length).toBe(0)
  })
})
