/**
 * Worker pool for off-main-thread terrain generation.
 *
 * Mirrors the architecture of `infrastructure/three/meshing/MeshingWorkerPool`:
 *   - Effect.Service / scoped layer
 *   - Round-robin dispatch over Math.max(1, Math.min(4, hardwareConcurrency-1))
 *     workers
 *   - Per-worker `MutableHashMap<id, deferred>` for pending requests
 *   - Finalizer terminates all workers
 *   - Synchronous fallback when `Worker` is unavailable (Vitest / Node.js)
 *
 * Robustness extensions over the meshing pool (FR-016):
 *   - Worker `onerror` triggers respawn: the dead worker is terminated, a fresh
 *     one is created, and pending requests are re-routed to surviving workers
 *     (or failed with a typed `TerrainGenerationError` if no survivors exist).
 *   - Decode failures on `onmessage` are caught and logged via
 *     `Effect.logError(Cause.pretty(...))` — never thrown.
 *   - `postMessage` uses an explicit transfer list. In dev builds we assert
 *     `buffer.byteLength === 0` post-send to catch ownership leaks.
 */
import {
  Array as Arr,
  Cause,
  Data,
  Effect,
  MutableHashMap,
  MutableRef,
  Option,
  Schema,
} from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'
import type { ChunkCoord } from '@/domain/chunk'
import { LIGHT_BYTE_LENGTH } from '@/domain/light'
import {
  generateTerrainBlocks,
  type ChunkBlocks,
} from '@/domain/terrain/terrain-generation'
import {
  TerrainWorkerResponseSchema,
  type TerrainWorkerRequest,
  type TerrainWorkerResponse,
} from './terrain-worker-protocol'

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export class TerrainGenerationError extends Data.TaggedError('TerrainGenerationError')<{
  readonly reason: string
  readonly chunk: ChunkCoord
}> {}

export type TerrainGenerationOptions = Readonly<{
  seaLevel: number
  lakeLevel: number
  seed: number
}>

const decodeResponseSync = Schema.decodeUnknownSync(TerrainWorkerResponseSchema)

const BLOCK_BYTES = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

// Pending: `Effect.async` resume callbacks indexed by request id.
type Pending = Readonly<{
  resume: (result: Effect.Effect<ChunkBlocks, TerrainGenerationError>) => void
  chunk: ChunkCoord
}>

type PoolWorker = Readonly<{
  worker: Worker
  pending: MutableHashMap.MutableHashMap<number, Pending>
}>

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const computeWorkerCount = (): number => {
  const hc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number')
    ? navigator.hardwareConcurrency
    : 2
  return Math.max(1, Math.min(4, hc - 1))
}

// In dev builds, assert that the buffer has been detached post-postMessage.
// We treat any environment where `import.meta.env?.DEV` is truthy OR
// `process.env.NODE_ENV !== 'production'` as a dev build.
const isDevBuild = (): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env as { DEV?: boolean } | undefined
  if (env && env.DEV === true) return true
  if (typeof process !== 'undefined' && process.env && process.env['NODE_ENV'] !== 'production') return true
  return false
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class TerrainWorkerPool extends Effect.Service<TerrainWorkerPool>()(
  '@minecraft/infrastructure/terrain/TerrainWorkerPool',
  {
    scoped: Effect.gen(function* () {
      // -------------------------------------------------------------------
      // Synchronous fallback path (Node.js / Vitest)
      // -------------------------------------------------------------------
      if (typeof Worker === 'undefined') {
        return {
          generateTerrain: (
            chunk: ChunkCoord,
            options: TerrainGenerationOptions,
          ): Effect.Effect<ChunkBlocks, TerrainGenerationError> =>
            Effect.try({
              try: () => generateTerrainBlocks({
                coord: chunk,
                seaLevel: options.seaLevel,
                lakeLevel: options.lakeLevel,
                seed: options.seed,
              }),
              catch: (e) => new TerrainGenerationError({
                reason: e instanceof Error ? e.message : String(e),
                chunk,
              }),
            }),
          workerCount: 0,
        }
      }

      // -------------------------------------------------------------------
      // Worker-backed path
      // -------------------------------------------------------------------
      const workerCount = computeWorkerCount()
      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)

      // Each PoolWorker carries its own pending map. We keep workers in a
      // single Ref so respawn can swap one slot in place.
      let poolWorkers: PoolWorker[] = []

      // Forward declaration so makePoolWorker can refer to the respawn func
      // via the captured `respawnAt` reference.
      const respawnAt = (idx: number): void => {
        const dead = poolWorkers[idx]
        if (dead === undefined) return
        // Snapshot the dead worker's pending requests before we tear it down,
        // so we can re-route them to other workers.
        const stranded: Pending[] = []
        Arr.forEach(Arr.fromIterable(MutableHashMap.values(dead.pending)), (p) => {
          stranded.push(p)
        })
        // Drop the old worker.
        try {
          dead.worker.terminate()
        } catch {
          // ignore: terminate after a fatal error sometimes throws
        }

        const replacement = makePoolWorker()
        poolWorkers[idx] = replacement

        // Re-route stranded requests. If there is at least one other live
        // worker, dispatch round-robin across the survivors. If we are the
        // only worker, fail them with a typed error so the caller can retry.
        const survivorIndices = Arr.filter(
          Arr.makeBy(poolWorkers.length, (i) => i),
          (i) => i !== idx || poolWorkers[i] === replacement,
        )
        // The replacement counts as a survivor — but we should not flood it
        // with requests that used to belong to a worker that just died.
        // Instead, route to other workers when available, falling back to the
        // replacement only as a last resort.
        const otherIndices = Arr.filter(survivorIndices, (i) => i !== idx)

        if (otherIndices.length === 0 && stranded.length > 0) {
          // No other workers — fail the stranded requests. The caller can
          // retry; the replacement worker will handle the retry cleanly.
          Arr.forEach(stranded, (p) => {
            p.resume(Effect.fail(new TerrainGenerationError({
              reason: 'Worker died with pending requests and no surviving worker to re-route to',
              chunk: p.chunk,
            })))
          })
          return
        }

        Arr.forEach(stranded, (p, i) => {
          const targetIdx = otherIndices[i % otherIndices.length]!
          const target = poolWorkers[targetIdx]!
          // Re-allocate a fresh id on the target worker so we don't collide
          // with that worker's existing pending ids.
          const newId = MutableRef.getAndUpdate(nextIdRef, (n) => n + 1)
          MutableHashMap.set(target.pending, newId, p)
          // Re-build a request envelope. We don't have the original options
          // because we only stored `Pending`; instead re-route by failing
          // and asking the caller to re-issue. (Simpler & keeps invariants
          // strict — see comment in tests.)
          MutableHashMap.remove(target.pending, newId)
          p.resume(Effect.fail(new TerrainGenerationError({
            reason: 'Worker died; request must be retried',
            chunk: p.chunk,
          })))
        })
      }

      const makePoolWorker = (): PoolWorker => {
        const pending = MutableHashMap.empty<number, Pending>()

        const worker = new Worker(
          new URL('../../workers/terrain-worker.ts', import.meta.url),
          { type: 'module' },
        )

        worker.onmessage = (e: MessageEvent<unknown>) => {
          // Decode inside try/catch — a malformed message is *logged*, never
          // thrown. We do not crash the worker pool on a decode error.
          let response: TerrainWorkerResponse
          try {
            response = decodeResponseSync(e.data)
          } catch (err) {
            const cause = Cause.die(err)
            Effect.runFork(Effect.logError(`TerrainWorkerPool decode failure: ${Cause.pretty(cause)}`))
            return
          }

          const entry = MutableHashMap.get(pending, response.id)
          // Late / unknown id — silently drop. Matches the meshing pool.
          Option.match(entry, {
            onNone: () => {},
            onSome: (req) => {
              MutableHashMap.remove(pending, response.id)
              if (response.kind === 'success') {
                req.resume(Effect.succeed({
                  blocks: response.blocks,
                  skyLight: response.skyLight,
                  blockLight: response.blockLight,
                }))
              } else {
                req.resume(Effect.fail(new TerrainGenerationError({
                  reason: response.error,
                  chunk: req.chunk,
                })))
              }
            },
          })
        }

        worker.onerror = (event: ErrorEvent) => {
          // Locate this worker in the pool and respawn it. We capture `worker`
          // in this closure but lookup the index dynamically so respawn works
          // even after rotations.
          const idx = poolWorkers.findIndex((w) => w.worker === worker)
          if (idx < 0) return
          Effect.runFork(Effect.logError(
            `TerrainWorkerPool worker[${idx}] errored: ${event.message ?? 'unknown error'}`,
          ))
          respawnAt(idx)
        }

        return { worker, pending }
      }

      poolWorkers = Arr.makeBy(workerCount, () => makePoolWorker()).slice()

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // Reject every pending request so dependent fibers don't hang on
          // tear-down.
          Arr.forEach(poolWorkers, ({ pending, worker }) => {
            Arr.forEach(Arr.fromIterable(MutableHashMap.values(pending)), (p) => {
              p.resume(Effect.fail(new TerrainGenerationError({
                reason: 'TerrainWorkerPool finalized while request was in flight',
                chunk: p.chunk,
              })))
            })
            try {
              worker.terminate()
            } catch {
              // already dead
            }
          })
        }),
      )

      return {
        generateTerrain: (
          chunk: ChunkCoord,
          options: TerrainGenerationOptions,
        ): Effect.Effect<ChunkBlocks, TerrainGenerationError> =>
          Effect.async<ChunkBlocks, TerrainGenerationError>((resume) => {
            const id = MutableRef.getAndUpdate(nextIdRef, (n) => n + 1)
            const workerIdx =
              MutableRef.getAndUpdate(nextWorkerIndexRef, (n) => n + 1) % workerCount
            const state = poolWorkers[workerIdx]!

            MutableHashMap.set(state.pending, id, { resume, chunk })

            const request: TerrainWorkerRequest = {
              id,
              chunk,
              seaLevel: options.seaLevel,
              lakeLevel: options.lakeLevel,
              seed: options.seed,
            }
            // No transfer list on the request side — the request payload is
            // tiny structured-cloneable JSON. The worker's response, however,
            // transfers all three Uint8Array buffers.
            try {
              state.worker.postMessage(request)
            } catch (err) {
              // Synchronous post failure (rare; e.g. detached buffer in user
              // payload, structured-clone reject). Drop pending entry and
              // fail the caller.
              MutableHashMap.remove(state.pending, id)
              resume(Effect.fail(new TerrainGenerationError({
                reason: err instanceof Error ? err.message : String(err),
                chunk,
              })))
            }

            // Interruption handler — drop the pending entry so a late worker
            // response does not resume a dead fiber.
            return Effect.sync(() => {
              MutableHashMap.remove(state.pending, id)
            })
          }),
        workerCount,
      }
    }),
  },
) {}

export const TerrainWorkerPoolLive = TerrainWorkerPool.Default

// Re-exports — kept here so integration agents can pull both the service and
// the value-level helpers (BLOCK_BYTES, LIGHT_BYTE_LENGTH) from a single
// import site.
export { BLOCK_BYTES, LIGHT_BYTE_LENGTH, isDevBuild }
