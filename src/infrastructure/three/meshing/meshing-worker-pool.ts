import { Array as Arr, Effect, MutableRef } from 'effect'
import { greedyMeshChunk } from './greedy-meshing'
import type { MeshedChunk } from './greedy-meshing'
import { CHUNK_SIZE, blockTypeToIndex } from '@/domain/chunk'
import type { Chunk } from '@/domain/chunk'

// Single source of truth for transparent block IDs used by the meshing pipeline.
// Array form is sent with each worker message; Set form is used in the synchronous fallback.
const TRANSPARENT_IDS_ARRAY: readonly number[] = [blockTypeToIndex('WATER')]
const TRANSPARENT_IDS_SET = new Set(TRANSPARENT_IDS_ARRAY)

export interface WorkerMeshResult {
  readonly opaque: MeshedChunk
  readonly water: MeshedChunk | null
}

// Typed shape of the message returned by meshing-worker.ts.
// 'o' prefix = opaque, 'w' prefix = water. null water arrays mean no transparent faces.
// ArrayBuffer (not ArrayBufferLike) because postMessage with transfer always detaches
// the underlying ArrayBuffer — SharedArrayBuffer cannot be transferred this way.
interface WorkerResponse {
  readonly id: number
  readonly opositions: Float32Array<ArrayBuffer>
  readonly onormals: Int8Array<ArrayBuffer>
  readonly ocolors: Uint8Array<ArrayBuffer>
  readonly ouvs: Float32Array<ArrayBuffer>
  readonly oindices: Uint32Array<ArrayBuffer>
  readonly wpositions: Float32Array<ArrayBuffer> | null
  readonly wnormals: Int8Array<ArrayBuffer> | null
  readonly wcolors: Uint8Array<ArrayBuffer> | null
  readonly wuvs: Float32Array<ArrayBuffer> | null
  readonly windices: Uint32Array<ArrayBuffer> | null
}

interface PendingMesh {
  readonly resolve: (v: WorkerMeshResult) => void
  readonly reject: (e: unknown) => void
}

interface PoolWorker {
  readonly worker: Worker
  readonly pending: Map<number, PendingMesh>
}

/**
 * Worker pool for offloading greedyMeshChunk to background threads.
 *
 * In browser environments, creates Math.max(1, Math.min(4, hardwareConcurrency - 1))
 * workers so the main thread retains at least one core for rendering.
 *
 * In non-browser environments (Node.js / vitest), falls back to synchronous
 * greedyMeshChunk calls — no Worker API required, tests pass unmodified.
 */
export class MeshingWorkerPool extends Effect.Service<MeshingWorkerPool>()(
  '@minecraft/infrastructure/three/MeshingWorkerPool',
  {
    scoped: Effect.gen(function* () {
      if (typeof Worker === 'undefined') {
        // Node.js / test fallback: synchronous meshing, Effect.sync (no fiber overhead)
        return {
          meshChunk: (chunk: Chunk): Effect.Effect<WorkerMeshResult> =>
            Effect.sync(() => {
              const result = greedyMeshChunk(
                chunk,
                { wx: chunk.coord.x * CHUNK_SIZE, wz: chunk.coord.z * CHUNK_SIZE },
                TRANSPARENT_IDS_SET
              )
              const meshed = result.toMeshed()
              return {
                opaque: meshed.opaque,
                water: meshed.water.positions.length > 0 ? meshed.water : null,
              }
            }),
          workerCount: 0,
        }
      }

      // Leave one core for the main thread (renderer + game loop).
      // Cap at 4 to avoid diminishing returns from context-switch overhead.
      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))

      // Mutable counters for round-robin dispatch — single frame-handler fiber, no contention.
      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)

      const poolWorkers: PoolWorker[] = []
      for (let i = 0; i < workerCount; i++) {
        const pending = new Map<number, PendingMesh>()

        // Vite resolves this URL at build time and bundles meshing-worker.ts separately.
        // The @/ alias is resolved by Vite's worker bundler via the same alias config.
        const worker = new Worker(
          new URL('../../../workers/meshing-worker.ts', import.meta.url),
          { type: 'module' }
        )

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const { id, opositions, onormals, ocolors, ouvs, oindices,
                  wpositions, wnormals, wcolors, wuvs, windices } = e.data
          const req = pending.get(id)
          if (req === undefined) return
          pending.delete(id)

          const opaque: MeshedChunk = {
            positions: opositions,
            normals: onormals,
            colors: ocolors,
            uvs: ouvs,
            indices: oindices,
          }
          // Non-null assertion safe: all water arrays are sent together or all null
          const water: MeshedChunk | null = wpositions !== null
            ? { positions: wpositions, normals: wnormals!, colors: wcolors!, uvs: wuvs!, indices: windices! }
            : null

          req.resolve({ opaque, water })
        }

        worker.onerror = (e: ErrorEvent) => {
          for (const [, req] of pending) {
            req.reject(new Error(`Meshing worker error: ${e.message ?? 'unknown'}`))
          }
          pending.clear()
        }

        poolWorkers.push({ worker, pending })
      }

      // Terminate all workers when the service scope closes (app shutdown / test teardown)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          Arr.forEach(poolWorkers, ({ worker }) => worker.terminate())
        })
      )

      return {
        meshChunk: (chunk: Chunk): Effect.Effect<WorkerMeshResult> =>
          Effect.async<WorkerMeshResult>((resume) => {
            const id = MutableRef.getAndUpdate(nextIdRef, n => n + 1)
            const workerIdx = MutableRef.getAndUpdate(nextWorkerIndexRef, n => n + 1) % workerCount
            const state = poolWorkers[workerIdx]!

            state.pending.set(id, {
              resolve: (v) => resume(Effect.succeed(v)),
              // Worker errors become defects (die) so they appear in logs and crash the
              // fiber rather than being silently swallowed as typed errors.
              reject: (e) => resume(Effect.die(e)),
            })

            // .slice() produces an owned ArrayBuffer for transfer; chunk.blocks may be
            // a subarray view of a larger shared buffer (e.g. from IndexedDB decode).
            const blocksBuffer = chunk.blocks.buffer.slice(
              chunk.blocks.byteOffset,
              chunk.blocks.byteOffset + chunk.blocks.byteLength
            )

            state.worker.postMessage(
              {
                id,
                blocks: blocksBuffer,
                wx: chunk.coord.x * CHUNK_SIZE,
                wz: chunk.coord.z * CHUNK_SIZE,
                transparentBlockIds: TRANSPARENT_IDS_ARRAY,
              },
              [blocksBuffer]
            )

            // Interruption handler: remove pending entry so a late worker response
            // is silently discarded instead of resuming a dead fiber.
            return Effect.sync(() => {
              state.pending.delete(id)
            })
          }),
        workerCount,
      }
    }),
  }
) {}
export const MeshingWorkerPoolLive = MeshingWorkerPool.Default
