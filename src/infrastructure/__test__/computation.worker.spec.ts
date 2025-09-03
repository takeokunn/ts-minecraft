import { Effect, Fiber, Layer, Scope } from 'effect'
import { describe, it, assert, vi, beforeEach } from '@effect/vitest'
import { ComputationWorker } from '@/runtime/services'
import { ComputationWorkerLive } from '../computation.worker'
import { IncomingMessage, OutgoingMessage } from '@/workers/messages'
import { Int } from '@/domain/common'

// Mock Worker
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}
vi.stubGlobal('Worker', vi.fn(() => mockWorker))

describe('ComputationWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const ComputationWorkerLayer = Layer.provide(
    ComputationWorkerLive,
    Layer.scoped(Scope.Scope, Scope.make()),
  )

  it.effect('should post a task to the worker', () =>
    Effect.gen(function* (_) {
      const workerService = yield* _(ComputationWorker)
      const task: IncomingMessage = {
        type: 'generateChunk',
        chunkX: 0 as Int,
        chunkZ: 0 as Int,
        seeds: { world: 1, biome: 1, trees: 1 },
        amplitude: 1,
        editedBlocks: {
          destroyed: [],
          placed: {},
        },
      }
      yield* _(workerService.postTask(task))
      assert.isTrue(vi.mocked(mockWorker.postMessage).mock.calls.length === 1)
      assert.deepStrictEqual(vi.mocked(mockWorker.postMessage).mock.calls[0][0], task)
    }).pipe(Effect.provide(ComputationWorkerLayer)))

  it.effect('should receive messages from the worker', () =>
    Effect.gen(function* (_) {
      const workerService = yield* _(ComputationWorker)
      const fiber = yield* _(
        workerService.onMessage((msg) => Effect.log(msg)),
        Effect.fork,
      )

      const messageFromWorker: OutgoingMessage = {
        type: 'chunkGenerated',
        chunkX: 0 as Int,
        chunkZ: 0 as Int,
        blocks: [],
        mesh: {
          positions: new Float32Array(),
          normals: new Float32Array(),
          uvs: new Float32Array(),
          indices: new Uint32Array(),
        },
      }
      const messageEvent = new MessageEvent('message', { data: messageFromWorker })

      const messageListenerCall = vi.mocked(mockWorker.addEventListener).mock.calls.find(
        (call) => call[0] === 'message',
      )
      assert.isDefined(messageListenerCall)

      const messageListener = messageListenerCall?.[1]
      assert.isDefined(messageListener)

      if (messageListener) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        messageListener(messageEvent)
      }

      yield* _(Effect.yieldNow())
      yield* _(Fiber.interrupt(fiber))
    }).pipe(Effect.provide(ComputationWorkerLayer)))
})
