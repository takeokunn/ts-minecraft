
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
 * Empirically (2026-07-05 diagnosis) the PRODUCT Escape->pause path is 100%
 * reliable once the session is warm: 8/8 single Escapes open the menu, with or
 * without a preceding canvas click. The flake is purely a cold-start timing
 * window — a test can press Escape in the ~sub-second gap after waitForReady
 * (FPS>0) but before the pause-menu input path has fully settled, a gap no real
 * human hits. So: (1) a short internal settle before the first press closes
 * that window for every caller (no per-spec waitForTimeout needed), and (2) the
 * loop retries the press until the dialog appears — checking visibility BEFORE
 * each re-press, since Escape on an open pause menu resumes and would undo it.
 */
export async function openPauseMenu(page: Page, timeoutMs = 18_000): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Pause Menu' })
  const deadline = Date.now() + timeoutMs
  // Cold-start settle: let the input stage + pause-menu wiring come up before
  // the first Escape, rather than burning retry rounds on the dead window.
  await dialog.waitFor({ state: 'visible', timeout: 1 }).catch(() => undefined)
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.waitForTimeout(500)
  }
  while (true) {
    if (await dialog.isVisible().catch(() => false)) break
    // Re-focus the game surface on EVERY attempt, not just once up front: a
    // page reload or a preceding overlay transition can leave canvas focus
    // unsettled just long enough that the first Escape is swallowed before the
    // app-level input stage is wired. Re-clicking each round makes the open
    // resilient to that window instead of burning the whole deadline on one
    // dead press. Skipped once the dialog is up so we never click through it.
    await page.locator('#game-canvas').click({ position: { x: 320, y: 240 }, timeout: 1_500 }).catch(() => undefined)
    if (await dialog.isVisible().catch(() => false)) break
    await page.keyboard.press('Escape')
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await dialog.waitFor({ state: 'visible', timeout: Math.min(2_000, remaining) }).catch(() => undefined)
    if (await dialog.isVisible().catch(() => false)) break
    if (Date.now() >= deadline) break
  }
  await waitForPauseMenu(page, Math.max(1_000, deadline - Date.now()))
}

/**
 * Open the multiplayer player-list (roster) via Tab, resilient to the same
 * single-keypress-swallowed-under-load flake as openPauseMenu. Under two
 * concurrent WebGL contexts + a server the render loop drops to ~20 FPS and a
 * lone Tab press can land before the input stage consumes it; re-focus the
 * canvas and re-press each round until the panel is visible.
 */
export async function openPlayerListRoster(page: Page, timeoutMs = 15_000): Promise<void> {
  const roster = page.locator('#multiplayer-player-list-panel')
  const deadline = Date.now() + timeoutMs
  while (true) {
    if (await roster.isVisible().catch(() => false)) break
    await page.locator('#game-canvas').click({ position: { x: 320, y: 240 }, timeout: 1_500 }).catch(() => undefined)
    if (await roster.isVisible().catch(() => false)) break
    await page.keyboard.press('Tab')
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await roster.waitFor({ state: 'visible', timeout: Math.min(2_000, remaining) }).catch(() => undefined)
    if (await roster.isVisible().catch(() => false)) break
    if (Date.now() >= deadline) break
  }
  await roster.waitFor({ state: 'visible', timeout: Math.max(1_000, deadline - Date.now()) })
}
