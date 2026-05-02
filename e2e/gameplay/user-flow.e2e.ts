import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function focusCanvas(page: import('@playwright/test').Page): Promise<void> {
  await page.mouse.click(320, 240)
}

test.describe('User flow', () => {
  test('same-route playthrough stays interactive and performant', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)

    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 1_000)
    await focusCanvas(page)

    const fpsSamples: number[] = []

    for (const action of [
      async () => {
        await page.mouse.move(220, 260)
        await page.keyboard.press('w')
        await page.waitForTimeout(900)
      },
      async () => {
        await page.keyboard.press('Escape')
        // ESC now opens the pause menu, not settings overlay directly
        await page.waitForSelector('#pause-menu-backdrop', { state: 'visible', timeout: 5_000 })
        // Resume to close the pause menu
        await page.click('[data-role="resume"]')
        await page.waitForSelector('#pause-menu-backdrop', { state: 'hidden', timeout: 5_000 })
      },
      async () => {
        await page.keyboard.press('e')
        await expect(page.locator('#inventory-overlay')).toBeVisible()
        await page.keyboard.press('e')
        await expect(page.locator('#inventory-overlay')).toBeHidden()
      },
      async () => {
        await page.keyboard.press('1')
        await page.mouse.move(400, 260)
        await page.keyboard.press('d')
        await page.waitForTimeout(900)
      },
    ] as const) {
      await action()
      await page.waitForTimeout(500)
      fpsSamples.push(await game.getFPS())
      await focusCanvas(page)
    }

    const avg = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length

    expect(fpsSamples.length).toBe(4)
    expect(fpsSamples.every((fps) => fps >= 10)).toBe(true)
    expect(avg).toBeGreaterThanOrEqual(15)
    expect(getFatalErrors()).toHaveLength(0)
  })
})
