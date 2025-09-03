import { ComputationWorker, IncomingMessage, OutgoingMessage } from '@/runtime/services'
import { Effect, Layer, Queue } from 'effect'

export const ComputationWorkerLive = Layer.scoped(
  ComputationWorker,
  Effect.gen(function* (_) {
    const worker = yield* _(
      Effect.acquireRelease(
        Effect.sync(
          () =>
            new Worker(
              new URL('../workers/computation.worker.ts', import.meta.url),
              { type: 'module' },
            ),
        ),
        (worker) => Effect.sync(() => worker.terminate()),
      ),
    )
    const messageQueue = yield* _(Queue.unbounded<OutgoingMessage>())

    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          const handleMessage = (event: MessageEvent<OutgoingMessage>) => {
            Queue.unsafeOffer(messageQueue, event.data)
          }
          const handleError = (error: ErrorEvent) => {
            Effect.runFork(Effect.logError('Computation Worker Error:', error))
          }
          worker.addEventListener('message', handleMessage)
          worker.addEventListener('error', handleError)
          return { handleMessage, handleError }
        }),
        ({ handleMessage, handleError }) =>
          Effect.sync(() => {
            worker.removeEventListener('message', handleMessage)
            worker.removeEventListener('error', handleError)
          }),
      ),
    )

    const postTask = (task: IncomingMessage) =>
      Effect.try(() => {
        worker.postMessage(task)
      }).pipe(Effect.catchAll((e) => Effect.logError(e)))

    const onMessage = (handler: (message: OutgoingMessage) => Effect.Effect<void>) =>
      Queue.take(messageQueue).pipe(
        Effect.flatMap(handler),
        Effect.catchAll((error) => Effect.logError(error)),
        Effect.forever,
        Effect.forkScoped,
        Effect.asVoid,
      )

    return ComputationWorker.of({
      postTask,
      onMessage,
    })
  }),
)

// For testing
export const ComputationWorkerTest = Layer.succeed(
  ComputationWorker,
  ComputationWorker.of({
    postTask: () => Effect.void,
    onMessage: () => Effect.void,
  }),
)