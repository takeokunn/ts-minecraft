import { Array as Arr, Cause, Duration, Effect, MutableRef, Schema } from 'effect'
import type { ChunkCoord } from '@/domain/chunk'
import { NoiseService } from '@/infrastructure/noise/noise-service'
import { generateTerrainBlocks, type TerrainGenerationConfig } from '@/domain/terrain/terrain-generation'
import {
  TerrainWorkerResponseSchema,
  type TerrainWorkerRequest,
  type TerrainWorkerResponse,
} from './terrain-worker-protocol'
import { sampleTerrainNoise } from './terrain-noise'

type PendingTerrain = {
  readonly resolve: (value: Uint8Array) => void
  readonly reject: (e: Error) => void
}

type PoolWorker = {
  readonly worker: Worker
  readonly pending: MutableRef.MutableRef<Map<number, PendingTerrain>>
  /** Set to true when the worker has errored and is no longer usable. */
  readonly isDeadRef: MutableRef.MutableRef<boolean>
}

export class TerrainWorkerPool extends Effect.Service<TerrainWorkerPool>()(
  '@minecraft/infrastructure/terrain/TerrainWorkerPool',
  {
    scoped: Effect.gen(function* () {
      const noiseService = yield* NoiseService

      const canUseWorkerThreads = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Worker !== 'undefined'

      if (!canUseWorkerThreads) {
        return {
          generateTerrain: (coord: ChunkCoord, config: TerrainGenerationConfig): Effect.Effect<Uint8Array> =>
            Effect.gen(function* () {
              const seed = yield* noiseService.getSeed()
              return generateTerrainBlocks(coord, sampleTerrainNoise(coord, seed), config)
            }),
          workerCount: 0,
        }
      }

      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))

      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)

      const poolWorkersRef = MutableRef.make<PoolWorker[]>([])
      for (let i = 0; i < workerCount; i++) {
        const pendingRef = MutableRef.make(new Map<number, PendingTerrain>())
        const isDeadRef = MutableRef.make(false)
        const worker = new Worker(
          new URL('../../workers/terrain-worker.ts', import.meta.url),
          { type: 'module' },
        )

        worker.onmessage = (e: MessageEvent<TerrainWorkerResponse>) => {
          // Defensively decode — a parse failure must not throw an uncaught window exception
          // (which would bypass error handling and leave the pending request to hang until the 30 s timeout).
          let id: number
          let blocks: Uint8Array
          try {
            ;({ id, blocks } = Schema.decodeUnknownSync(TerrainWorkerResponseSchema)(e.data))
          } catch {
            // Malformed response: the pending request will be cleaned up by the 30 s timeout.
            return
          }
          const pending = MutableRef.get(pendingRef)
          const request = pending.get(id)
          if (request === undefined) return
          pending.delete(id)
          request.resolve(blocks)
        }

        worker.onerror = (e: ErrorEvent) => {
          MutableRef.set(isDeadRef, true)
          const pending = MutableRef.get(pendingRef)
          const err = new Error(`Terrain worker error: ${e.message ?? 'unknown'}`)
          for (const [, request] of pending) {
            request.reject(err)
          }
          pending.clear()
        }

        MutableRef.update(poolWorkersRef, (workers) => Arr.append(workers, { worker, pending: pendingRef, isDeadRef }))
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          Arr.forEach(MutableRef.get(poolWorkersRef), ({ worker, pending }) => {
            const pendingMap = MutableRef.get(pending)
            for (const [, request] of pendingMap) {
              request.reject(new Error('Terrain worker pool terminated'))
            }
            pendingMap.clear()
            worker.terminate()
          })
        }),
      )

      return {
        generateTerrain: (coord: ChunkCoord, config: TerrainGenerationConfig): Effect.Effect<Uint8Array> =>
          Effect.gen(function* () {
            const seed = yield* noiseService.getSeed()

            const workerIndex = MutableRef.getAndUpdate(nextWorkerIndexRef, (n) => n + 1) % workerCount
            const state = MutableRef.get(poolWorkersRef)[workerIndex]!

            // Dead worker (errored during init or a previous request): skip async path entirely.
            if (MutableRef.get(state.isDeadRef)) {
              yield* Effect.logWarning(`Terrain worker ${workerIndex} is dead — falling back to synchronous generation for chunk (${coord.x},${coord.z})`)
              return generateTerrainBlocks(coord, sampleTerrainNoise(coord, seed), config)
            }

            return yield* Effect.async<Uint8Array, Error>((resume) => {
              const id = MutableRef.getAndUpdate(nextIdRef, (n) => n + 1)

              const pending = MutableRef.get(state.pending)
              pending.set(id, {
                resolve: (blocks) => resume(Effect.succeed(blocks)),
                // Use Effect.fail (typed error) instead of Effect.die (defect) so the
                // error is catchable and we can fall back to synchronous generation.
                reject: (e) => resume(Effect.fail(e)),
              })

              const request: TerrainWorkerRequest = {
                id,
                seed,
                chunkX: coord.x,
                chunkZ: coord.z,
                seaLevel: config.seaLevel,
                lakeLevel: config.lakeLevel,
              }

              state.worker.postMessage(request, [])

              return Effect.sync(() => {
                pending.delete(id)
              })
            }).pipe(
              // 30s timeout guards against a worker that dies silently after a request is sent
              // (onerror fired against an empty pending map, so reject was never called).
              Effect.timeout(Duration.seconds(30)),
              // Fall back to synchronous generation on any failure: typed worker error,
              // TimeoutException, or unexpected defect. Log the cause so degraded operation
              // is observable without breaking the error-free caller contract.
              Effect.catchAllCause((cause) =>
                Effect.logWarning(`Terrain worker failed for chunk (${coord.x},${coord.z}), falling back to sync: ${Cause.pretty(cause)}`).pipe(
                  Effect.andThen(Effect.sync(() => generateTerrainBlocks(coord, sampleTerrainNoise(coord, seed), config)))
                )
              ),
            )
          }),
        workerCount,
      }
    }),
  },
) {}

export const TerrainWorkerPoolLive = TerrainWorkerPool.Default
