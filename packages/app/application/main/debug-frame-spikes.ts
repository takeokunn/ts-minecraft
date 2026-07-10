// Frame-spike watchdog. getFrameStatsForQA only COUNTS over-33ms/over-100ms
// frames inside an explicit sampling window; hitches outside a window (or their
// timing/cause) were unobservable. This runs a permanent rAF delta monitor and
// records every spike with a timestamp plus the per-stage performance.measure
// entries that landed during that frame (populated when ?debug=perf enables
// markEffect), so "the game stuttered a minute ago" becomes a queryable fact.
export interface FrameSpikeStage {
  readonly name: string
  readonly durationMs: number
}

export interface FrameSpikeEntry {
  readonly timeMs: number
  readonly deltaMs: number
  readonly stages: ReadonlyArray<FrameSpikeStage>
}

export const FRAME_SPIKE_THRESHOLD_MS = 50
export const MAX_FRAME_SPIKES = 120
const MAX_STAGES_PER_SPIKE = 8

type PerformanceLike = {
  now: () => number
  getEntriesByType?: (type: string) => ReadonlyArray<{ readonly name: string; readonly startTime: number; readonly duration: number }>
}

// Stage measures emitted since the previous frame boundary, worst-first. Uses
// the shared performance measure buffer non-destructively (no clearMeasures —
// getFrameStatsForQA owns clearing) by filtering on startTime.
const collectSpikeStages = (
  perf: PerformanceLike,
  frameStartMs: number,
): ReadonlyArray<FrameSpikeStage> => {
  if (typeof perf.getEntriesByType !== 'function') return []
  return perf
    .getEntriesByType('measure')
    .filter((m) => m.startTime >= frameStartMs)
    .map((m) => ({ name: m.name, durationMs: Math.round(m.duration * 100) / 100 }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, MAX_STAGES_PER_SPIKE)
}

export interface FrameSpikeMonitor {
  readonly getSpikes: () => ReadonlyArray<FrameSpikeEntry>
  readonly clear: () => void
  readonly stop: () => void
}

export const createFrameSpikeMonitor = (
  perf: PerformanceLike,
  requestFrame: (cb: (nowMs: number) => void) => void,
  thresholdMs: number = FRAME_SPIKE_THRESHOLD_MS,
): FrameSpikeMonitor => {
  const spikes: FrameSpikeEntry[] = []
  let last = perf.now()
  let running = true

  const tick = (nowMs: number): void => {
    const delta = nowMs - last
    if (delta > thresholdMs) {
      spikes.push({
        timeMs: Math.round(nowMs),
        deltaMs: Math.round(delta * 10) / 10,
        stages: collectSpikeStages(perf, last),
      })
      if (spikes.length > MAX_FRAME_SPIKES) spikes.splice(0, spikes.length - MAX_FRAME_SPIKES)
    }
    last = nowMs
    if (running) requestFrame(tick)
  }
  requestFrame(tick)

  return {
    getSpikes: () => [...spikes],
    clear: () => {
      spikes.length = 0
    },
    stop: () => {
      running = false
    },
  }
}

// Boot-time singleton, mirrors debug-log-capture: installed once from main.ts
// when running in a browser, read by the QA API.
let globalMonitor: FrameSpikeMonitor | null = null

export const installGlobalFrameSpikeMonitor = (): FrameSpikeMonitor | null => {
  if (globalMonitor !== null) return globalMonitor
  if (typeof performance === 'undefined' || typeof requestAnimationFrame !== 'function') return null
  globalMonitor = createFrameSpikeMonitor(performance, (cb) => requestAnimationFrame(cb))
  return globalMonitor
}

export const getGlobalFrameSpikeMonitor = (): FrameSpikeMonitor | null => globalMonitor
