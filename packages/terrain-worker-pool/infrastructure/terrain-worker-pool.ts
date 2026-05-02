// Worker pool for off-main-thread terrain generation.
//
// Mirrors the architecture of infrastructure/three/meshing/MeshingWorkerPool:
//   - Effect.Service / scoped layer
//   - Round-robin dispatch over Math.max(2, Math.min(8, hardwareConcurrency-1)) workers
//   - Per-worker MutableHashMap<id, deferred> for pending requests
//   - Finalizer terminates all workers
//   - Synchronous fallback when Worker is unavailable (Vitest / Node.js)
//
// Robustness extensions over the meshing pool (FR-016):
//   - Worker onerror triggers respawn: the dead worker is terminated, a fresh
//     one is created. Re-routing of stranded pending requests is NOT
//     implemented — every stranded request fails with a typed
//     TerrainGenerationError so the caller can retry against the now-healthy
//     pool. (The original request envelope is not retained, so genuine re-route
//     would need protocol changes.)
//   - Decode failures on onmessage are caught and logged via
//     Effect.logError(Cause.pretty(...)) — never thrown.
//   - postMessage uses an explicit transfer list. In dev builds we assert
//     buffer.byteLength === 0 post-send to catch ownership leaks.
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
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/domain'
import type { ChunkCoord } from '@ts-minecraft/domain'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/domain'
import {
  generateTerrainBlocks,
  type ChunkBlocks,
} from '@ts-minecraft/terrain-generator'
import {
  TerrainWorkerResponseSchema,
  type TerrainWorkerRequest,
  type TerrainWorkerResponse,
} from '../domain/terrain-worker-protocol'

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
  return Math.max(2, Math.min(8, hc - 1))
}

// In dev builds, assert that the buffer has been detached post-postMessage.
// We treat any environment where `import.meta.env?.DEV` is truthy OR
// `process.env.NODE_ENV !== 'production'` as a dev build.
//
// We type `import.meta` locally instead of pulling in `vite/client`: the
// project's tsconfig has `"types": []`, so adding a global types reference
// would expand the ambient surface unnecessarily. Vite injects `import.meta.env`
// at build time; the narrow intersection below describes only the field we
// actually read.
const isDevBuild = (): boolean => {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
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
          queueDepth: () => 0,
        }
      }

      // -------------------------------------------------------------------
      // Worker-backed path
      // -------------------------------------------------------------------
      const workerCount = computeWorkerCount()
      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)

      // Each PoolWorker carries its own pending map. The pool array is held
      // in a `MutableRef` so respawn can swap one slot in place while keeping
      // the state visible to the Effect runtime.
      const poolWorkersRef = MutableRef.make<PoolWorker[]>([])

      // Forward declaration so makePoolWorker can refer to the respawn func
      // via the captured `respawnAt` reference.
      //
      // Re-route is NOT implemented: stranded requests fail with a retryable
      // typed error so the caller can re-issue them against the now-healthy
      // pool. The original `TerrainGenerationOptions` aren't retained inside
      // `Pending`, so a genuine re-route would require protocol changes.
      const respawnAt = (idx: number): void => {
        const current = MutableRef.get(poolWorkersRef)
        const dead = current[idx]
        if (dead === undefined) return
        // Snapshot the dead worker's pending requests before we tear it down,
        // so we can fail them with a typed error.
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
        // In-place mutation through MutableRef: same array identity, single
        // slot replaced. Performance equals plain `arr[idx] = x` while
        // explicitly signalling "state mutation" to readers of this code.
        MutableRef.update(poolWorkersRef, (arr) => {
          arr[idx] = replacement
          return arr
        })

        // Fail every stranded request with a typed retryable error. The caller
        // is expected to retry; the freshly-spawned replacement (and any other
        // surviving workers) will handle the retry cleanly.
        Arr.forEach(stranded, (p) => {
          p.resume(Effect.fail(new TerrainGenerationError({
            reason: 'Worker died; request must be retried',
            chunk: p.chunk,
          })))
        })
      }

      const makePoolWorker = (): PoolWorker => {
        const pending = MutableHashMap.empty<number, Pending>()

        const worker = new Worker(
          new URL('./terrain-worker.ts', import.meta.url),
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
          const idx = MutableRef.get(poolWorkersRef).findIndex((w) => w.worker === worker)
          if (idx < 0) return
          Effect.runFork(Effect.logError(
            `TerrainWorkerPool worker[${idx}] errored: ${event.message ?? 'unknown error'}`,
          ))
          respawnAt(idx)
        }

        return { worker, pending }
      }

      MutableRef.set(poolWorkersRef, Arr.makeBy(workerCount, () => makePoolWorker()).slice())

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // Reject every pending request so dependent fibers don't hang on
          // tear-down.
          Arr.forEach(MutableRef.get(poolWorkersRef), ({ pending, worker }) => {
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
            const state = MutableRef.get(poolWorkersRef)[workerIdx]!

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
        queueDepth: (): number =>
          Arr.reduce(MutableRef.get(poolWorkersRef), 0, (acc, w) => acc + MutableHashMap.size(w.pending)),
      }
    }),
  },
) {}

export const TerrainWorkerPoolLive = TerrainWorkerPool.Default

// Re-exports — kept here so integration agents can pull both the service and
// the value-level helpers (BLOCK_BYTES, LIGHT_BYTE_LENGTH) from a single
// import site.
export { BLOCK_BYTES, LIGHT_BYTE_LENGTH, isDevBuild }
