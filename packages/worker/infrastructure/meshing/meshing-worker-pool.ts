// @effect-boundary Web Worker messages are callback/exception boundaries; this module converts them to Effect values.
import { Array as Arr, Effect, MutableRef, Option, Schema } from 'effect'
import { CHUNK_SIZE, type ChunkCoord } from '@ts-minecraft/core'
import type { Chunk, ChunkAABB } from '@ts-minecraft/world'
import type { LodLevel } from '@ts-minecraft/rendering/infrastructure/meshing/lod-simplification'
import { createSyncChunkMesher } from './meshing-worker-sync'
import {
  MESHING_WORKER_TIMEOUT,
  MESHING_WORKER_FAILURE_THRESHOLD,
  TRANSPARENT_IDS_ARRAY,
  TRANSPARENT_SOLID_IDS_ARRAY,
} from './meshing-worker-config'
import {
  WorkerResponseSchema,
  extractResponseId,
  rejectAllPendingRequests,
  rejectPendingRequest,
  toMeshingWorkerError,
  toWorkerMeshResult,
  type PendingMesh,
  type PoolWorker,
  type WorkerMeshResult,
} from './meshing-worker-pool-protocol'
export { WorkerMeshResultSchema } from './meshing-worker-pool-protocol'
export type { WorkerMeshResult } from './meshing-worker-pool-protocol'

/**
 * FR-3.2: options bag for `meshChunk`. Currently carries an optional LOD
 * level that the meshing worker (or sync fallback) applies AFTER greedy
 * meshing. Older callers omit the field for behaviour-preserving LOD-0.
 *
 * FR-4.1: optional `dirtyAABB` enables sub-region greedy meshing — when both
 * `dirtyAABB` and a previous mesh result are available, the meshing pipeline
 * splices in only the affected slices instead of re-meshing the full
 * 16×256×16 chunk. Sub-region meshing applies ONLY at LOD 0 — LOD 1/2 chunks
 * always re-mesh fully because the simplification step downstream produces a
 * different output layout that cannot be spliced. The AABB is opt-in:
 * omitting the field falls back to a full re-mesh (behaviour-preserving).
 *
 * Production wiring status:
 *   - Synchronous fallback path (Worker undefined OR pool disabled): consumes
 *     `dirtyAABB` and routes through `greedyMeshChunkSubregion`, keyed by a
 *     per-coord `prev` cache held inside `createSyncChunkMesher`.
 *   - Worker path: still performs a full re-mesh; the worker does not yet
 *     hold a `prev` cache (would require transferring the previous mesh into
 *     the worker each call). The `dirtyAABB` field is forwarded through the
 *     worker protocol as a no-op so future worker-side splicing requires no
 *     protocol change.
 *
 * Behaviour invariant: the splice output is byte-equivalent (multiset) with
 * the full re-mesh, proven by `subregion-greedy.test.ts` property tests.
 */
// Local type alias for the worker API; structurally identical to `ChunkAABB`.
export type DirtyAABB = ChunkAABB

export type MeshChunkOptions = {
  /**
   * 0 = full detail (default — behaviour-preserving)
   * 1 = simplified (~25-30% of LOD 0 vertices)
   * 2 = ultra-simplified (~6-10% of LOD 0 vertices)
   * Distance-aware callers should map chunk distance to a level via
   * `lodForDistance` from `./lod-simplification`.
   */
  readonly lod?: LodLevel
  /**
   * FR-4.1: chunk-local AABB of the changed sub-region. Required for the
   * sub-region path; omitting this field requests a full re-mesh.
   * FR-4.2: ChunkManagerService.drainRenderDirtyChunkEntries supplies this
   * value built from the union of seed dirty voxels + light-BFS affected
   * voxels. Sync fallback path actively splices via
   * `greedyMeshChunkSubregion`; worker path still full re-meshes.
   */
  readonly dirtyAABB?: ChunkAABB
}

// Worker pool for offloading greedyMeshChunk to background threads.
// In browser environments, creates Math.max(1, Math.min(4, hardwareConcurrency - 1))
// workers so the main thread retains at least one core for rendering.
// In non-browser environments (Node.js / vitest), falls back to synchronous
// greedyMeshChunk calls — no Worker API required, tests pass unmodified.
export class MeshingWorkerPool extends Effect.Service<MeshingWorkerPool>()(
  '@minecraft/infrastructure/three/MeshingWorkerPool',
  {
    scoped: Effect.gen(function* () {
      const syncMesher = createSyncChunkMesher()
      const meshChunkSync = syncMesher.mesh

      // SEC-W1: drops the sync-fallback prev cache for `coord`. Worker path
      // is a no-op because the worker never holds a per-coord prev cache —
      // splicing is currently main-thread-only (see `MeshChunkOptions`).
      // Caller (`world-renderer-chunk-sync.ts` removal loop) invokes this
      // when a chunk leaves the loaded set so the cache cannot grow
      // unbounded over a long session under the sync fallback path.
      const releasePrevCachedMesh = (coord: ChunkCoord): Effect.Effect<void> =>
        Effect.sync(() => syncMesher.releasePrev(coord))

      if (typeof Worker === 'undefined') {
        return {
          meshChunk: (chunk: Chunk, options?: MeshChunkOptions): Effect.Effect<WorkerMeshResult> =>
            Effect.sync(() => meshChunkSync(chunk, options?.lod ?? 0, options?.dirtyAABB)),
          releasePrevCachedMesh,
          workerCount: 0,
        }
      }

      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))
      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)
      const workerPoolDisabledRef = MutableRef.make(false)
      // Circuit breaker: consecutive worker failures. A success resets it; the pool is
      // only permanently disabled once failures reach MESHING_WORKER_FAILURE_THRESHOLD.
      const workerFailureCountRef = MutableRef.make(0)

      const makePoolWorker = (): PoolWorker => {
        const pendingRef = MutableRef.make(new Map<number, PendingMesh>())
        const worker = new Worker(
          new URL('./meshing-worker.ts', import.meta.url),
          { type: 'module' }
        )

        worker.onmessage = (e: MessageEvent<unknown>) => {
          const responseId = extractResponseId(e.data)

          try {
            const response = Schema.decodeUnknownSync(WorkerResponseSchema)(e.data)
            const pending = MutableRef.get(pendingRef)
            const req = pending.get(response.id)
            if (req === undefined) return
            pending.delete(response.id)
            req.resolve(toWorkerMeshResult(response))
          } catch (error) {
            const workerError = toMeshingWorkerError(error, 'Malformed meshing worker response')
            if (responseId !== null && rejectPendingRequest(pendingRef, responseId, workerError)) {
              return
            }
            rejectAllPendingRequests(pendingRef, workerError)
          }
        }

        worker.onerror = (e: ErrorEvent) => {
          rejectAllPendingRequests(
            pendingRef,
            new Error(`Meshing worker error: ${e.message ?? 'unknown'}`),
          )
        }

        return { worker, pending: pendingRef }
      }

      const poolWorkersRef = MutableRef.make<PoolWorker[]>(Arr.makeBy(workerCount, () => makePoolWorker()))

      const disableWorkerPool = (error: Error): void => {
        if (MutableRef.get(workerPoolDisabledRef)) return

        MutableRef.set(workerPoolDisabledRef, true)
        Arr.forEach(MutableRef.get(poolWorkersRef), ({ worker, pending }) => {
          rejectAllPendingRequests(pending, error)
          worker.terminate()
        })
      }

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          Arr.forEach(MutableRef.get(poolWorkersRef), ({ worker }) => worker.terminate())
        })
      )

      return {
        meshChunk: (chunk: Chunk, options?: MeshChunkOptions): Effect.Effect<WorkerMeshResult> =>
          MutableRef.get(workerPoolDisabledRef)
            ? Effect.sync(() => meshChunkSync(chunk, options?.lod ?? 0, options?.dirtyAABB))
            : Effect.async<WorkerMeshResult, Error>((resume) => {
            const id = MutableRef.getAndUpdate(nextIdRef, (n) => n + 1)
            const workerIdx = MutableRef.getAndUpdate(nextWorkerIndexRef, (n) => n + 1) % workerCount
            const state = MutableRef.get(poolWorkersRef)[workerIdx]

            if (state === undefined) {
              resume(Effect.fail(new Error('Meshing worker pool is empty')))
              return Effect.void
            }

            const pending = MutableRef.get(state.pending)
            pending.set(id, {
              resolve: (value: WorkerMeshResult) => resume(Effect.succeed(value)),
              reject: (error: unknown) => resume(Effect.fail(error instanceof Error ? error : new Error(String(error)))),
            })

            const blocksBuffer = chunk.blocks.buffer.slice(
              chunk.blocks.byteOffset,
              chunk.blocks.byteOffset + chunk.blocks.byteLength
            ) as ArrayBuffer
            const fluidOpt = Option.getOrNull(chunk.fluid)
            const fluidBuffer: ArrayBuffer | null = fluidOpt !== null
              ? fluidOpt.buffer.slice(fluidOpt.byteOffset, fluidOpt.byteOffset + fluidOpt.byteLength) as ArrayBuffer
              : null

            const hasLight = chunk.skyLight !== undefined && chunk.blockLight !== undefined
            const skyBuffer: ArrayBuffer | null = hasLight
              ? (chunk.skyLight.buffer.slice(
                  chunk.skyLight.byteOffset,
                  chunk.skyLight.byteOffset + chunk.skyLight.byteLength
                ) as ArrayBuffer)
              : null
            const blockBuffer: ArrayBuffer | null = hasLight
              ? (chunk.blockLight.buffer.slice(
                  chunk.blockLight.byteOffset,
                  chunk.blockLight.byteOffset + chunk.blockLight.byteLength
                ) as ArrayBuffer)
              : null

            const transferList: ArrayBuffer[] = [blocksBuffer]
            if (fluidBuffer !== null) transferList.push(fluidBuffer)
            if (skyBuffer !== null) transferList.push(skyBuffer)
            if (blockBuffer !== null) transferList.push(blockBuffer)

            try {
              state.worker.postMessage(
                {
                  id,
                  blocks: blocksBuffer,
                  fluid: fluidBuffer,
                  skyLight: skyBuffer,
                  blockLight: blockBuffer,
                  wx: chunk.coord.x * CHUNK_SIZE,
                  wz: chunk.coord.z * CHUNK_SIZE,
                  transparentBlockIds: TRANSPARENT_IDS_ARRAY,
                  transparentSolidBlockIds: TRANSPARENT_SOLID_IDS_ARRAY,
                  // FR-3.2: include LOD so the worker can apply simplification
                  // before transferring the meshed buffers back.
                  lod: options?.lod ?? 0,
                  // FR-4.1: forward dirtyAABB through the protocol so future
                  // worker-side optimisations can be wired without protocol
                  // changes. Currently unused on the worker side — main-thread
                  // splicing in chunk-mesh.ts owns the sub-region path.
                  dirtyAABB: options?.dirtyAABB ?? null,
                },
                transferList
              )
            } catch (error) {
              pending.delete(id)
              resume(Effect.fail(toMeshingWorkerError(error, 'Failed to post meshing worker request')))
            }

            return Effect.sync(() => {
              pending.delete(id)
            })
          }).pipe(
              Effect.timeoutFail({
                duration: MESHING_WORKER_TIMEOUT,
                onTimeout: () =>
                  new Error(`Meshing worker response timed out after ${MESHING_WORKER_TIMEOUT}`),
              }),
              // A successful response means the pool is healthy — reset the failure streak.
              Effect.tap(() => Effect.sync(() => MutableRef.set(workerFailureCountRef, 0))),
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  // Circuit breaker: a single transient timeout must NOT permanently route all
                  // future meshing onto the main thread. Count consecutive failures and only
                  // disable the pool once a genuinely-broken worker trips the threshold; either
                  // way this chunk falls back to sync so meshing never stalls.
                  const failures = MutableRef.updateAndGet(workerFailureCountRef, (n) => n + 1)
                  if (failures >= MESHING_WORKER_FAILURE_THRESHOLD) {
                    yield* Effect.sync(() => disableWorkerPool(error))
                    yield* Effect.logWarning(
                      `MeshingWorkerPool disabling workers after ${failures} consecutive failures; falling back to sync meshing. Last error on chunk (${chunk.coord.x},${chunk.coord.z}): ${error.message}`,
                    )
                  } else {
                    yield* Effect.logWarning(
                      `MeshingWorkerPool transient failure ${failures}/${MESHING_WORKER_FAILURE_THRESHOLD} on chunk (${chunk.coord.x},${chunk.coord.z}); sync fallback for this chunk only: ${error.message}`,
                    )
                  }
                  return yield* Effect.sync(() => meshChunkSync(chunk, options?.lod ?? 0, options?.dirtyAABB))
                })
              )
            ),
        releasePrevCachedMesh,
        workerCount,
      }
    }),
  }
) {}
