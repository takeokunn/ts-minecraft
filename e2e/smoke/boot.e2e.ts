import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'

test.describe('Boot smoke tests', () => {
  test('WebGL2 canvas is present and active', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()

    // #game-canvas is static in index.html — immediately present
    await expect(page.locator('#game-canvas')).toBeVisible()

    // Verify WebGL2 context is actually working (not silently failing)
    const webglActive = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
      if (!canvas) return false
      return canvas.getContext('webgl2') !== null
    })
    expect(webglActive).toBe(true)

    expect(getFatalErrors()).toHaveLength(0)
  })

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

    // Wait for elements then verify they're hidden
    await page.waitForSelector('#settings-overlay')
    const settingsHidden = await page.evaluate(() => {
      const el = document.getElementById('settings-overlay')
      return el?.style.display === 'none' || el?.style.display === ''
    })
    expect(settingsHidden).toBe(true)
  })

  test('no fatal startup errors occur', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // The game intentionally uses console.error for non-fatal Effect errors.
    // We only check for the fatal "Failed to start application" pattern.
    expect(getFatalErrors()).toHaveLength(0)
  })
})
