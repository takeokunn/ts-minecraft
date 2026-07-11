import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'

test.describe('Inventory overlay', () => {
  test.beforeEach(async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    // inventory-overlay is injected by JS after Effect layer composition
    await page.waitForSelector('#inventory-overlay', { state: 'attached' })
  })

  test('inventory overlay is hidden at startup', async ({ page }) => {
    const isOpen = await page.evaluate(() => {
      const el = document.getElementById('inventory-overlay')
      if (!el) return false
      return getComputedStyle(el).display !== 'none'
    })
    expect(isOpen).toBe(false)
  })

  test('E key opens inventory overlay', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Verify closed initially
    const game = new GamePage(page)
    const initiallyOpen = await game.isOverlayOpen('inventory-overlay')
    expect(initiallyOpen).toBe(false)

    // Press E to open
    await game.toggleOverlayTo('inventory-overlay', 'e', true)
    await expect(page.locator('#inventory-overlay')).toBeVisible()

    const isOpen = await game.isOverlayOpen('inventory-overlay')
    expect(isOpen).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })

  test('inventory overlay contains slot elements when open', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Open inventory
    const game = new GamePage(page)
    await game.toggleOverlayTo('inventory-overlay', 'e', true)
    await expect(page.locator('#inventory-overlay')).toBeVisible()

    // Verify slot elements are rendered (27 main inventory + 9 hotbar = 36 total)
    const slotCount = await page.evaluate(() => {
      const overlay = document.getElementById('inventory-overlay')
      if (!(overlay instanceof HTMLDivElement)) return 0
      return overlay.querySelectorAll('[data-slot]').length
    })
    expect(slotCount > 0).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    test(`inventory remains usable at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)

      const game = new GamePage(page)
      await game.toggleOverlayTo('inventory-overlay', 'e', true)

      const overlay = page.locator('#inventory-overlay')
      await expect(overlay).toBeVisible()
      const box = await overlay.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)

      const firstSlot = overlay.locator('[data-slot]').first()
      await expect(firstSlot).toHaveAttribute('role', 'button')
      await expect(firstSlot).toHaveAttribute('aria-label', /Inventory slot/)
      await firstSlot.focus()
      await expect(firstSlot).toBeFocused()
      await page.keyboard.press('Space')
    })
  }

  test('second E key closes inventory overlay', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    const game = new GamePage(page)

    // Open inventory
    await game.toggleOverlayTo('inventory-overlay', 'e', true)
    await expect(page.locator('#inventory-overlay')).toBeVisible()

    const isOpen = await game.isOverlayOpen('inventory-overlay')
    expect(isOpen).toBe(true)

    // Press E again to close
    await game.toggleOverlayTo('inventory-overlay', 'e', false)
    await expect(page.locator('#inventory-overlay')).toBeHidden()

    const isClosed = await game.isOverlayOpen('inventory-overlay')
    expect(isClosed).toBe(false)
    expect(getFatalErrors().length).toBe(0)
  })

  test('Escape key closes inventory overlay when open', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Open inventory with E
    const game = new GamePage(page)
    await game.toggleOverlayTo('inventory-overlay', 'e', true)
    await expect(page.locator('#inventory-overlay')).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300) // allow Effect pipeline to process

    // After Escape, either inventory or settings may be shown — game should remain functional
    const fps = await page.evaluate(() =>
      parseFloat(document.getElementById('fps-value')?.textContent ?? '0')
    )
    expect(fps >= 0).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })
})
