import type { PlaywrightTestArgs } from '@playwright/test'
import { waitForGameReady, getFpsValue, waitForMainMenu, openPauseMenu } from '../helpers/wait-helpers'

type Page = PlaywrightTestArgs['page']
const E2E_ORIGIN = 'http://localhost:5180'

export class GamePage {
  constructor(readonly page: Page) {}

  async resetBrowserStorage(): Promise<void> {
    if (this.page.url() !== 'about:blank') {
      await this.page.goto('about:blank').catch(() => undefined)
    }

    const client = await this.page.context().newCDPSession(this.page)

    try {
      await client.send('Storage.clearDataForOrigin', {
        origin: E2E_ORIGIN,
        storageTypes: 'all',
      })
    } finally {
      await client.detach()
    }
  }

  async goto(url = '/') {
    await this.resetBrowserStorage()
    await this.page.goto(url)
    await this.startNewWorldFromMainMenu()
  }

  async startNewWorldFromMainMenu() {
    // Navigate through the main menu to start a new game session.
    // All tests that call goto() + waitForReady() require an active session.
    await waitForMainMenu(this.page)
    await this.page.click('#mm-new-world')
    await this.page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
    await this.page.click('#mm-nw-confirm')
  }

  async gotoMainMenuOnly(url = '/') {
    await this.resetBrowserStorage()
    await this.page.goto(url)
  }

  async openSettings() {
    await openPauseMenu(this.page)
    await this.page.click('[data-role="settings"]')
  }

  async waitForReady(timeoutMs?: number) {
    await waitForGameReady(this.page, timeoutMs)
  }

  async getFPS(): Promise<number> {
    return getFpsValue(this.page)
  }

  async isOverlayOpen(overlayId: string): Promise<boolean> {
    return this.page.evaluate((id: string) => {
      const el = document.getElementById(id)
      if (!el) return false
      return el.style.display !== 'none' && el.style.display !== ''
    }, overlayId)
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key)
  }

  /**
   * Drive an overlay to a target open/closed state with a toggle key.
   *
   * Under full-suite CPU contention the game loop runs at a fraction of 60 FPS,
   * and a synthetic `keyboard.press` is delivered relative to a frame boundary
   * that the input pipeline consumes non-deterministically: the just-pressed key
   * is sometimes not observed for many slow frames, or a slow frame followed by
   * the next one both toggle it (open then immediately close). Real human-speed
   * input never lands in this window, so robustness lives in the harness rather
   * than the game: re-read the overlay state, and press the toggle only while it
   * is not yet in the desired state. The toggle is idempotent once the overlay
   * has settled, so a redundant press is harmless.
   *
   * Focus is returned to the game canvas before each corrective press. When the
   * overlay opens it moves DOM focus onto a control inside itself; pressing the
   * toggle again against that control is the timing window most prone to a
   * dropped or doubled toggle, so we send the key from the canvas instead.
   */
  async toggleOverlayTo(overlayId: string, key: string, shouldBeOpen: boolean): Promise<void> {
    const attempts = 8
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if ((await this.isOverlayOpen(overlayId)) === shouldBeOpen) return
      await this.page
        .locator('#game-canvas')
        .focus({ timeout: 1_000 })
        .catch(() => undefined)
      await this.page.keyboard.press(key)
      // Poll the overlay's display for several slow frames before re-pressing.
      const settled = await this.page
        .waitForFunction(
          ({ id, open }: { id: string; open: boolean }) => {
            const el = document.getElementById(id)
            const isOpen = el !== null && el.style.display !== 'none' && el.style.display !== ''
            return isOpen === open
          },
          { id: overlayId, open: shouldBeOpen },
          { timeout: 2_000, polling: 50 },
        )
        .then(() => true)
        .catch(() => false)
      if (settled) return
    }
    throw new Error(`Overlay "${overlayId}" did not reach open=${shouldBeOpen} after ${attempts} "${key}" presses`)
  }
}
