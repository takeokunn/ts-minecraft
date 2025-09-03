import { Effect, Fiber, Layer, Scope } from 'effect'
import { describe, it, assert, vi, beforeEach } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { ComputationWorker } from '@/runtime/services'
import { ComputationWorkerLive } from '../computation.worker'
import { IncomingMessage, OutgoingMessage, IncomingMessageSchema, OutgoingMessageSchema } from '@/workers/messages'
import * as Arbitrary from 'effect/Arbitrary'

// Mock Worker
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}
vi.stubGlobal('Worker', vi.fn(() => mockWorker))

const IncomingMessageArb = Arbitrary.make(IncomingMessageSchema)(fc)
const OutgoingMessageArb = Arbitrary.make(OutgoingMessageSchema)(fc)

describe('ComputationWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const ComputationWorkerLayer = ComputationWorkerLive

  it.effect('should post any valid task to the worker', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(IncomingMessageArb, async (task) =>
              Effect.gen(function* (_) {
                const workerService = yield* _(ComputationWorker)
                vi.clearAllMocks()
                yield* _(workerService.postTask(task))
                assert.isTrue(vi.mocked(mockWorker.postMessage).mock.calls.length === 1)
                assert.deepStrictEqual(vi.mocked(mockWorker.postMessage).mock.calls[0][0], task)
              }).pipe(Effect.provide(ComputationWorkerLayer), Effect.runPromise),
            ),
          ),
        ),
      )
    }))

  it.effect('should receive any valid message from the worker', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(OutgoingMessageArb, async (messageFromWorker) =>
              Effect.gen(function* (_) {
                const workerService = yield* _(ComputationWorker)
                const receivedMessages: OutgoingMessage[] = []
                const fiber = yield* _(
                  workerService.onMessage((msg) =>
                    Effect.sync(() => {
                      receivedMessages.push(msg)
                    }),
                  ),
                  Effect.fork,
                )

                const messageEvent = new MessageEvent('message', { data: messageFromWorker })
                const messageListenerCall = vi.mocked(mockWorker.addEventListener).mock.calls.find(
                  (call) => call[0] === 'message',
                )
                assert.isDefined(messageListenerCall)
                const messageListener = messageListenerCall?.[1]
                assert.isDefined(messageListener)

                if (messageListener) {
                  // @ts-expect-error - Mocking event listener
                  messageListener(messageEvent)
                }

                yield* _(Effect.yieldNow())
                yield* _(Fiber.interrupt(fiber))

                assert.lengthOf(receivedMessages, 1)
                assert.deepStrictEqual(receivedMessages[0], messageFromWorker)
              }).pipe(Effect.provide(ComputationWorkerLayer), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})
