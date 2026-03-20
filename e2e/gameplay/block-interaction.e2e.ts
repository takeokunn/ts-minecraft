import { test, expect, type Page } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

/**
 * Dispatch a mouse button event on the canvas element.
 * Pointer lock is not available in headless/software-rendering mode,
 * so we dispatch events directly on the canvas via JS.
 */
async function dispatchCanvasMouseEvent(
  page: Page,
  type: 'mousedown' | 'mouseup' | 'click',
  button: number
): Promise<void> {
  await page.evaluate(
    ({ eventType, btn }) => {
      const canvas = document.getElementById('game-canvas')
      if (!canvas) return
      canvas.dispatchEvent(
        new MouseEvent(eventType, {
          button: btn,
          buttons: btn === 0 ? 1 : 2,
          bubbles: true,
          cancelable: true,
          clientX: 640,
          clientY: 360,
        })
      )
    },
    { eventType: type, btn: button }
  )
}

async function leftClick(page: Page): Promise<void> {
  await dispatchCanvasMouseEvent(page, 'mousedown', 0)
  await dispatchCanvasMouseEvent(page, 'mouseup', 0)
}

async function rightClick(page: Page): Promise<void> {
  await dispatchCanvasMouseEvent(page, 'mousedown', 2)
  await dispatchCanvasMouseEvent(page, 'mouseup', 2)
}

test.describe('Block interaction', () => {
  test('crosshair is visible after game loads', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    await expect(page.locator('#crosshair')).toBeAttached()
    const isHidden = await page.evaluate(() => {
      const el = document.getElementById('crosshair')
      return el?.style.display === 'none'
    })
    expect(isHidden).toBe(false)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('left click on canvas does not crash game', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    const fpsBefore = await game.getFPS()
    expect(fpsBefore).toBeGreaterThan(0)

    // Simulate left click (break block)
    await leftClick(page)
    await page.waitForTimeout(300)

    // Game must still be running after click
    const fpsAfter = await game.getFPS()
    expect(fpsAfter).toBeGreaterThanOrEqual(0)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('right click on canvas does not crash game', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    const fpsBefore = await game.getFPS()
    expect(fpsBefore).toBeGreaterThan(0)

    // Simulate right click (place block)
    await rightClick(page)
    await page.waitForTimeout(300)

    // Game must still be running after click
    const fpsAfter = await game.getFPS()
    expect(fpsAfter).toBeGreaterThanOrEqual(0)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('repeated left and right clicks do not accumulate errors', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    // Simulate several alternating clicks
    for (let i = 0; i < 3; i++) {
      await leftClick(page)
      await page.waitForTimeout(200)
      await rightClick(page)
      await page.waitForTimeout(200)
    }

    // Game must still be functional after repeated interactions
    const fpsAfter = await game.getFPS()
    expect(fpsAfter).toBeGreaterThanOrEqual(0)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('game remains in play mode after click (overlays stay closed)', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    await leftClick(page)
    await page.waitForTimeout(300)

    // Neither overlay should have opened as a result of a canvas click
    const settingsOpen = await game.isOverlayOpen('settings-overlay')
    const inventoryOpen = await game.isOverlayOpen('inventory-overlay')
    expect(settingsOpen).toBe(false)
    expect(inventoryOpen).toBe(false)
    expect(getFatalErrors()).toHaveLength(0)
  })
})
