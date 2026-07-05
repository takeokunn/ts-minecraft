// Frame-performance sampler. Debugging frame hitches used to mean hand-writing
// a requestAnimationFrame delta collector in browser_evaluate every time; this
// bakes that in and also folds in the per-stage `performance.measure` marks the
// `?debug=perf` build emits (frame:render, frame:physics, entity:ai, …), so a
// single call gives both the frame-time distribution AND where the time went.
export type QaStageTiming = {
  readonly name: string
  readonly count: number
  readonly totalMs: number
  readonly avgMs: number
  readonly maxMs: number
}

export type QaFrameStats = {
  readonly windowMs: number
  readonly frames: number
  readonly fps: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly worst: number
  readonly over33ms: number
  readonly over100ms: number
  readonly heapUsedMB: number | null
  // Empty unless the session was loaded with ?debug=perf (markEffect active).
  readonly stages: ReadonlyArray<QaStageTiming>
}

const percentile = (sorted: ReadonlyArray<number>, p: number): number => {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[idx] ?? 0
}

const collectStageTimings = (): ReadonlyArray<QaStageTiming> => {
  /* c8 ignore next -- browser runtime always provides performance */
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return []
  const measures = performance.getEntriesByType('measure')
  const byName = new Map<string, { count: number; total: number; max: number }>()
  for (const m of measures) {
    const bucket = byName.get(m.name) ?? { count: 0, total: 0, max: 0 }
    bucket.count += 1
    bucket.total += m.duration
    bucket.max = Math.max(bucket.max, m.duration)
    byName.set(m.name, bucket)
  }
  return [...byName.entries()]
    .map(([name, b]) => ({
      name,
      count: b.count,
      totalMs: Math.round(b.total * 10) / 10,
      avgMs: Math.round((b.total / b.count) * 100) / 100,
      maxMs: Math.round(b.max * 100) / 100,
    }))
    .sort((a, b) => b.maxMs - a.maxMs)
}

const readHeapMB = (): number | null => {
  const perf = typeof performance !== 'undefined' ? (performance as unknown as { memory?: { usedJSHeapSize: number } }) : undefined
  return perf?.memory ? Math.round(perf.memory.usedJSHeapSize / 1_048_576) : null
}

// Samples frame deltas for `durationMs`, then returns the distribution plus the
// per-stage breakdown accumulated during the window. Clears prior measures at
// the start so the stage numbers reflect only the sampled window.
export const getFrameStatsForQA = (durationMs = 4000): Promise<QaFrameStats> =>
  new Promise((resolve) => {
    /* c8 ignore start -- requires a live requestAnimationFrame loop (browser only) */
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
      resolve({
        windowMs: 0, frames: 0, fps: 0, p50: 0, p95: 0, p99: 0,
        worst: 0, over33ms: 0, over100ms: 0, heapUsedMB: readHeapMB(), stages: [],
      })
      return
    }
    if (typeof performance.clearMeasures === 'function') performance.clearMeasures()
    const times: number[] = []
    let last = performance.now()
    const start = last
    const tick = (now: number): void => {
      times.push(now - last)
      last = now
      if (now - start < durationMs) {
        requestAnimationFrame(tick)
        return
      }
      const sorted = [...times].sort((a, b) => a - b)
      const round1 = (n: number): number => Math.round(n * 10) / 10
      resolve({
        windowMs: Math.round(now - start),
        frames: times.length,
        fps: Math.round(times.length / ((now - start) / 1000)),
        p50: round1(percentile(sorted, 0.5)),
        p95: round1(percentile(sorted, 0.95)),
        p99: round1(percentile(sorted, 0.99)),
        worst: round1(sorted[sorted.length - 1] ?? 0),
        over33ms: times.filter((t) => t > 33).length,
        over100ms: times.filter((t) => t > 100).length,
        heapUsedMB: readHeapMB(),
        stages: collectStageTimings(),
      })
    }
    requestAnimationFrame(tick)
    /* c8 ignore stop */
  })
