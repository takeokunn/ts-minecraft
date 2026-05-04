import type { PlaywrightTestArgs } from '@playwright/test'
import { waitForGameReady, getFpsValue, waitForMainMenu } from '../helpers/wait-helpers'

type Page = PlaywrightTestArgs['page']

export class GamePage {
  constructor(readonly page: Page) {}

  async resetBrowserStorage(): Promise<void> {
    await this.page.goto('/e2e-cleanup.html')
    await this.page.evaluate(async () => {
      const deleteIndexedDatabase = (name: string): Promise<void> =>
        new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name)

          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error ?? new Error(`Failed to delete IndexedDB database: ${name}`))
          request.onblocked = () => undefined
        })

      window.localStorage.clear()
      window.sessionStorage.clear()

      const databases = await indexedDB.databases?.() ?? []
      await Promise.all(
        databases.map((database) => database.name ? deleteIndexedDatabase(database.name) : Promise.resolve())
      )
    })
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
    await this.page.keyboard.press('Escape')
    await this.page.waitForSelector('#pause-menu-backdrop', { state: 'visible', timeout: 5_000 })
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
