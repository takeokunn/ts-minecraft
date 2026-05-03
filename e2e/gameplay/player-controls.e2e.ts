import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { getFpsValue, waitForStableRender } from '../helpers/wait-helpers'

const HOTBAR_START_INDEX = 27

const toKey = (code: string): string => {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'Space') return ' '
  if (code === 'ControlLeft') return 'Control'
  return code
}

async function focusCanvas(page: Page): Promise<void> {
  await page.locator('#game-canvas').click({ position: { x: 320, y: 240 } })
}

async function tapKey(page: Page, code: string): Promise<void> {
  await page.keyboard.press(toKey(code))
}

async function holdKey(page: Page, code: string, ms: number): Promise<void> {
  const key = toKey(code)
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}

async function captureCanvasScreenshot(page: Page): Promise<Buffer> {
  return page.locator('#game-canvas').screenshot()
}

async function openInventory(page: Page): Promise<void> {
  await tapKey(page, 'KeyE')
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById('inventory-overlay')
      return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
    },
    { timeout: 2_000, polling: 100 }
  )
}

async function closeInventory(page: Page): Promise<void> {
  await tapKey(page, 'Escape')
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById('inventory-overlay')
      return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display === 'none'
    },
    { timeout: 2_000, polling: 100 }
  )
}

async function getSelectedInventoryHotbarSlot(page: Page): Promise<number> {
  return page.evaluate(() => {
    const overlay = document.getElementById('inventory-overlay')
    if (!(overlay instanceof HTMLDivElement)) return -1

    const slotElements = Array.from(overlay.querySelectorAll<HTMLDivElement>('[data-slot]'))
    const selected = slotElements.find(
      (el) => getComputedStyle(el).borderTopColor === 'rgb(255, 255, 255)'
    )

    return selected ? Number(selected.dataset['slot'] ?? '-1') : -1
  })
}

test.describe('Player controls', () => {
  test('keyboard movement changes camera view', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 800)

    await focusCanvas(page)

    const movementAttempts: Array<{ code: string; changed: boolean }> = []

    const beforeW = await captureCanvasScreenshot(page)
    await holdKey(page, 'KeyW', 1_000)
    await page.waitForTimeout(250)
    const afterW = await captureCanvasScreenshot(page)

    let moved = !beforeW.equals(afterW)
    movementAttempts.push({ code: 'KeyW', changed: moved })

    if (!moved) {
      for (const code of ['KeyA', 'KeyS', 'KeyD']) {
        const before = await captureCanvasScreenshot(page)
        await holdKey(page, code, 700)
        await page.waitForTimeout(200)
        const after = await captureCanvasScreenshot(page)
        const changed = !before.equals(after)
        movementAttempts.push({ code, changed })
        if (changed) {
          moved = true
          break
        }
      }
    }

    const fpsAfterMove = await getFpsValue(page)

    expect(moved).toBe(true)
    expect(fpsAfterMove > 0).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })

  test('hotbar slot 1 through 3 can be selected by number keys', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    await focusCanvas(page)

    await openInventory(page)
    expect(await getSelectedInventoryHotbarSlot(page)).toBe(HOTBAR_START_INDEX)
    await closeInventory(page)

    const cases = [
      { code: 'Digit1', expectedSlot: HOTBAR_START_INDEX },
      { code: 'Digit2', expectedSlot: HOTBAR_START_INDEX + 1 },
      { code: 'Digit3', expectedSlot: HOTBAR_START_INDEX + 2 },
    ]

    for (const { code, expectedSlot } of cases) {
      await tapKey(page, code)
      await page.waitForTimeout(700)

      await openInventory(page)
      await page.waitForFunction(
        (expected: number) => {
          const overlay = document.getElementById('inventory-overlay')
          if (!(overlay instanceof HTMLDivElement)) return false
          const slots = Array.from(overlay.querySelectorAll<HTMLDivElement>('[data-slot]'))
          const selected = slots.find(
            (el) => getComputedStyle(el).borderTopColor === 'rgb(255, 255, 255)'
          )
          if (!selected) return false
          return Number(selected.dataset['slot'] ?? '-1') === expected
        },
        expectedSlot,
        { timeout: 5_000, polling: 100 }
      )

      expect(await getSelectedInventoryHotbarSlot(page)).toBe(expectedSlot)
      await closeInventory(page)
    }

    expect(getFatalErrors().length).toBe(0)
  })

  test('hotbar slots 4 through 9 can be selected by number keys', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    await focusCanvas(page)

    const cases = [
      { code: 'Digit4', expectedSlot: HOTBAR_START_INDEX + 3 },
      { code: 'Digit5', expectedSlot: HOTBAR_START_INDEX + 4 },
      { code: 'Digit6', expectedSlot: HOTBAR_START_INDEX + 5 },
      { code: 'Digit7', expectedSlot: HOTBAR_START_INDEX + 6 },
      { code: 'Digit8', expectedSlot: HOTBAR_START_INDEX + 7 },
      { code: 'Digit9', expectedSlot: HOTBAR_START_INDEX + 8 },
    ]

    for (const { code, expectedSlot } of cases) {
      await tapKey(page, code)
      await page.waitForTimeout(700)

      await openInventory(page)
      await page.waitForFunction(
        (expected: number) => {
          const overlay = document.getElementById('inventory-overlay')
          if (!(overlay instanceof HTMLDivElement)) return false
          const slots = Array.from(overlay.querySelectorAll<HTMLDivElement>('[data-slot]'))
          const selected = slots.find(
            (el) => getComputedStyle(el).borderTopColor === 'rgb(255, 255, 255)'
          )
          if (!selected) return false
          return Number(selected.dataset['slot'] ?? '-1') === expected
        },
        expectedSlot,
        { timeout: 2_000, polling: 100 }
      )

      expect(await getSelectedInventoryHotbarSlot(page)).toBe(expectedSlot)
      await closeInventory(page)
    }

    expect(getFatalErrors().length).toBe(0)
  })

  test('sprint key (ControlLeft) does not crash game', async ({ page }) => {
    // Sprint is mapped to ControlLeft (KeyMappings.SPRINT).
    // Pointer lock is unavailable in headless mode, so there is no camera-delta to measure.
    // The test verifies the key is processed without crashing the game loop.
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    await focusCanvas(page)

    const fpsBefore = await game.getFPS()
    expect(fpsBefore > 0).toBe(true)

    // Hold ControlLeft (sprint) while moving forward to exercise the sprint code path
    await page.keyboard.down('Control')
    await page.keyboard.down('w')
    await page.waitForTimeout(600)
    await page.keyboard.up('w')
    await page.keyboard.up('Control')
    await page.waitForTimeout(300)

    const fpsSamples: number[] = []
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500)
      fpsSamples.push(await game.getFPS())
    }

    expect(fpsSamples.every((fps) => fps > 0)).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })

  test('jump key (Space) does not crash game', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 500)

    await focusCanvas(page)

    const fpsBeforeJump = await getFpsValue(page)
    expect(fpsBeforeJump > 0).toBe(true)

    await page.keyboard.down(' ')
    await page.waitForTimeout(120)
    await page.keyboard.up(' ')
    await page.waitForTimeout(250)

    const fpsSamples: number[] = []
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(500)
      fpsSamples.push(await getFpsValue(page))
    }

    const averageFpsAfterJump = fpsSamples.reduce((sum, value) => sum + value, 0) / fpsSamples.length

    expect(fpsSamples.every((fps) => fps > 0)).toBe(true)
    expect(averageFpsAfterJump >= 5).toBe(true)
    expect(getFatalErrors().length).toBe(0)
  })
})
