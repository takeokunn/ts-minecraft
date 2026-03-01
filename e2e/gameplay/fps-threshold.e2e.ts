import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { waitForStableRender, getFpsValue } from '../helpers/wait-helpers'

// FPS thresholds: lower in CI because SwiftShader software rendering
// on 2-core GitHub Actions ubuntu-latest runners is significantly slower.
const FPS_THRESHOLD = process.env['CI'] ? 15 : 30
const SAMPLE_COUNT = 3
const SAMPLE_INTERVAL_MS = 1_500 // must span multiple 0.5s FPS counter sample windows

test('sustained FPS meets platform threshold', async ({ page }) => {
  const game = new GamePage(page)
  await game.goto()

  // Wait for game to be running before any sampling
  await game.waitForReady()

  // Additional warmup: ensure render is stable (not just initialized)
  await waitForStableRender(page, 2_000)

  // Collect multiple samples across distinct FPS counter sample windows
  const samples: number[] = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    await page.waitForTimeout(SAMPLE_INTERVAL_MS)
    const fps = await getFpsValue(page)
    samples.push(fps)
  }

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length
  console.log(`FPS samples: ${samples.map((s) => s.toFixed(1)).join(', ')} — avg: ${avg.toFixed(1)} (threshold: ${FPS_THRESHOLD})`)

  expect(avg).toBeGreaterThanOrEqual(FPS_THRESHOLD)
})
