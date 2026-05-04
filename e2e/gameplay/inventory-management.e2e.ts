import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function focusCanvas(page: Page): Promise<void> {
  await page.locator('#game-canvas').click({ position: { x: 320, y: 240 } })
}

async function openInventory(page: Page): Promise<void> {
  await page.keyboard.press('e')
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById('inventory-overlay')
      return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
    },
    undefined,
    { timeout: 2_000, polling: 100 },
  )
}

test.describe('Inventory management', () => {
  test('fresh survival inventory shows an empty hotbar and visible crafting section', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)

    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 700)
    await focusCanvas(page)
    await openInventory(page)

    const inventoryState = await page.evaluate(() => {
      const overlay = document.getElementById('inventory-overlay')
      if (!(overlay instanceof HTMLDivElement)) {
        return { craftingVisible: false, hotbarTitles: [] as string[] }
      }

      const craftingVisible = overlay.textContent?.includes('Crafting') ?? false
      const hotbarTitles = Array.from(overlay.querySelectorAll<HTMLDivElement>('[data-slot]'))
        .filter((el) => Number(el.dataset['slot'] ?? '-1') >= 27)
        .map((el) => el.title)

      return { craftingVisible, hotbarTitles }
    })

    expect(inventoryState.craftingVisible).toBe(true)
    expect(inventoryState.hotbarTitles.length).toBe(9)
    expect(inventoryState.hotbarTitles.every((title: string) => title === '')).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })
})
