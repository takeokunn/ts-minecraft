import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'

test.describe('HUD elements', () => {
  test('#crosshair is visible after game loads', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // #crosshair is dynamically created — waitForReady already ensures it's injected
    const crosshair = page.locator('#crosshair')
    await expect(crosshair).toBeAttached()
    // Verify it's not explicitly hidden
    const isHidden = await page.evaluate(() => {
      const el = document.getElementById('crosshair')
      return el?.style.display === 'none'
    })
    expect(isHidden).toBe(false)
  })

  test('#fps-value updates with numeric content', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    const fps = await game.getFPS()
    expect(fps).toBeGreaterThan(0)
    expect(Number.isFinite(fps)).toBe(true)
  })
})
