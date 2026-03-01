import type { Page } from '@playwright/test'
import { waitForGameReady, getFpsValue } from '../helpers/wait-helpers'

export class GamePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/')
  }

  async waitForReady(timeoutMs = 25_000) {
    await waitForGameReady(this.page, timeoutMs)
  }

  async getFPS(): Promise<number> {
    return getFpsValue(this.page)
  }

  async isOverlayOpen(overlayId: string): Promise<boolean> {
    return this.page.evaluate((id) => {
      const el = document.getElementById(id)
      if (!el) return false
      return el.style.display !== 'none' && el.style.display !== ''
    }, overlayId)
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key)
  }
}
