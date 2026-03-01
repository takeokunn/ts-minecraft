import type { Page } from '@playwright/test'

/**
 * Wait until the game loop is running and dynamic DOM elements have been injected.
 * Uses #fps-value becoming non-zero as the primary signal (requires 0.5s FPS sample window).
 * Then waits for dynamically-injected elements (#crosshair, #settings-overlay).
 */
export async function waitForGameReady(page: Page, timeoutMs = 25_000): Promise<void> {
  // Primary signal: FPS counter is non-zero (game loop running, first sample complete)
  await page.waitForFunction(
    () => {
      const el = document.getElementById('fps-value')
      return el !== null && parseFloat(el.textContent ?? '0') > 0
    },
    { timeout: timeoutMs, polling: 200 }
  )

  // Wait for dynamically-created elements injected after game initialization
  await page.waitForSelector('#crosshair', { timeout: 8_000 })
  await page.waitForSelector('#settings-overlay', { timeout: 8_000 })
}

/**
 * Read the current FPS value from the DOM.
 */
export async function getFpsValue(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.getElementById('fps-value')
    return el ? parseFloat(el.textContent ?? '0') : 0
  })
}

/**
 * Wait additional time after game is ready for stable render state.
 */
export async function waitForStableRender(page: Page, ms = 2_000): Promise<void> {
  await page.waitForTimeout(ms)
}
