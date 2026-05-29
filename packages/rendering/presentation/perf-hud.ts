// Debug-only performance HUD, active only when `?debug=perf` URL param is present.
// Activation gate: ONLY `?debug=perf` — no env var, no settings field.
// Production: every method returns Effect.void immediately (zero runtime cost when disabled).
// e2e contract (test W3): window.__perfHud__.snapshot() → { fps, p50Ms, p99Ms, drawCalls, chunkCount, workerQueueDepth, samples }
// Performance: pre-allocated DOM Text nodes (nodeValue mutation) + Float64Array(120) ring buffer (no allocations on hot path).
import { Array as Arr, Cause, Duration, Effect, MutableRef, Schedule, Scope } from 'effect'
import { isPerfEnabled } from '../application/perf-flags'
import type { ChunkCountProvider } from '../application/chunk-count-port'

// -----------------------------------------------------------------------------
// Snapshot type — stable contract for window.__perfHud__.snapshot()
// -----------------------------------------------------------------------------

export type PerfHudSnapshot = Readonly<{
  fps: number
  p50Ms: number
  p99Ms: number
  drawCalls: number
  chunkCount: number
  workerQueueDepth: number
  samples: ReadonlyArray<number>
}>

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SAMPLE_BUFFER_SIZE = 120 // ~2 seconds at 60 FPS
const DOM_UPDATE_INTERVAL_MS = 250 // 4 Hz

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const isPerfDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  // `window.location.search` is always a string per the WebIDL spec, but we
  // guard defensively to keep the activation gate inert under unusual test
  // harnesses (e.g. jsdom variants that stub location).
  const search = typeof window.location.search === 'string' ? window.location.search : ''
  return new URLSearchParams(search).get('debug') === 'perf'
}

const formatNumber = (n: number, decimals: number): string =>
  Number.isFinite(n) ? n.toFixed(decimals) : '--'

// Compute p50/p99 (in milliseconds) from a populated ring buffer of frame
// durations (seconds). `validLength` is min(filled, capacity) — accounts for
// the warm-up window before the ring has wrapped. Percentiles are
// order-independent, so the circular buffer's chronological scrambling after
// wrap-around is irrelevant: only the populated prefix [0, validLength) is read.
// Exported for unit testing — the rest of the active path needs a DOM/window
// gate that rendering's node-env tests can't provide.
export const computePercentiles = (
  ring: Float64Array,
  scratch: Float64Array,
  validLength: number,
): { p50Ms: number; p99Ms: number } => {
  if (validLength === 0) return { p50Ms: 0, p99Ms: 0 }
  // Copy valid portion to scratch and sort in place.
  for (let i = 0; i < validLength; i++) scratch[i] = ring[i]!
  // Native typed-array sort is in-place and faster than Array.prototype.sort
  // for numeric data — but we must restrict to the populated prefix.
  const view = scratch.subarray(0, validLength)
  view.sort()
  const p50Idx = Math.floor((validLength - 1) * 0.5)
  const p99Idx = Math.floor((validLength - 1) * 0.99)
  return {
    p50Ms: (view[p50Idx] ?? 0) * 1000,
    p99Ms: (view[p99Idx] ?? 0) * 1000,
  }
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export interface PerfHudInterface {
  readonly recordFrame: (dtSecs: number) => Effect.Effect<void, never>
  readonly setWorkerQueueDepth: (n: number) => Effect.Effect<void, never>
  readonly setChunkCount: (n: number) => Effect.Effect<void, never>
  readonly setDrawCalls: (n: number) => Effect.Effect<void, never>
}

export class PerfHudService extends Effect.Service<PerfHudService>()(
  '@minecraft/infrastructure/perf/PerfHudService',
  {
    // `scoped:` is required because the DOM overlay is acquired with
    // `Effect.acquireRelease` — the finalizer removes the `<div id="perf-hud">`
    // and the `window.__perfHud__` global on scope teardown (Vite HMR, test
    // teardown, or main scope close). Switching from `effect:` to `scoped:`
    // surfaces the `Scope.Scope` requirement to consumers (handled by `MainLive`).
    scoped: Effect.gen(function* () {
      const enabled = isPerfDebugEnabled()

      // -------------------------------------------------------------------
      // No-op path (production / debug flag absent).
      // Critical: returns trivially with zero allocation and zero DOM access.
      // -------------------------------------------------------------------
      if (!enabled) {
        const noop: PerfHudInterface = {
          recordFrame: (_dtSecs: number) => Effect.void,
          setWorkerQueueDepth: (_n: number) => Effect.void,
          setChunkCount: (_n: number) => Effect.void,
          setDrawCalls: (_n: number) => Effect.void,
        }
        return noop
      }

      // -------------------------------------------------------------------
      // Active path — `?debug=perf` flag detected.
      // -------------------------------------------------------------------

      // Pre-allocate ring buffer + sorted scratch. Both are fixed size; no
      // allocations on the hot path.
      const ring = new Float64Array(SAMPLE_BUFFER_SIZE)
      const scratch = new Float64Array(SAMPLE_BUFFER_SIZE)
      const writeIndexRef = MutableRef.make(0)
      const filledCountRef = MutableRef.make(0)

      // Live counters — written by setters, read by DOM-update path.
      const drawCallsRef = MutableRef.make(0)
      const chunkCountRef = MutableRef.make(0)
      const workerQueueDepthRef = MutableRef.make(0)

      // Throttle: last DOM update timestamp (ms).
      const lastDomUpdateMsRef = MutableRef.make(0)

      // Live percentile cache — last computed values exposed to snapshot().
      const fpsRef = MutableRef.make(0)
      const p50MsRef = MutableRef.make(0)
      const p99MsRef = MutableRef.make(0)

      // ---------------------------------------------------------------
      // Build DOM overlay (one-time, write-once) inside an
      // `Effect.acquireRelease` so HMR / scope teardown reliably removes
      // the `<div>` and the `window.__perfHud__` global. Without the
      // finalizer, repeated Vite HMR cycles would leak overlays on top of
      // each other.
      // 6 lines: FPS, p50, p99, Calls, Chunks, Queue.
      // Each line's value is a pre-allocated Text node.
      // Position: top-LEFT to avoid overlapping the existing top-right
      // `#fps-counter` element from index.html.
      // ---------------------------------------------------------------
      const { textNodes } = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const overlay = document.createElement('div')
          overlay.id = 'perf-hud'
          overlay.style.cssText = [
            'position: fixed',
            'top: 10px',
            'left: 10px',
            // z-index: above game canvas, below settings overlay (which uses 10000+).
            'z-index: 5000',
            'padding: 8px 10px',
            'background: rgba(0, 0, 0, 0.65)',
            'color: #00ff88',
            'font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            'font-size: 12px',
            'line-height: 1.35',
            'border-radius: 4px',
            'pointer-events: none',
            'user-select: none',
            'min-width: 140px',
            'white-space: pre',
          ].join(';')

          const labels: ReadonlyArray<string> = [
            'FPS:    ',
            'p50:    ',
            'p99:    ',
            'Calls:  ',
            'Chunks: ',
            'Queue:  ',
          ]
          const initialValues: ReadonlyArray<string> = ['0.0', '0.0ms', '0.0ms', '0', '0', '0']

          const nodes: Text[] = []
          for (let i = 0; i < 6; i++) {
            const line = document.createElement('div')
            // Static label — never rewritten.
            line.appendChild(document.createTextNode(labels[i]!))
            // Pre-allocated value text node — only `nodeValue` is mutated.
            const valueNode = document.createTextNode(initialValues[i]!)
            line.appendChild(valueNode)
            overlay.appendChild(line)
            nodes.push(valueNode)
          }

          document.body.appendChild(overlay)
          return { overlay, textNodes: nodes }
        }),
        ({ overlay }) =>
          Effect.sync(() => {
            overlay.remove()
            Reflect.deleteProperty(window as object, '__perfHud__')
          }),
      )

      // ---------------------------------------------------------------
      // Snapshot accessor — exposed via window.__perfHud__.
      // Returns a defensively-copied samples array so callers cannot
      // observe later mutations of the ring buffer.
      // ---------------------------------------------------------------
      const buildSnapshot = (): PerfHudSnapshot => {
        const filled = MutableRef.get(filledCountRef)
        const validLength = Math.min(filled, SAMPLE_BUFFER_SIZE)
        const samples: number[] = Arr.makeBy(validLength, (i) => ring[i]!)
        return {
          fps: MutableRef.get(fpsRef),
          p50Ms: MutableRef.get(p50MsRef),
          p99Ms: MutableRef.get(p99MsRef),
          drawCalls: MutableRef.get(drawCallsRef),
          chunkCount: MutableRef.get(chunkCountRef),
          workerQueueDepth: MutableRef.get(workerQueueDepthRef),
          samples,
        }
      }

      // Install the window-bound accessor. Use Reflect.set to avoid widening
      // the global Window type — same pattern as installQaApi.
      yield* Effect.sync(() => {
        Reflect.set(window as object, '__perfHud__', { snapshot: buildSnapshot })
      })

      // ---------------------------------------------------------------
      // Hot-path methods.
      // ---------------------------------------------------------------

      const recordFrame = (dtSecs: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          if (!Number.isFinite(dtSecs) || dtSecs <= 0) return
          // Write into ring buffer (O(1), no allocation).
          const idx = MutableRef.get(writeIndexRef)
          ring[idx] = dtSecs
          MutableRef.set(writeIndexRef, (idx + 1) % SAMPLE_BUFFER_SIZE)
          MutableRef.update(filledCountRef, (n) => n + 1)

          // Throttle: only recompute percentiles + rewrite DOM at <= 4 Hz.
          const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
          const lastUpdate = MutableRef.get(lastDomUpdateMsRef)
          if (nowMs - lastUpdate < DOM_UPDATE_INTERVAL_MS) return
          MutableRef.set(lastDomUpdateMsRef, nowMs)

          const filled = MutableRef.get(filledCountRef)
          const validLength = Math.min(filled, SAMPLE_BUFFER_SIZE)
          const { p50Ms, p99Ms } = computePercentiles(ring, scratch, validLength)
          // Single-sample FPS estimator: 1 / dtSecs of the most recent frame.
          // Intentionally NOT a rolling mean — the snapshot path stays cheap
          // (no second pass over the ring) and e2e tests assert against
          // `#fps-counter` (rolling 0.5s mean) when they need a smoothed value.
          const fps = dtSecs > 0 ? 1 / dtSecs : 0

          MutableRef.set(fpsRef, fps)
          MutableRef.set(p50MsRef, p50Ms)
          MutableRef.set(p99MsRef, p99Ms)

          // Pre-allocated text node mutations — no innerHTML, no textContent.
          textNodes[0]!.nodeValue = formatNumber(fps, 1)
          textNodes[1]!.nodeValue = `${formatNumber(p50Ms, 1)}ms`
          textNodes[2]!.nodeValue = `${formatNumber(p99Ms, 1)}ms`
          textNodes[3]!.nodeValue = String(MutableRef.get(drawCallsRef))
          textNodes[4]!.nodeValue = String(MutableRef.get(chunkCountRef))
          textNodes[5]!.nodeValue = String(MutableRef.get(workerQueueDepthRef))
        })

      const setWorkerQueueDepth = (n: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          MutableRef.set(workerQueueDepthRef, n)
        })

      const setChunkCount = (n: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          MutableRef.set(chunkCountRef, n)
        })

      const setDrawCalls = (n: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          MutableRef.set(drawCallsRef, n)
        })

      const impl: PerfHudInterface = {
        recordFrame,
        setWorkerQueueDepth,
        setChunkCount,
        setDrawCalls,
      }
      return impl
    }),
  },
) {}

// -----------------------------------------------------------------------------
// Counter installation helper
// -----------------------------------------------------------------------------

// Forks a 4 Hz daemon polling chunk count + worker queue depth into the perf HUD.
// Gated on isPerfEnabled(): zero-cost no-op if `?debug=perf` absent.
// queueDepthSource is caller-supplied to avoid hard dependency on the worker pool.
export const installPerfHudCounters = (
  perfHud: PerfHudService,
  chunkManager: ChunkCountProvider,
  queueDepthSource: () => number,
): Effect.Effect<void, never, Scope.Scope> => {
  if (!isPerfEnabled()) return Effect.void
  return Effect.forkDaemon(
    Effect.repeat(
      Effect.gen(function* () {
        const loaded = yield* chunkManager.getLoadedChunks()
        yield* perfHud.setChunkCount(loaded.length)
        yield* perfHud.setWorkerQueueDepth(queueDepthSource())
      }).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`perf-hud daemon failed: ${Cause.pretty(cause)}`),
        ),
      ),
      Schedule.spaced(Duration.millis(250)),
    ),
  ).pipe(Effect.asVoid)
}
