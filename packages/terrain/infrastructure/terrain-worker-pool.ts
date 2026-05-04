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
//   - Fatal worker onerror degrades the entire pool to synchronous generation.
//     Every in-flight request fails once with a typed TerrainGenerationError so
//     the existing per-request catchAll path can retry via generateTerrainSync.
//     Future requests bypass workers entirely.
//   - Decode failures on onmessage are caught and logged via
//     Effect.logError(Cause.pretty(...)) — never thrown.
//   - postMessage uses an explicit transfer list. In dev builds we assert
//     buffer.byteLength === 0 post-send to catch ownership leaks.
import {
  Array as Arr,
  Cause,
  Effect,
  MutableHashMap,
  MutableRef,
  Option,
  Schema,
} from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/world-state'
import { generateTerrainBlocks, type ChunkBlocks } from '../application/terrain-generation'
import { TerrainGenerationError, type TerrainGenerationOptions } from '../application/terrain-worker-pool-port'
import {
  TerrainWorkerResponseSchema,
  type TerrainWorkerRequest,
  type TerrainWorkerResponse,
} from '../domain/terrain-worker-protocol'

const decodeResponseSync = Schema.decodeUnknownSync(TerrainWorkerResponseSchema)

const BLOCK_BYTES = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const generateTerrainSync = (
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
  })

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

  type ProcessLike = {
    env?: {
      readonly NODE_ENV?: string
    }
  }
  const processLike = (globalThis as typeof globalThis & { process?: ProcessLike }).process
  return processLike?.env?.NODE_ENV !== 'production'
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
            generateTerrainSync(chunk, options),
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
      const degradedRef = MutableRef.make(false)

      // Each PoolWorker carries its own pending map. The pool array is held
      // in a `MutableRef` so the pool can be drained and terminated on a fatal
      // worker error while keeping the state visible to the Effect runtime.
      const poolWorkersRef = MutableRef.make<PoolWorker[]>([])

      const terminateWorkerSafely = (worker: Worker): void => {
        try {
          worker.terminate()
        } catch {
          // ignore: terminate after a fatal error sometimes throws
        }
      }

      const formatWorkerErrorDetails = (event: ErrorEvent): string => {
        const details = [
          `message=${event.message === '' ? 'unknown error' : event.message}`,
        ]

        if (event.filename !== '') {
          details.push(`filename=${event.filename}`)
        }
        if (event.lineno !== 0) {
          details.push(`lineno=${String(event.lineno)}`)
        }
        if (event.colno !== 0) {
          details.push(`colno=${String(event.colno)}`)
        }
        if (event.error !== undefined && event.error !== null) {
          details.push(
            `error=${event.error instanceof Error ? event.error.message : String(event.error)}`,
          )
        }

        return details.join(', ')
      }

      const degradeToSync = (reason: string): void => {
        if (MutableRef.get(degradedRef)) return

        MutableRef.set(degradedRef, true)

        const activeWorkers = MutableRef.get(poolWorkersRef)
        MutableRef.set(poolWorkersRef, [])

        Arr.forEach(activeWorkers, ({ pending, worker }) => {
          const stranded = Arr.fromIterable(MutableHashMap.values(pending))

          Arr.forEach(stranded, (request) => {
            request.resume(Effect.fail(new TerrainGenerationError({
              reason,
              chunk: request.chunk,
            })))
          })

          terminateWorkerSafely(worker)
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
          Option.map(entry, (req) => {
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
          })
        }

        worker.onerror = (event: ErrorEvent) => {
          // Locate this worker in the pool and degrade the whole pool. We
          // capture `worker` in this closure but lookup the index dynamically so
          // late errors after teardown become no-ops.
          const idx = MutableRef.get(poolWorkersRef).findIndex((w) => w.worker === worker)
          if (idx < 0) return

          const reason = `Terrain worker fatal error on worker[${idx}]`

          Effect.runFork(Effect.logError(
            `${reason}; degrading to synchronous terrain generation (${formatWorkerErrorDetails(event)})`,
          ))
          degradeToSync(reason)
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
        ): Effect.Effect<ChunkBlocks, TerrainGenerationError> => {
          if (MutableRef.get(degradedRef)) {
            return generateTerrainSync(chunk, options)
          }

          return Effect.async<ChunkBlocks, TerrainGenerationError>((resume) => {
            const id = MutableRef.getAndUpdate(nextIdRef, (n) => n + 1)
            const workerIdx =
              MutableRef.getAndUpdate(nextWorkerIndexRef, (n) => n + 1) % workerCount
            const state = MutableRef.get(poolWorkersRef)[workerIdx]

            if (state === undefined) {
              resume(Effect.fail(new TerrainGenerationError({
                reason: 'Terrain worker pool unavailable',
                chunk,
              })))

              return Effect.void
            }

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
          }).pipe(
            Effect.timeoutFail({
              duration: '3 seconds',
              onTimeout: () => new TerrainGenerationError({
                reason: 'Worker response timed out',
                chunk,
              }),
            }),
            Effect.catchAll((err) =>
              Effect.logWarning(
                `TerrainWorkerPool falling back to sync generation for chunk (${chunk.x},${chunk.z}): ${err.reason}`,
              ).pipe(Effect.zipRight(generateTerrainSync(chunk, options)))
            ),
          )
        },
        workerCount,
        queueDepth: (): number => {
          if (MutableRef.get(degradedRef)) {
            return 0
          }

          return Arr.reduce(MutableRef.get(poolWorkersRef), 0, (acc, w) => acc + MutableHashMap.size(w.pending))
        },
      }
    }),
  },
) {}

export const TerrainWorkerPoolLive = TerrainWorkerPool.Default

// Re-exports — kept here so integration agents can pull both the service and
// the value-level helpers (BLOCK_BYTES, LIGHT_BYTE_LENGTH) from a single
// import site.
export { BLOCK_BYTES, LIGHT_BYTE_LENGTH, isDevBuild }
