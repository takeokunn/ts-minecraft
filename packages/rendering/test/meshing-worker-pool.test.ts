import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { Effect, Fiber, Option, TestClock, TestContext } from 'effect'
import { MeshingWorkerPool } from '@ts-minecraft/rendering'
import type { Chunk } from '../../terrain'

const makeChunk = (): Chunk => ({
  coord: { x: 0, z: 0 },
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

  it.effect('disables workers after a hung worker timeout so later chunks do not wait again', () =>
    withBrowserWorkerMock(
      HungWorker,
      Effect.gen(function* () {
        hungPostMessageCount = 0
        const pool = yield* MeshingWorkerPool
        expect(pool.workerCount).toBeGreaterThan(0)

        const firstFiber = yield* pool.meshChunk(makeChunk()).pipe(Effect.fork)
        yield* TestClock.adjust('3 seconds')
        const firstResult = yield* Fiber.join(firstFiber)

        const secondResult = yield* pool.meshChunk(makeChunk())

        expect(firstResult.opaque.positions.length).toBeGreaterThan(0)
        expect(firstResult.opaque.indices.length).toBeGreaterThan(0)
        expect(secondResult.opaque.positions.length).toBeGreaterThan(0)
        expect(secondResult.opaque.indices.length).toBeGreaterThan(0)
        expect(hungPostMessageCount).toBe(1)
      }).pipe(
        Effect.provide(MeshingWorkerPool.Default),
        Effect.provide(TestContext.TestContext),
      )
    )
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
          throw new Error('Expected worker message payload')
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
