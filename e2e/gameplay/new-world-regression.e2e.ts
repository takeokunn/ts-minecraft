import { test, expect } from '@playwright/test'
type Page = {
  screenshot: (options: { path: string; fullPage: boolean }) => Promise<unknown>
  evaluate: <T>(fn: (url: string) => Promise<T>, url: string) => Promise<T>
}
import { GamePage } from '../fixtures/game-page'
import { getFpsValue, waitForStableRender } from '../helpers/wait-helpers'

type CanvasStats = {
  avgBrightness: number
  varianceBrightness: number
  nonZeroPixels: number
  avgChroma: number
  vibrantFraction: number
}

const MIN_NIGHT_BRIGHTNESS = 1
const MIN_NIGHT_VARIANCE = 20
const MIN_DAY_BRIGHTNESS = 20
const MIN_DAY_NIGHT_BRIGHTNESS_DELTA = 8
const MIN_DAY_VARIANCE = 30
const MIN_MOB_HORIZONTAL_DISTANCE = 0.1
const STARTUP_FPS_FLOOR = 20
const MIN_DAY_CHROMA = 3
const MIN_DAY_VIBRANT_FRACTION = 0.02

async function measureCanvas(page: Page, screenshotPath: string): Promise<CanvasStats> {
  await page.screenshot({ path: screenshotPath, fullPage: false })

  const fs = await import('node:fs/promises')
  const pngBytes = await fs.readFile(screenshotPath)
  const dataUrl = `data:image/png;base64,${pngBytes.toString('base64')}`

  return page.evaluate(async (url: string) => {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to decode screenshot PNG'))
    })

    const sampleW = 160
    const sampleH = 90
    const off = document.createElement('canvas')
    off.width = sampleW
    off.height = sampleH
    const ctx = off.getContext('2d')
    if (!ctx) throw new Error('Failed to acquire 2D context')
    ctx.drawImage(img, 0, 0, sampleW, sampleH)
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data

    let sum = 0
    let sumSq = 0
    let nonZero = 0
    let sumChroma = 0
    let vibrantPixels = 0
    const pixelCount = sampleW * sampleH
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const brightness = (r + g + b) / 3
      const maxChannel = Math.max(r, g, b)
      const minChannel = Math.min(r, g, b)
      const chroma = maxChannel - minChannel
      sum += brightness
      sumSq += brightness * brightness
      sumChroma += chroma
      if (brightness > 0) nonZero += 1
      if (chroma >= 12) vibrantPixels += 1
    }

    const avg = sum / pixelCount
    const variance = sumSq / pixelCount - avg * avg
    const avgChroma = sumChroma / pixelCount
    const vibrantFraction = vibrantPixels / pixelCount
    return {
      avgBrightness: avg,
      varianceBrightness: variance,
      nonZeroPixels: nonZero,
      avgChroma,
      vibrantFraction,
    }
  }, dataUrl)
}

test.describe('new world regression checks', () => {
  test('waterless generation, night readability, and mob movement are observable', async ({ page }) => {
    test.setTimeout(90_000)

    const game = new GamePage(page)
    await game.goto('/?debug=perf')
    await game.waitForReady()

    const startupFps = await getFpsValue(page)
    expect(startupFps >= STARTUP_FPS_FLOOR).toBe(true)

    await waitForStableRender(page, 2_000)

    const waterCount = await page.evaluate(async () => {
      const w = window as {
        __TS_MINECRAFT_QA__?: {
          getLoadedWaterBlockCount: () => Promise<number>
        }
      }
      return w.__TS_MINECRAFT_QA__?.getLoadedWaterBlockCount() ?? -1
    })
    expect(waterCount).toBeGreaterThanOrEqual(0)
    expect(waterCount).toBe(0)

    await page.evaluate(async () => {
      const w = window as {
        __TS_MINECRAFT_QA__?: {
          setTimeOfDayForQA: (timeOfDay: number) => Promise<void>
        }
      }
      await w.__TS_MINECRAFT_QA__?.setTimeOfDayForQA(0)
    })
    await waitForStableRender(page, 500)

    const nightStats = await measureCanvas(page, 'test-results/new-world-night.png')
    const nonZeroNightFraction = nightStats.nonZeroPixels / (160 * 90)

    expect(nightStats.avgBrightness > MIN_NIGHT_BRIGHTNESS).toBe(true)
    expect(nightStats.varianceBrightness > MIN_NIGHT_VARIANCE).toBe(true)
    expect(nonZeroNightFraction > 0.03).toBe(true)

    await page.evaluate(async () => {
      const w = window as {
        __TS_MINECRAFT_QA__?: {
          setTimeOfDayForQA: (timeOfDay: number) => Promise<void>
        }
      }
      await w.__TS_MINECRAFT_QA__?.setTimeOfDayForQA(0.5)
    })
    await waitForStableRender(page, 500)

    const dayStats = await measureCanvas(page, 'test-results/new-world-day.png')
    expect(dayStats.avgBrightness > MIN_DAY_BRIGHTNESS).toBe(true)
    expect(dayStats.varianceBrightness > MIN_DAY_VARIANCE).toBe(true)
    expect(dayStats.avgBrightness - nightStats.avgBrightness > MIN_DAY_NIGHT_BRIGHTNESS_DELTA).toBe(true)
    expect(dayStats.avgChroma > MIN_DAY_CHROMA).toBe(true)
    expect(dayStats.vibrantFraction > MIN_DAY_VIBRANT_FRACTION).toBe(true)

    await page.evaluate(async () => {
      const w = window as {
        __TS_MINECRAFT_QA__?: {
          spawnLowHealthZombieInFront: () => Promise<void>
        }
      }
      await w.__TS_MINECRAFT_QA__?.spawnLowHealthZombieInFront()
    })
    const movement = await page.evaluate(async () => {
      const w = window as {
        __TS_MINECRAFT_QA__?: {
          getMobMovementSnapshot: (durationMs: number) => Promise<{
            tracked: number
            moved: number
            maxDistance: number
            maxHorizontalDistance: number
            maxVerticalDistance: number
          }>
        }
      }
      return w.__TS_MINECRAFT_QA__?.getMobMovementSnapshot(1_500)
        ?? {
          tracked: 0,
          moved: 0,
          maxDistance: 0,
          maxHorizontalDistance: 0,
          maxVerticalDistance: 0,
        }
    })

    expect(movement.tracked > 0).toBe(true)
    expect(movement.moved > 0).toBe(true)
    expect(movement.maxHorizontalDistance > MIN_MOB_HORIZONTAL_DISTANCE).toBe(true)
  })
})
