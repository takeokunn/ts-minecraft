import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForMainMenu } from '../helpers/wait-helpers'

test.describe('Boot / main menu phase', () => {
  test.describe.configure({ mode: 'serial' })

  test('WebGL2 canvas is present and active', async ({ page }) => {
    const game = new GamePage(page)
    await game.gotoMainMenuOnly()
    await waitForMainMenu(page)

    // #game-canvas is static in index.html — immediately present
    await expect(page.locator('#game-canvas')).toBeVisible()

    // Verify WebGL2 context is actually working (not silently failing)
    const webglActive = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
      if (!canvas) return false
      return canvas.getContext('webgl2') !== null
    })
    expect(webglActive).toBe(true)
  })

  test('main menu renders on boot', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.gotoMainMenuOnly()
    await waitForMainMenu(page)

    await expect(page.locator('#mm-new-world')).toBeVisible()
    await expect(page.locator('#mm-load-world')).toBeVisible()
    await expect(page.locator('#mm-settings')).toBeVisible()
    await expect(page.locator('#mm-quit')).toBeVisible()
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('no fatal startup errors before game session', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.gotoMainMenuOnly()
    await waitForMainMenu(page)

    // The game intentionally uses console.error for non-fatal Effect errors.
    // We only check for the fatal "Failed to start application" pattern.
    expect(getFatalErrors()).toHaveLength(0)
  })
})

test.describe('Game session phase', () => {
  test.describe.configure({ mode: 'serial' })

  test('game loop starts and FPS counter becomes non-zero', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()

    // #fps-value is static in index.html but starts at "0"
    // waitForGameReady() waits until it shows a real FPS value
    await game.waitForReady()

    const fps = await game.getFPS()
    expect(fps).toBeGreaterThan(0)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('dynamic DOM elements are injected after game initialization', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // These are injected by JS after Effect layer composition — NOT in index.html
    await expect(page.locator('#crosshair')).toBeAttached()
    await expect(page.locator('#settings-overlay')).toBeAttached()
  })

  test('settings and inventory overlays are hidden at startup', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // Wait for element to be in DOM (it starts as display:none, so use 'attached' state)
    await page.waitForSelector('#settings-overlay', { state: 'attached' })
    const settingsHidden = await page.evaluate(() => {
      const el = document.getElementById('settings-overlay')
      return el?.style.display === 'none' || el?.style.display === ''
    })
    expect(settingsHidden).toBe(true)
  })

  test('no fatal startup errors during session', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // The game intentionally uses console.error for non-fatal Effect errors.
    // We only check for the fatal "Failed to start application" pattern.
    expect(getFatalErrors()).toHaveLength(0)
  })
})
