import { Cause, Duration, Effect, Schedule, Scope } from 'effect'
import { isPerfEnabled } from '../application/perf-flags'
import type { ChunkCountProvider } from '../application/chunk-count-port'
import type { PerfHudService } from './perf-hud'

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
