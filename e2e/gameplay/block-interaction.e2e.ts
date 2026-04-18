import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function clickCanvas(page: import('@playwright/test').Page, x: number, y: number): Promise<void> {
  await page.locator('#game-canvas').click({ position: { x, y } })
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

    await clickCanvas(page, 300, 220)
    await page.waitForTimeout(300)

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

    await page.locator('#game-canvas').click({ position: { x: 300, y: 220 }, button: 'right' })
    await page.waitForTimeout(300)

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

    for (let i = 0; i < 3; i++) {
      await clickCanvas(page, 300, 220)
      await page.waitForTimeout(200)
      await page.locator('#game-canvas').click({ position: { x: 300, y: 220 }, button: 'right' })
      await page.waitForTimeout(200)
    }

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

    await clickCanvas(page, 300, 220)
    await page.waitForTimeout(300)

    const settingsOpen = await game.isOverlayOpen('settings-overlay')
    const inventoryOpen = await game.isOverlayOpen('inventory-overlay')
    expect(settingsOpen).toBe(false)
    expect(inventoryOpen).toBe(false)
    expect(getFatalErrors()).toHaveLength(0)
  })
})
