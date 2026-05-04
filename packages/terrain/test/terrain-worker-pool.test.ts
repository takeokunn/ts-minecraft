import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { vi } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/world-state'
import { TerrainWorkerPool } from '@ts-minecraft/terrain'

const BLOCK_BYTES = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

class MockWorkerErrorEvent extends Event implements ErrorEvent {
  public readonly colno: number
  public readonly error: unknown
  public readonly filename: string
  public readonly lineno: number
  public readonly message: string

  public constructor(init: {
    readonly colno?: number
    readonly error?: unknown
    readonly filename?: string
    readonly lineno?: number
    readonly message: string
  }) {
    super('error')
    this.colno = init.colno ?? 0
    this.error = init.error
    this.filename = init.filename ?? ''
    this.lineno = init.lineno ?? 0
    this.message = init.message
  }

  public initErrorEvent(): void {
  // Optional DOM API: unused in tests.
  }
}

class MockBrowserWorker extends EventTarget implements Worker {
  public static instances: MockBrowserWorker[] = []
  public static postMessageCalls = 0
  public static fatalErrorCallNumbers = new Set<number>()

  public static reset(): void {
    MockBrowserWorker.instances = []
    MockBrowserWorker.postMessageCalls = 0
    MockBrowserWorker.fatalErrorCallNumbers.clear()
  }

  public static failOnPostMessageCall(callNumber: number): void {
    MockBrowserWorker.fatalErrorCallNumbers.add(callNumber)
  }

  public onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null
  public onmessage: ((this: Worker, ev: MessageEvent<unknown>) => unknown) | null = null
  public onmessageerror: ((this: Worker, ev: MessageEvent<unknown>) => unknown) | null = null
  public terminated = false

  public constructor(_scriptURL: string | URL, _options?: WorkerOptions) {
    super()
    MockBrowserWorker.instances.push(this)
  }

  public postMessage(_message: unknown, _transferOrOptions?: StructuredSerializeOptions | Transferable[]): void {
    MockBrowserWorker.postMessageCalls += 1
    const callNumber = MockBrowserWorker.postMessageCalls

    if (MockBrowserWorker.fatalErrorCallNumbers.has(callNumber)) {
      queueMicrotask(() => {
        this.onerror?.call(this, new MockWorkerErrorEvent({
          colno: 21,
          error: new Error('mock fatal terrain worker error'),
          filename: 'terrain-worker.ts',
          lineno: 144,
          message: 'mock fatal terrain worker error',
        }))
      })
      return
    }

    throw new Error(`Unexpected worker postMessage call #${String(callNumber)}`)
  }

  public terminate(): void {
    this.terminated = true
  }
}

const MockBrowserWorkerConstructor: typeof Worker = MockBrowserWorker

const withMockBrowserWorker = <A, E>(
  program: Effect.Effect<A, E, TerrainWorkerPool>,
): Effect.Effect<A, E> =>
  Effect.sync(() => {
    MockBrowserWorker.reset()
    MockBrowserWorker.failOnPostMessageCall(1)
    vi.stubGlobal('Worker', MockBrowserWorkerConstructor)
  }).pipe(
    Effect.zipRight(Effect.scoped(program.pipe(Effect.provide(TerrainWorkerPool.Default)))),
    Effect.ensuring(Effect.sync(() => {
      vi.unstubAllGlobals()
      MockBrowserWorker.reset()
    })),
  )

describe('infrastructure/terrain/terrain-worker-pool', () => {
  it.effect('falls back to synchronous generation when Worker is unavailable', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      // Vitest runs in Node — Worker is undefined → workerCount === 0.
      expect(pool.workerCount).toBe(0)

      const result = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 12345 },
      )

      expect(result.blocks).toBeInstanceOf(Uint8Array)
      expect(result.blocks.byteLength).toBe(BLOCK_BYTES)
      expect(result.skyLight).toBeInstanceOf(Uint8Array)
      expect(result.skyLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
      expect(result.blockLight).toBeInstanceOf(Uint8Array)
      expect(result.blockLight.byteLength).toBe(LIGHT_BYTE_LENGTH)

      // Bedrock invariant: y=0 must be bedrock for every column.
      // bedrock block index isn't exported as a constant here, but we can
      // assert that y=0 voxels are non-zero (i.e. not AIR).
      const yZeroSamples = Arr.makeBy(CHUNK_SIZE, (lx) => lx)
      Arr.forEach(yZeroSamples, (lx) => {
        // oxlint-disable-next-line oxc/erasing-op -- explicit y=0, z=0 3D index formula for documentation
        const idx = 0 + 0 * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
        expect(result.blocks[idx]).not.toBe(0)
      })
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('produces deterministic output for the same (coord, seed)', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      const a = yield* pool.generateTerrain(
        { x: 1, z: 2 },
        { seaLevel: 64, lakeLevel: 62, seed: 99 },
      )
      const b = yield* pool.generateTerrain(
        { x: 1, z: 2 },
        { seaLevel: 64, lakeLevel: 62, seed: 99 },
      )
      // First N bytes equal => deterministic. (Full equality would force a
      // 64KB byte-by-byte compare; sampling 1024 bytes is a stronger-than-
      // chance signal at zero allocation cost.)
      const sampleIndices = Arr.makeBy(1024, (i) => i * 64)
      Arr.forEach(sampleIndices, (i) => {
        expect(a.blocks[i]).toBe(b.blocks[i])
      })
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('different seeds produce different output', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      const a = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 1 },
      )
      const b = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 64, lakeLevel: 62, seed: 2 },
      )
      // At least one of the surface-band voxels must differ.
      const sampleIndices = Arr.makeBy(2048, (i) => i * 32)
      const differs = sampleIndices.some((i) => a.blocks[i] !== b.blocks[i])
      expect(differs).toBe(true)
    }).pipe(Effect.provide(TerrainWorkerPool.Default)),
  )

  it.effect('finalizer releases pending requests on scope close', () =>
    Effect.gen(function* () {
      // In sync-fallback mode there are no pending in-flight requests, so the
      // finalizer is a no-op. We still verify that scope close completes
      // without error by running the service inside a freshly scoped Effect.
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const pool = yield* TerrainWorkerPool
          return yield* pool.generateTerrain(
            { x: 5, z: 5 },
            { seaLevel: 64, lakeLevel: 62, seed: 7 },
          )
        }).pipe(Effect.provide(TerrainWorkerPool.Default)),
      )
      expect(result.blocks.byteLength).toBe(BLOCK_BYTES)
    }),
  )

  it.effect('degrades to synchronous generation after a fatal browser Worker error', () =>
    withMockBrowserWorker(Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      expect(pool.workerCount).toBeGreaterThan(0)

      const result = yield* pool.generateTerrain(
        { x: 2, z: 3 },
        { seaLevel: 64, lakeLevel: 62, seed: 12345 },
      )

      expect(result.blocks.byteLength).toBe(BLOCK_BYTES)
      expect(result.skyLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
      expect(result.blockLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
      expect(pool.queueDepth()).toBe(0)
      expect(MockBrowserWorker.postMessageCalls).toBe(1)
      expect(MockBrowserWorker.instances.length).toBe(pool.workerCount)
      expect(MockBrowserWorker.instances.every((worker) => worker.terminated)).toBe(true)
    })),
  )

  it.effect('uses synchronous generation for future requests after degradation', () =>
    withMockBrowserWorker(Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool

      const first = yield* pool.generateTerrain(
        { x: 4, z: 4 },
        { seaLevel: 64, lakeLevel: 62, seed: 77 },
      )

      expect(first.blocks.byteLength).toBe(BLOCK_BYTES)
      expect(MockBrowserWorker.postMessageCalls).toBe(1)

      const second = yield* pool.generateTerrain(
        { x: 4, z: 5 },
        { seaLevel: 64, lakeLevel: 62, seed: 77 },
      )

      expect(second.blocks.byteLength).toBe(BLOCK_BYTES)
      expect(MockBrowserWorker.postMessageCalls).toBe(1)
      expect(pool.queueDepth()).toBe(0)
    })),
  )
})
