import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
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

class HungWorker {
  onmessage: WorkerMessageHandler | null = null
  onerror: WorkerErrorHandler | null = null

  constructor(_url: string | URL, _options?: WorkerOptions) {}

  postMessage(_message: unknown): void {}

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
})
