import { waitForGameReady, getFpsValue, waitForMainMenu } from '../helpers/wait-helpers'

export class GamePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.addInitScript(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      indexedDB.databases?.().then((dbs) => dbs.forEach((db) => {
        if (db.name) indexedDB.deleteDatabase(db.name)
      }))
    })
    await this.page.goto('/')
    // Navigate through the main menu to start a new game session.
    // All tests that call goto() + waitForReady() require an active session.
    await waitForMainMenu(this.page)
    await this.page.click('#mm-new-world')
    await this.page.waitForSelector('#mm-nw-confirm', { state: 'visible', timeout: 5_000 })
    await this.page.click('#mm-nw-confirm')
  }

  async gotoMainMenuOnly() {
    await this.page.addInitScript(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      indexedDB.databases?.().then((dbs) => dbs.forEach((db) => {
        if (db.name) indexedDB.deleteDatabase(db.name)
      }))
    })
    await this.page.goto('/')
  }

  async openSettings() {
    await this.page.keyboard.press('Escape')
    await this.page.waitForSelector('#pause-menu-backdrop', { state: 'visible', timeout: 5_000 })
    await this.page.click('[data-role="settings"]')
  }

  async waitForReady(timeoutMs = 25_000) {
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
