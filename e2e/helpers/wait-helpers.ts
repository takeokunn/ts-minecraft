
import type { PlaywrightTestArgs } from '@playwright/test'

type Page = PlaywrightTestArgs['page']

/**
 * Wait until the game loop is running and dynamic DOM elements have been injected.
 * Uses #fps-value becoming non-zero as the primary signal.
 * Then waits for dynamically-injected elements (#crosshair, #settings-overlay).
 */
export async function waitForGameReady(page: Page, timeoutMs = 45_000): Promise<void> {
  // Primary signal: FPS counter is non-zero (game loop running, first sample complete).
  await page.waitForFunction(
    () => {
      const el = document.getElementById('fps-value')
      return el !== null && parseFloat(el.textContent ?? '0') > 0
    },
    undefined,
    { timeout: timeoutMs, polling: 200 }
  )

  // Wait for dynamically-created elements injected after game initialization.
  // Use state:'attached' because #settings-overlay is intentionally display:none at startup.
  const uiTimeoutMs = Math.min(timeoutMs, 30_000)
  await page.waitForSelector('#crosshair', { state: 'attached', timeout: uiTimeoutMs })
  await page.waitForSelector('#settings-overlay', { state: 'attached', timeout: uiTimeoutMs })

  // The loading screen can remain attached while fading out; wait until it no longer
  // intercepts pointer events before tests click in-session controls such as Settings.
  await page.waitForFunction(
    () => {
      const loading = document.getElementById('loading-screen')
      if (loading === null) return true
      const style = window.getComputedStyle(loading)
      return style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none'
    },
    undefined,
    { timeout: uiTimeoutMs, polling: 100 }
  )
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

/**
 * Wait until the main menu is rendered and interactive.
 * Uses #mm-new-world visibility as the signal.
 */
export async function waitForMainMenu(page: Page, timeoutMs = 60_000): Promise<void> {
  await page.waitForSelector('#mm-new-world', { state: 'visible', timeout: timeoutMs })
}

/**
 * Wait until the in-session pause menu backdrop is visible.
 */
export async function waitForPauseMenu(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.getByRole('dialog', { name: 'Pause Menu' }).waitFor({ state: 'visible', timeout: timeoutMs })
  await page.locator('[data-role="resume"]').waitFor({ state: 'visible', timeout: timeoutMs })
}

/**
 * Focus the game surface before sending Escape so the app-level input stage
 * receives the key even after a previous test left focus on a menu control.
 *
 * A single Escape can be swallowed when the canvas click's focus/pointer-lock
 * handling races the key event (observed as a rare flake in multiplayer
 * connect flows), so retry the press until the dialog appears — checking
 * visibility BEFORE each re-press, because Escape on an open pause menu
 * resumes the game and would undo a successful open.
 */
export async function openPauseMenu(page: Page, timeoutMs = 10_000): Promise<void> {
  await page.locator('#game-canvas').click({ position: { x: 320, y: 240 }, timeout: 2_000 }).catch(() => undefined)
  const dialog = page.getByRole('dialog', { name: 'Pause Menu' })
  const deadline = Date.now() + timeoutMs
  while (true) {
    if (await dialog.isVisible().catch(() => false)) break
    await page.keyboard.press('Escape')
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await dialog.waitFor({ state: 'visible', timeout: Math.min(2_500, remaining) }).catch(() => undefined)
    if (await dialog.isVisible().catch(() => false)) break
    if (Date.now() >= deadline) break
  }
  await waitForPauseMenu(page, Math.max(1_000, deadline - Date.now()))
}
