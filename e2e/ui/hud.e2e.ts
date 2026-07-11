import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'

const narrowViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const

async function expectInsideViewport(
  locator: ReturnType<GamePage['page']['locator']>,
  viewport: (typeof narrowViewports)[number],
): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()

  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
}

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
    expect(fps > 0).toBe(true)
    expect(Number.isFinite(fps)).toBe(true)
  })

  for (const viewport of narrowViewports) {
    test(`HUD remains usable at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)

      const game = new GamePage(page)
      await game.goto()
      await game.waitForReady()

      const crosshair = page.locator('#crosshair')
      await expect(crosshair).toBeVisible()
      const crosshairBox = await crosshair.boundingBox()
      expect(crosshairBox).not.toBeNull()
      expect(crosshairBox!.x + crosshairBox!.width / 2).toBeCloseTo(viewport.width / 2, 0)
      expect(crosshairBox!.y + crosshairBox!.height / 2).toBeCloseTo(viewport.height / 2, 0)

      const survivalHud = page.locator('#survival-hud')
      const health = page.getByLabel('Health', { exact: true })
      const hunger = page.getByLabel('Hunger', { exact: true })

      await expect(survivalHud).toBeVisible()
      await expect(health).toBeVisible()
      await expect(hunger).toBeVisible()
      await expectInsideViewport(survivalHud, viewport)
      await expectInsideViewport(health, viewport)
      await expectInsideViewport(hunger, viewport)

      await expect(health).toHaveAttribute('data-state', /^(normal|warning|critical)$/)
      await expect(hunger).toHaveAttribute('data-state', /^(normal|warning|critical)$/)
      await expect(health.locator('#health-value')).toHaveText(/^\d+$/)
      await expect(health.locator('#health-max')).toHaveText(/^\d+$/)
      await expect(hunger.locator('#hunger-value')).toHaveText(/^\d+$/)
      await expect(hunger.locator('#hunger-max')).toHaveText(/^\d+$/)

      // The hotbar is rendered into the WebGL canvas, so its clipping boundary is the canvas box.
      await expectInsideViewport(page.locator('#game-canvas'), viewport)
    })
  }
})
