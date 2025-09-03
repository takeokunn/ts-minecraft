import { Effect, Layer, Duration, Queue, Scope } from 'effect'
import { describe, it, assert, vi, beforeEach } from '@effect/vitest'
import { ComputationWorker, PlacedBlock } from '@/runtime/services'
import { ComputationWorkerLive } from '../computation.worker'

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

  it.effect('should post a task to the worker', () =>
    Effect.gen(function* (_) {
      const workerService = yield* _(ComputationWorker)
      const task = { type: 'generateChunk' as const, chunkX: 0, chunkZ: 0 }
      yield* _(workerService.postTask(task))
      assert.isTrue(vi.mocked(mockWorker.postMessage).mock.calls.length === 1)
      assert.deepStrictEqual(vi.mocked(mockWorker.postMessage).mock.calls[0][0], task)
    }).pipe(Effect.provide(ComputationWorkerLive)))

  it.effect('should receive messages from the worker', () =>
    Effect.scoped(
      Effect.gen(function* (_) {
        const workerService = yield* _(ComputationWorker)
        const receivedMessage = yield* _(Queue.unbounded<any>())

        yield* _(
          workerService.onMessage((msg) =>
            Queue.offer(receivedMessage, msg)
          ),
        )

        // Simulate a message from the worker
        const messageFromWorker = { type: 'chunkGenerated', chunkX: 0, chunkZ: 0, blocks: [] as PlacedBlock[] }
        const messageEvent = new MessageEvent('message', { data: messageFromWorker })

        // Find the 'message' event listener and call it
        const messageListener = vi.mocked(mockWorker.addEventListener).mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1]

        assert.isDefined(messageListener)
        if (messageListener) {
          // @ts-expect-error
          messageListener(messageEvent)
        }

        const msg = yield* _(Queue.take(receivedMessage))

        assert.deepStrictEqual(msg, messageFromWorker)
      })
    ).pipe(Effect.provide(ComputationWorkerLive)))
})
