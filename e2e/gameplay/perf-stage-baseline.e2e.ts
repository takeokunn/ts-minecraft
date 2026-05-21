import { test, expect } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'

// -----------------------------------------------------------------------------
// Stage-level perf baseline regression test (FR-0.3, Phase 0 measurement infra)
//
// Phase 0 observability work wraps each stage of `frame-handler.ts` with
// `markEffect('stage:NAME', ...)` (see packages/app/application/frame-handler.ts).
// `markEffect` emits a `performance.mark` + `performance.measure` per stage per
// frame, which surfaces in the User Timing API as
// `performance.getEntriesByType('measure')` entries with `name` starting with
// `stage:`.
//
// This test:
//   1. Boots with `?debug=perf` so `markEffect` takes the active path
//      (PERF_ENABLED=true).
//   2. Lets the world settle for 5s (skips boot-time chunk-stream flood).
//   3. Clears accumulated measures, then samples raw measures over a 30s
//      window.
//   4. Aggregates per-stage avg/p50/p99 ms.
//   5. Compares against a JSON baseline at e2e/baselines/stage-perf-baseline.json.
//      - If baseline missing: writes it (initial-create PASS).
//      - If baseline present: each stage `avgMs` must be within +50% of
//        baseline `avgMs`. Anything beyond is flagged as a regression.
//
// SwiftShader is skipped because CPU rasterizer numbers do not correlate with
// real-GPU stage timings; running this under SwiftShader would either pin the
// baseline to unrealistic values or produce constant noise.
//
// All e2e files are decoupled from src/: PerfMeasureEntry / StageStats / the
// baseline schema are re-declared locally rather than imported.
// -----------------------------------------------------------------------------

const POST_READY_SETTLE_MS = 5_000
const SAMPLE_WINDOW_MS = 30_000

// Regression budget: stage avg may grow up to +50% over baseline before fail.
const REGRESSION_AVG_FACTOR = 1.5

// Baseline file location. Tracked in git so regressions are detectable across
// machines / CI; rewritten only when intentionally absent (delete-and-rerun).
// Resolved relative to this file (`import.meta.dirname` is available on
// Node >= 20.11; package.json pins `node >= 22`) so the test does not depend
// on the caller's `process.cwd()`.
const BASELINE_DIR = path.resolve(import.meta.dirname, '..', 'baselines')
const BASELINE_PATH = path.join(BASELINE_DIR, 'stage-perf-baseline.json')

const STAGE_PREFIX = 'stage:'

// Re-declared User Timing measure shape (the parts we use) so this file does
// not depend on lib.dom.d.ts being present in the e2e tsconfig path.
type PerfMeasureEntry = Readonly<{
  name: string
  duration: number
}>

type StageStats = Readonly<{
  avgMs: number
  p50Ms: number
  p99Ms: number
  samples: number
}>

type StagePerfBaseline = Readonly<{
  schemaVersion: 1
  capturedAt: string
  environment: Readonly<{
    swiftshader: boolean
    viewport: string
  }>
  stages: Readonly<Record<string, StageStats>>
}>

const percentile = (sortedAsc: ReadonlyArray<number>, p: number): number => {
  if (sortedAsc.length === 0) return 0
  // Nearest-rank percentile (matches perf-hud.ts convention for p50/p99).
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  )
  return sortedAsc[idx] ?? 0
}

const computeStats = (durations: ReadonlyArray<number>): StageStats => {
  const sorted = [...durations].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, n) => acc + n, 0)
  return {
    avgMs: sorted.length > 0 ? sum / sorted.length : 0,
    p50Ms: percentile(sorted, 50),
    p99Ms: percentile(sorted, 99),
    samples: sorted.length,
  }
}

const aggregateStages = (
  entries: ReadonlyArray<PerfMeasureEntry>,
): Record<string, StageStats> => {
  const grouped = new Map<string, number[]>()
  for (const e of entries) {
    if (!e.name.startsWith(STAGE_PREFIX)) continue
    const arr = grouped.get(e.name) ?? []
    arr.push(e.duration)
    grouped.set(e.name, arr)
  }
  const out: Record<string, StageStats> = {}
  for (const [name, durations] of grouped) {
    out[name] = computeStats(durations)
  }
  return out
}

const readBaseline = async (
  filePath: string,
): Promise<StagePerfBaseline | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as StagePerfBaseline
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

const writeBaseline = async (
  filePath: string,
  baseline: StagePerfBaseline,
): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
}

test('stage perf baseline — regression check (30s window)', async ({ page }) => {
  test.setTimeout(75_000)

  test.skip(
    process.env['PLAYWRIGHT_USE_SWIFTSHADER'] === '1',
    'Stage perf baselines require non-SwiftShader rendering backend',
  )

  // 1. Boot with ?debug=perf so markEffect wraps each stage with measures.
  const game = new GamePage(page)
  const getFatalErrors = attachFatalErrorMonitor(page)

  await game.goto('/?debug=perf')
  await game.waitForReady()

  // 2. Settle out the boot-time chunk-stream flood. First few seconds are
  //    dominated by initial chunk generation/meshing; we want steady state.
  await page.waitForTimeout(POST_READY_SETTLE_MS)

  // 3a. Clear any boot-time measures so the sample window only sees steady
  //     state. clearMeasures() clears the accumulated User Timing entries
  //     without affecting future markEffect() calls.
  await page.evaluate(() => {
    performance.clearMeasures()
  })

  // 3b. Hold for the sample window — the page just renders frames, and each
  //     frame's stages emit `stage:*` measures into the buffer.
  await page.waitForTimeout(SAMPLE_WINDOW_MS)

  // 4. Pull all `stage:*` measures and discard everything else. We pass back
  //    only `name` + `duration` because that's all aggregateStages needs;
  //    the full PerformanceMeasure has non-serializable bits.
  const entries = await page.evaluate((): ReadonlyArray<PerfMeasureEntry> => {
    const all = performance.getEntriesByType('measure')
    return all
      .filter((e) => e.name.startsWith('stage:'))
      .map((e) => ({ name: e.name, duration: e.duration }))
  })

  const stages = aggregateStages(entries)
  const stageNames = Object.keys(stages).sort()

  console.warn(
    `[perf-stage-baseline] sampled ${entries.length} measures across ` +
      `${stageNames.length} stages: ` +
      stageNames
        .map((n) => `${n}=avg${stages[n]!.avgMs.toFixed(2)}ms`)
        .join(' '),
  )

  // 5. Sanity: at least one stage must have produced samples. Otherwise
  //    ?debug=perf was not honored or markEffect was inactive.
  expect(stageNames.length > 0).toBe(true)
  for (const name of stageNames) {
    expect(stages[name]!.samples > 0).toBe(true)
  }

  // 6. Compare against baseline (or write it if first run).
  const existing = await readBaseline(BASELINE_PATH)

  const viewport = page.viewportSize()
  const viewportLabel = viewport ? `${viewport.width}x${viewport.height}` : 'unknown'

  if (existing === null) {
    const fresh: StagePerfBaseline = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      environment: {
        swiftshader: false,
        viewport: viewportLabel,
      },
      stages,
    }
    await writeBaseline(BASELINE_PATH, fresh)
    console.warn(
      `[perf-stage-baseline] wrote new baseline to ${BASELINE_PATH} ` +
        `(${stageNames.length} stages)`,
    )
  } else {
    const regressions: string[] = []
    for (const name of stageNames) {
      const current = stages[name]!
      const prev = existing.stages[name]
      if (!prev) {
        // New stage not in baseline. Don't fail — the baseline was captured
        // on an earlier build and this stage is genuinely new. Operator must
        // delete + regenerate the baseline to register it.
        console.warn(
          `[perf-stage-baseline] new stage not in baseline: ${name} ` +
            `(avg=${current.avgMs.toFixed(2)}ms)`,
        )
        continue
      }
      const cap = prev.avgMs * REGRESSION_AVG_FACTOR
      if (current.avgMs > cap) {
        regressions.push(
          `${name}: avg ${current.avgMs.toFixed(2)}ms > cap ${cap.toFixed(2)}ms ` +
            `(baseline ${prev.avgMs.toFixed(2)}ms, +${REGRESSION_AVG_FACTOR}x)`,
        )
      }
    }
    if (regressions.length > 0) {
      console.warn(
        `[perf-stage-baseline] regressions detected:\n${regressions.join('\n')}`,
      )
    }
    expect(regressions.length).toBe(0)
  }

  expect(getFatalErrors().length).toBe(0)
})
