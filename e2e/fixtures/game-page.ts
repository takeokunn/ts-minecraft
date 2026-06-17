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
}
