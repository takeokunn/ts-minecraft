import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { vi } from 'vitest'
import { Effect, Fiber, MutableRef, Option, TestClock, TestContext } from 'effect'
import { MeshingWorkerPool, selectLeastLoadedWorkerIndex } from '@ts-minecraft/worker'
import type { Chunk } from '@ts-minecraft/world'
import type { ChunkCoord } from '@ts-minecraft/core'
import { MAX_SYNC_PREV_MESH_CACHE_ENTRIES } from '../infrastructure/meshing/meshing-worker-sync'

// SEC-W1: spy on greedyMeshChunkSubregion so we can detect when
// MeshingWorkerPool's sync fallback path takes the splice branch (cache hit)
// versus the full re-mesh branch (cache miss / released).
const subregionSpy = vi.fn()
vi.mock('@ts-minecraft/rendering/infrastructure/meshing/subregion-greedy', async () => {
  const actual = await vi.importActual<typeof import('@ts-minecraft/rendering/infrastructure/meshing/subregion-greedy')>(
    '@ts-minecraft/rendering/infrastructure/meshing/subregion-greedy'
  )
  return {
    ...actual,
    greedyMeshChunkSubregion: vi.fn((...args: Parameters<typeof actual.greedyMeshChunkSubregion>) => {
      subregionSpy(...args)
      return actual.greedyMeshChunkSubregion(...args)
    }),
  }
})

const makeChunk = (coord: ChunkCoord = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: (() => {
    const blocks = new Uint8Array(16 * 16 * 256)
    blocks[0] = 1
    return blocks
  })(),
  fluid: Option.none(),
})

const extractMessageId = (message: unknown): number => {
  if (typeof message !== 'object' || message === null || !('id' in message)) {
    return 0
  }

  const id = message['id']
  return typeof id === 'number' ? id : 0
}

type WorkerMessageHandler = (event: { readonly data: unknown }) => void
type WorkerErrorHandler = (event: { readonly message?: string }) => void
type WorkerConstructorMock = new (url: string | URL, options?: WorkerOptions) => HungWorker

let hungPostMessageCount = 0

class HungWorker {
  onmessage: WorkerMessageHandler | null = null
  onerror: WorkerErrorHandler | null = null

  constructor(_url: string | URL, _options?: WorkerOptions) {}

  postMessage(_message: unknown, _transfer?: readonly Transferable[]): void {
    hungPostMessageCount += 1
  }

  terminate(): void {}
}

class MalformedResponseWorker extends HungWorker {
  override postMessage(message: unknown): void {
    const id = extractMessageId(message)
    queueMicrotask(() => {
      this.onmessage?.({ data: { id } })
    })
  }
}

class ErroringWorker extends HungWorker {
  override postMessage(_message: unknown): void {
    queueMicrotask(() => {
      this.onerror?.({ message: 'synthetic worker failure' })
    })
  }
}

let lastPostedMessage: unknown = undefined
let lastTransferList: ReadonlyArray<Transferable> = []

class CapturingWorker extends HungWorker {
  override postMessage(message: unknown, transfer?: readonly Transferable[]): void {
    lastPostedMessage = message
    lastTransferList = [...(transfer ?? [])]
    const id = extractMessageId(message)
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          id,
          opositions: new Float32Array(),
          onormals: new Int8Array(),
          ocolors: new Uint8Array(),
          ouvs: new Float32Array(),
          otileIndexes: new Float32Array(),
          oindices: new Uint32Array(),
          wpositions: null,
          wnormals: null,
          wcolors: null,
          wuvs: null,
          wtileIndexes: null,
          windices: null,
        },
      })
    })
  }
}

const makePoolWorkerWithPendingCount = (pendingCount: number) => ({
  worker: new HungWorker(new URL('http://localhost/worker.js')) as unknown as Worker,
  pending: MutableRef.make(
    new Map(
      Array.from({ length: pendingCount }, (_, index) => [
        index,
        {
          resolve: () => undefined,
          reject: () => undefined,
        },
      ])
    )
  ),
})

const withBrowserWorkerMock = <A, E, R>(
  WorkerCtor: WorkerConstructorMock,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.scoped(
    Effect.gen(function* () {
      const previousWorker = globalThis.Worker
      const previousNavigator = globalThis.navigator

      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        writable: true,
        value: WorkerCtor,
      })
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { hardwareConcurrency: 2 },
      })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (previousWorker === undefined) {
            Reflect.deleteProperty(globalThis, 'Worker')
          } else {
            Object.defineProperty(globalThis, 'Worker', {
              configurable: true,
              writable: true,
              value: previousWorker,
            })
          }

          if (previousNavigator === undefined) {
            Reflect.deleteProperty(globalThis, 'navigator')
          } else {
            Object.defineProperty(globalThis, 'navigator', {
              configurable: true,
              value: previousNavigator,
            })
          }
        })
      )

      return yield* effect
    })
  )

describe('infrastructure/three/meshing/meshing-worker-pool', () => {
  it('selects the least-loaded worker from the round-robin start point', () => {
    const workers = [
      makePoolWorkerWithPendingCount(4),
      makePoolWorkerWithPendingCount(3),
      makePoolWorkerWithPendingCount(1),
    ]

    expect(selectLeastLoadedWorkerIndex(workers, 0)).toBe(2)
    expect(selectLeastLoadedWorkerIndex(workers, 1)).toBe(2)
  })

  it('keeps the round-robin start worker when pending queue sizes are tied', () => {
    const workers = [
      makePoolWorkerWithPendingCount(2),
      makePoolWorkerWithPendingCount(2),
      makePoolWorkerWithPendingCount(2),
    ]

    expect(selectLeastLoadedWorkerIndex(workers, 0)).toBe(0)
    expect(selectLeastLoadedWorkerIndex(workers, 2)).toBe(2)
  })

  it.effect('falls back to synchronous meshing when Worker is unavailable', () =>
    Effect.gen(function* () {
      const pool = yield* MeshingWorkerPool
      expect(pool.workerCount).toBe(0)

      const result = yield* pool.meshChunk(makeChunk())
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.opaque.indices.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(MeshingWorkerPool.Default))
  )

  it.effect('falls back to synchronous meshing when worker response decoding fails', () =>
    withBrowserWorkerMock(
      MalformedResponseWorker,
      Effect.gen(function* () {
        const pool = yield* MeshingWorkerPool
        expect(pool.workerCount).toBeGreaterThan(0)

        const result = yield* pool.meshChunk(makeChunk())
        expect(result.opaque.positions.length).toBeGreaterThan(0)
        expect(result.opaque.indices.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(MeshingWorkerPool.Default))
    )
  )

  it.effect('falls back to synchronous meshing when worker errors', () =>
    withBrowserWorkerMock(
      ErroringWorker,
      Effect.gen(function* () {
        const pool = yield* MeshingWorkerPool
        expect(pool.workerCount).toBeGreaterThan(0)

        const result = yield* pool.meshChunk(makeChunk())
        expect(result.opaque.positions.length).toBeGreaterThan(0)
        expect(result.opaque.indices.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(MeshingWorkerPool.Default))
    )
  )

  it.effect('a single transient timeout falls back to sync for that chunk but keeps the pool enabled (the next chunk still tries the worker)', () =>
    withBrowserWorkerMock(
      HungWorker,
      Effect.gen(function* () {
        hungPostMessageCount = 0
        const pool = yield* MeshingWorkerPool
        expect(pool.workerCount).toBeGreaterThan(0)

        const firstFiber = yield* pool.meshChunk(makeChunk()).pipe(Effect.fork)
        yield* TestClock.adjust('3 seconds')
        const firstResult = yield* Fiber.join(firstFiber)

        // The next chunk STILL attempts the worker — a single timeout no longer permanently
        // routes everything to the main thread (the cliff that tanked frame times).
        const secondFiber = yield* pool.meshChunk(makeChunk()).pipe(Effect.fork)
        yield* TestClock.adjust('3 seconds')
        const secondResult = yield* Fiber.join(secondFiber)

        expect(firstResult.opaque.positions.length).toBeGreaterThan(0)
        expect(secondResult.opaque.positions.length).toBeGreaterThan(0)
        expect(hungPostMessageCount).toBe(2) // both chunks re-attempted the worker
      }).pipe(
        Effect.provide(MeshingWorkerPool.Default),
        Effect.provide(TestContext.TestContext),
      )
    )
  )

  it.effect('disables the pool only after THRESHOLD consecutive timeouts, then routes later chunks straight to sync', () =>
    withBrowserWorkerMock(
      HungWorker,
      Effect.gen(function* () {
        // Mirrors MESHING_WORKER_FAILURE_THRESHOLD in meshing-worker-config.ts.
        const THRESHOLD = 3
        hungPostMessageCount = 0
        const pool = yield* MeshingWorkerPool
        expect(pool.workerCount).toBeGreaterThan(0)

        // THRESHOLD consecutive timeouts: each posts to the worker, times out, syncs.
        for (let i = 0; i < THRESHOLD; i++) {
          const fiber = yield* pool.meshChunk(makeChunk()).pipe(Effect.fork)
          yield* TestClock.adjust('3 seconds')
          const result = yield* Fiber.join(fiber)
          expect(result.opaque.positions.length).toBeGreaterThan(0)
        }
        expect(hungPostMessageCount).toBe(THRESHOLD)

        // Breaker tripped — the pool is now disabled, so this chunk goes straight to sync
        // with NO worker post and NO 3-second wait.
        const afterResult = yield* pool.meshChunk(makeChunk())
        expect(afterResult.opaque.positions.length).toBeGreaterThan(0)
        expect(hungPostMessageCount).toBe(THRESHOLD) // unchanged: worker no longer used
      }).pipe(
        Effect.provide(MeshingWorkerPool.Default),
        Effect.provide(TestContext.TestContext),
      )
    )
  )

  it.effect('SEC-W1: releasePrevCachedMesh evicts the sync mesher prev cache so the next dirty-AABB call falls back to a full re-mesh', () =>
    Effect.gen(function* () {
      subregionSpy.mockClear()
      const pool = yield* MeshingWorkerPool
      // Sync fallback path: Worker is undefined in vitest node env.
      expect(pool.workerCount).toBe(0)

      const coord: ChunkCoord = { x: 7, z: 11 }
      const chunk = makeChunk(coord)
      const dirtyAABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }

      // 1) First call (no dirtyAABB) populates the prev cache for `coord`.
      yield* pool.meshChunk(chunk)
      expect(subregionSpy).toHaveBeenCalledTimes(0)

      // 2) Second call WITH dirtyAABB takes the splice path (cache hit).
      yield* pool.meshChunk(chunk, { dirtyAABB })
      expect(subregionSpy).toHaveBeenCalledTimes(1)

      // 3) Release the cached prev for `coord`.
      yield* pool.releasePrevCachedMesh(coord)

      // 4) Third call WITH dirtyAABB now falls back to a full re-mesh
      // (the splice path requires a cached prev). Spy count stays at 1.
      const result = yield* pool.meshChunk(chunk, { dirtyAABB })
      expect(subregionSpy).toHaveBeenCalledTimes(1)
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.opaque.indices.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(MeshingWorkerPool.Default))
  )

  it.effect('bounds the sync mesher prev cache and keeps recent entries spliceable', () =>
    Effect.gen(function* () {
      subregionSpy.mockClear()
      const pool = yield* MeshingWorkerPool
      expect(pool.workerCount).toBe(0)

      const dirtyAABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
      const chunks = Array.from({ length: MAX_SYNC_PREV_MESH_CACHE_ENTRIES + 1 }, (_, index) => makeChunk({ x: 1000 + index, z: 0 }))

      for (const chunk of chunks) {
        yield* pool.meshChunk(chunk)
      }

      // The first chunk is the oldest cache entry and should have been
      // evicted, so a dirty update for it must fall back to a full re-mesh.
      const evictedResult = yield* pool.meshChunk(chunks[0]!, { dirtyAABB })
      expect(subregionSpy).toHaveBeenCalledTimes(0)
      expect(evictedResult.opaque.positions.length).toBeGreaterThan(0)

      // A recent chunk should still be cached and use the sub-region splice.
      const cachedResult = yield* pool.meshChunk(chunks[chunks.length - 1]!, { dirtyAABB })
      expect(subregionSpy).toHaveBeenCalledTimes(1)
      expect(cachedResult.opaque.positions.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(MeshingWorkerPool.Default))
  )

  it.effect('SEC-W1: releasePrevCachedMesh on an unknown coord is a no-op', () =>
    Effect.gen(function* () {
      const pool = yield* MeshingWorkerPool
      // Should not throw / fail.
      yield* pool.releasePrevCachedMesh({ x: 999, z: -999 })
      const result = yield* pool.meshChunk(makeChunk())
      expect(result.opaque.positions.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(MeshingWorkerPool.Default))
  )

  it.effect('transfers a sliced fluid buffer when the chunk carries fluid data', () =>
    withBrowserWorkerMock(
      CapturingWorker,
      Effect.gen(function* () {
        lastPostedMessage = undefined
        lastTransferList = []

        const pool = yield* MeshingWorkerPool
        const baseChunk = makeChunk()
        const fluid = new Uint8Array(baseChunk.blocks.length)
        fluid[0] = 0x8f
        const chunk = { ...baseChunk, fluid: Option.some(fluid) } satisfies Chunk

        yield* pool.meshChunk(chunk)

        expect(typeof lastPostedMessage).toBe('object')
        expect(lastPostedMessage).not.toBeNull()
        if (typeof lastPostedMessage !== 'object' || lastPostedMessage === null) {
expect.fail('Expected worker message payload')
        }

        const fluidPayload = 'fluid' in lastPostedMessage ? lastPostedMessage['fluid'] : null
        expect(fluidPayload).toBeInstanceOf(ArrayBuffer)
        expect(fluidPayload).not.toBe(fluid.buffer)
        expect((fluidPayload as ArrayBuffer).byteLength).toBe(fluid.byteLength)
        expect(lastTransferList).toContain(fluidPayload as ArrayBuffer)
        expect(Option.isSome(chunk.fluid)).toBe(true)
        expect(fluid[0]).toBe(0x8f)
      }).pipe(Effect.provide(MeshingWorkerPool.Default))
    )
  )
})
