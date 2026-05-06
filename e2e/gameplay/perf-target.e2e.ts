import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { getFpsValue } from '../helpers/wait-helpers'

// -----------------------------------------------------------------------------
// Perf-target regression test (V-1)
//
// Purpose: catch regressions in cold-start steady-state performance under the
// e2e SwiftShader (CPU rasterizer) environment. This is NOT an aspirational
// 60-FPS gate — that target is verified separately on real GPU via Playwright
// MCP screenshots (V-2). Thresholds here are deliberately generous so the test
// is a regression detector, not a flake source.
//
// Cross-references for threshold floors:
//   - e2e/gameplay/fps-threshold.e2e.ts                  : FPS >= 10 on CI / 12 locally
//   - e2e/gameplay/long-run-stability.e2e.ts             : every-sample FPS >= 10
//   - e2e/gameplay/user-flow.e2e.ts                      : every-sample FPS >= 10, avg >= 15
// We use the strictest common floor (10) to avoid false positives on slower CI
// runners while still catching real regressions.
// -----------------------------------------------------------------------------

// Minimum sustained FPS read from #fps-value DOM element (existing rolling
// 0.5s window FPS counter). Matches long-run-stability + user-flow per-sample
// floor; identical to fps-threshold.e2e.ts CI floor.
const FPS_FLOOR = 120

// Generous p99 cap. At 10 FPS the mean frame is 100ms, so p99 must be allowed
// higher; SwiftShader chunk-stream + meshing can spike into the 150-200ms
// range even after settle. 250ms catches >5x degradations without flake.
const P99_MS_CAP = 250

// Largest single-frame gap (in seconds — `samples` from perf-hud are raw dtSecs).
// 500ms = 0.5s catches stalls that would be visible to a player.
const MAX_GAP_SECS = 0.5

// Heap growth budget over the sampling window. SwiftShader builds Three.js
// buffer attributes during chunk streaming; 50MB across a 30s window is the
// budget below which steady-state should always remain.
const HEAP_DELTA_BYTES = 50 * 1024 * 1024

// Wait windows. Total: ~5s boot + 5s settle + 30s sample = ~40s in isolation.
// This test still gets its own timeout budget because full-suite SwiftShader
// runs can add browser-context cleanup/GC overhead after other long gameplay specs.
const POST_READY_SETTLE_MS = 5_000
const PERF_SAMPLE_WINDOW_MS = 30_000

// Perf HUD snapshot contract — matches PerfHudSnapshot in
// src/infrastructure/three/perf-hud.ts. Re-declared here (not imported) so the
// e2e test stays decoupled from src/.
type PerfHudSnapshot = Readonly<{
  fps: number
  p50Ms: number
  p99Ms: number
  drawCalls: number
  chunkCount: number
  workerQueueDepth: number
  samples: ReadonlyArray<number>
}>

test('default settings — perf target window (30s)', async ({ page }) => {
  test.setTimeout(75_000)

  test.skip(
    process.env['PLAYWRIGHT_USE_SWIFTSHADER'] === '1',
    '120 FPS validation requires non-SwiftShader rendering backend',
  )

  // ---------------------------------------------------------------------------
  // 1. Boot with ?debug=perf so PerfHudService takes the active path and
  //    installs window.__perfHud__.snapshot.
  // ---------------------------------------------------------------------------
  const game = new GamePage(page)
  const getFatalErrors = attachFatalErrorMonitor(page)

  await game.goto('/?debug=perf')
  await game.waitForReady()

  // ---------------------------------------------------------------------------
  // 2. Cold-start chunk-stream flood window. The first ~5s after #fps-value
  //    becomes non-zero are dominated by initial chunk generation/meshing —
  //    we wait it out so the sample window measures steady state, not boot.
  // ---------------------------------------------------------------------------
  await page.waitForTimeout(POST_READY_SETTLE_MS)

  // Capture baseline heap. performance.memory is a non-standard Chromium API
  // and may be absent or quantized in headless mode; treat 0 as "unavailable"
  // and skip the heap assertion in that case.
  const heapStart = await page.evaluate(() => {
    const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory
    return mem ? mem.usedJSHeapSize : 0
  })

  // ---------------------------------------------------------------------------
  // 3. Sampling window. We don't need to do anything during this window —
  //    we just let the game render and let perf-hud accumulate frame samples.
  // ---------------------------------------------------------------------------
  await page.waitForTimeout(PERF_SAMPLE_WINDOW_MS)

  // ---------------------------------------------------------------------------
  // 4. Snapshot perf HUD + DOM-fps + heap.
  // ---------------------------------------------------------------------------
  const snap = await page.evaluate((): PerfHudSnapshot | null => {
    const w = window as { __perfHud__?: { snapshot: () => PerfHudSnapshot } }
    return w.__perfHud__ ? w.__perfHud__.snapshot() : null
  })

  const domFps = await getFpsValue(page)

  const heapEnd = await page.evaluate(() => {
    const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory
    return mem ? mem.usedJSHeapSize : 0
  })

  console.warn(
    `[perf-target] domFps=${domFps.toFixed(1)} ` +
      `snap=${JSON.stringify({
        fps: snap?.fps?.toFixed?.(1) ?? null,
        p50Ms: snap?.p50Ms?.toFixed?.(1) ?? null,
        p99Ms: snap?.p99Ms?.toFixed?.(1) ?? null,
        drawCalls: snap?.drawCalls ?? null,
        chunkCount: snap?.chunkCount ?? null,
        workerQueueDepth: snap?.workerQueueDepth ?? null,
        sampleCount: snap?.samples?.length ?? null,
      })} ` +
      `heapDeltaMB=${((heapEnd - heapStart) / (1024 * 1024)).toFixed(2)}`
  )

  // ---------------------------------------------------------------------------
  // 5. Regression assertions.
  // ---------------------------------------------------------------------------
  expect(snap).not.toBeNull()
  expect(snap!.samples.length > 0).toBe(true)

  // FPS floor — read from the existing #fps-value rolling counter.
  expect(domFps >= FPS_FLOOR).toBe(true)

  expect(snap!.p99Ms < P99_MS_CAP).toBe(true)

  const maxGap = Math.max(...snap!.samples)
  expect(maxGap < MAX_GAP_SECS).toBe(true)

  if (heapStart > 0 && heapEnd > 0) {
    expect(heapEnd - heapStart < HEAP_DELTA_BYTES).toBe(true)
  }

  expect(getFatalErrors().length).toBe(0)
})
