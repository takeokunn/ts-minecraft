import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function focusCanvas(page: Page): Promise<void> {
  await page.mouse.click(320, 240)
}

test.describe('Long-run stability', () => {
  test('sustained mixed gameplay stays interactive and performant', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)

    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 1_000)
    await focusCanvas(page)

    const actions = [
      async () => {
        await page.keyboard.press('w')
        await page.waitForTimeout(900)
      },
      async () => {
        await page.keyboard.press('Control')
        await page.keyboard.press('w')
        await page.waitForTimeout(700)
      },
      async () => {
        await page.keyboard.press(' ')
        await page.waitForTimeout(250)
      },
      async () => {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(150)
      },
      async () => {
        await page.keyboard.press('e')
        await page.waitForTimeout(150)
        await page.keyboard.press('e')
        await page.waitForTimeout(150)
      },
      async () => {
        await page.keyboard.press('1')
        await page.waitForTimeout(150)
        await page.keyboard.press('2')
        await page.waitForTimeout(150)
        await page.keyboard.press('3')
      },
    ] as const

    const fpsSamples: number[] = []

    for (let cycle = 0; cycle < 3; cycle++) {
      for (const action of actions) {
        await focusCanvas(page)
        await action()
        await page.waitForTimeout(350)
        fpsSamples.push(await game.getFPS())
      }
    }

    const averageFps = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length

    expect(fpsSamples.length).toBe(actions.length * 3)
    expect(fpsSamples.every((fps) => fps >= 10)).toBe(true)
    expect(averageFps >= 15).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })
})
