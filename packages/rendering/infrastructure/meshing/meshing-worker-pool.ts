import { Array as Arr, Effect, MutableRef, Option, Schema } from 'effect'
import { createGreedyMeshScratch, greedyMeshChunk, MeshedChunkSchema } from './greedy-meshing'
import type { MeshedChunk } from './greedy-meshing'
import type { LightGrids } from '@ts-minecraft/world-state'
import { CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'

// Single source of truth for transparent block IDs used by the meshing pipeline.
// Array form is sent with each worker message; Set form is used in the synchronous fallback.
const TRANSPARENT_IDS_ARRAY: readonly number[] = [blockTypeToIndex('WATER')]
const TRANSPARENT_IDS_SET = new Set(TRANSPARENT_IDS_ARRAY)

const MESHING_WORKER_TIMEOUT = '3 seconds'

const lightGridsFromChunk = (chunk: Chunk): LightGrids | undefined =>
  Option.match(
    Option.all([
      Option.fromNullable(chunk.skyLight),
      Option.fromNullable(chunk.blockLight),
    ] as const),
    {
      onNone: () => undefined,
      onSome: ([skyLight, blockLight]) => ({ skyLight, blockLight }),
    }
  )

const createSyncChunkMesher = (): ((chunk: Chunk) => WorkerMeshResult) => {
  const scratch = createGreedyMeshScratch()
  return (chunk: Chunk): WorkerMeshResult => {
    const result = greedyMeshChunk(
      chunk,
      { wx: chunk.coord.x * CHUNK_SIZE, wz: chunk.coord.z * CHUNK_SIZE },
      TRANSPARENT_IDS_SET,
      scratch,
      lightGridsFromChunk(chunk),
    )
    const meshed = result.toMeshed()
    return {
      opaque: meshed.opaque,
      water: meshed.water.positions.length > 0 ? meshed.water : null,
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractResponseId = (data: unknown): number | null => {
  if (!isRecord(data)) return null
  const id = data['id']
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 ? id : null
}

const toMeshedWater = (response: WorkerResponse): MeshedChunk | null => {
  if (
    response.wpositions === null
    && response.wnormals === null
    && response.wcolors === null
    && response.wuvs === null
    && response.wtileIndexes === null
    && response.windices === null
  ) {
    return null
  }

  if (
    response.wpositions !== null
    && response.wnormals !== null
    && response.wcolors !== null
    && response.wuvs !== null
    && response.wtileIndexes !== null
    && response.windices !== null
  ) {
    return {
      positions: response.wpositions,
      normals: response.wnormals,
      colors: response.wcolors,
      uvs: response.wuvs,
      tileIndexes: response.wtileIndexes,
      indices: response.windices,
    }
  }

  throw new Error('Malformed meshing worker response: incomplete water mesh payload')
}

const toWorkerMeshResult = (response: WorkerResponse): WorkerMeshResult => ({
  opaque: {
    positions: response.opositions,
    normals: response.onormals,
    colors: response.ocolors,
    uvs: response.ouvs,
    tileIndexes: response.otileIndexes,
    indices: response.oindices,
  },
  water: toMeshedWater(response),
})

const toMeshingWorkerError = (error: unknown, prefix: string): Error => {
  if (error instanceof Error) {
    return new Error(`${prefix}: ${error.message}`)
  }
  return new Error(`${prefix}: ${String(error)}`)
}

const rejectPendingRequest = (
  pendingRef: MutableRef.MutableRef<Map<number, PendingMesh>>,
  id: number,
  error: unknown,
): boolean => {
  const pending = MutableRef.get(pendingRef)
  const req = pending.get(id)
  if (req === undefined) return false
  pending.delete(id)
  req.reject(error)
  return true
}

const rejectAllPendingRequests = (
  pendingRef: MutableRef.MutableRef<Map<number, PendingMesh>>,
  error: unknown,
): void => {
  const pending = MutableRef.get(pendingRef)
  Arr.forEach(Arr.fromIterable(pending.values()), (req) => {
    req.reject(error)
  })
  pending.clear()
}

export const WorkerMeshResultSchema = Schema.Struct({
  opaque: MeshedChunkSchema,
  water: Schema.NullOr(MeshedChunkSchema),
})
export type WorkerMeshResult = Schema.Schema.Type<typeof WorkerMeshResultSchema>

// Typed shape of the message returned by meshing-worker.ts.
// 'o' prefix = opaque, 'w' prefix = water. null water arrays mean no transparent faces.
// ArrayBuffer (not ArrayBufferLike) because postMessage with transfer always detaches
// the underlying ArrayBuffer — SharedArrayBuffer cannot be transferred this way.
const WorkerResponseSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  opositions: Schema.instanceOf(Float32Array),
  onormals: Schema.instanceOf(Int8Array),
  ocolors: Schema.instanceOf(Uint8Array),
  ouvs: Schema.instanceOf(Float32Array),
  otileIndexes: Schema.instanceOf(Float32Array),
  oindices: Schema.instanceOf(Uint32Array),
  wpositions: Schema.NullOr(Schema.instanceOf(Float32Array)),
  wnormals: Schema.NullOr(Schema.instanceOf(Int8Array)),
  wcolors: Schema.NullOr(Schema.instanceOf(Uint8Array)),
  wuvs: Schema.NullOr(Schema.instanceOf(Float32Array)),
  wtileIndexes: Schema.NullOr(Schema.instanceOf(Float32Array)),
  windices: Schema.NullOr(Schema.instanceOf(Uint32Array)),
})
type WorkerResponse = Schema.Schema.Type<typeof WorkerResponseSchema>

const PendingMeshSchema = Schema.Struct({
  resolve: Schema.declare((u): u is (value: WorkerMeshResult) => void => typeof u === 'function'),
  reject: Schema.declare((u): u is (e: unknown) => void => typeof u === 'function'),
})
type PendingMesh = Schema.Schema.Type<typeof PendingMeshSchema>

type PoolWorker = {
  readonly worker: Worker
  readonly pending: MutableRef.MutableRef<Map<number, PendingMesh>>
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
      const meshChunkSync = createSyncChunkMesher()

      if (typeof Worker === 'undefined') {
        return {
          meshChunk: (chunk: Chunk): Effect.Effect<WorkerMeshResult> =>
            Effect.sync(() => meshChunkSync(chunk)),
          workerCount: 0,
        }
      }

      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))
      const nextIdRef = MutableRef.make(0)
      const nextWorkerIndexRef = MutableRef.make(0)

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

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          Arr.forEach(MutableRef.get(poolWorkersRef), ({ worker }) => worker.terminate())
        })
      )

      return {
        meshChunk: (chunk: Chunk): Effect.Effect<WorkerMeshResult> =>
          Effect.async<WorkerMeshResult, Error>((resume) => {
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
            if (skyBuffer !== null) transferList.push(skyBuffer)
            if (blockBuffer !== null) transferList.push(blockBuffer)

            try {
              state.worker.postMessage(
                {
                  id,
                  blocks: blocksBuffer,
                  skyLight: skyBuffer,
                  blockLight: blockBuffer,
                  wx: chunk.coord.x * CHUNK_SIZE,
                  wz: chunk.coord.z * CHUNK_SIZE,
                  transparentBlockIds: TRANSPARENT_IDS_ARRAY,
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
            Effect.catchAll((error) =>
              Effect.logWarning(
                `MeshingWorkerPool falling back to sync meshing for chunk (${chunk.coord.x},${chunk.coord.z}): ${error.message}`,
              ).pipe(Effect.zipRight(Effect.sync(() => meshChunkSync(chunk))))
            )
          ),
        workerCount,
      }
    }),
  }
) {}
export const MeshingWorkerPoolLive = MeshingWorkerPool.Default
