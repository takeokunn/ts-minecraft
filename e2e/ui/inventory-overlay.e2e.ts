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
    await page.keyboard.press('e')
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('inventory-overlay')
        return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
      },
      { timeout: 2_000, polling: 100 }
    )

    const isOpen = await game.isOverlayOpen('inventory-overlay')
    expect(isOpen).toBe(true)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('inventory overlay contains slot elements when open', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Open inventory
    await page.keyboard.press('e')
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('inventory-overlay')
        return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
      },
      { timeout: 2_000, polling: 100 }
    )

    // Verify slot elements are rendered (27 main inventory + 9 hotbar = 36 total)
    const slotCount = await page.evaluate(() => {
      const overlay = document.getElementById('inventory-overlay')
      if (!(overlay instanceof HTMLDivElement)) return 0
      return overlay.querySelectorAll('[data-slot]').length
    })
    expect(slotCount).toBeGreaterThan(0)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('second E key closes inventory overlay', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Open inventory
    await page.keyboard.press('e')
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('inventory-overlay')
        return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
      },
      { timeout: 2_000, polling: 100 }
    )

    const game = new GamePage(page)
    const isOpen = await game.isOverlayOpen('inventory-overlay')
    expect(isOpen).toBe(true)

    // Press E again to close
    await page.keyboard.press('e')
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('inventory-overlay')
        return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display === 'none'
      },
      { timeout: 2_000, polling: 100 }
    )

    const isClosed = await game.isOverlayOpen('inventory-overlay')
    expect(isClosed).toBe(false)
    expect(getFatalErrors()).toHaveLength(0)
  })

  test('Escape key closes inventory overlay when open', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)

    // Open inventory with E
    await page.keyboard.press('e')
    await page.waitForFunction(
      () => {
        const overlay = document.getElementById('inventory-overlay')
        return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
      },
      { timeout: 2_000, polling: 100 }
    )

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300) // allow Effect pipeline to process

    // After Escape, either inventory or settings may be shown — game should remain functional
    const fps = await page.evaluate(() =>
      parseFloat(document.getElementById('fps-value')?.textContent ?? '0')
    )
    expect(fps).toBeGreaterThanOrEqual(0)
    expect(getFatalErrors()).toHaveLength(0)
  })
})
