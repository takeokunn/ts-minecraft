import { ComputationWorker } from '@/runtime/services'
import { IncomingMessage, OutgoingMessage } from '@/workers/messages'
import { Effect, Layer, Scope } from 'effect'

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

    const onMessage = (handler: (message: OutgoingMessage) => Effect.Effect<void, never, Scope.Scope>) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const handleMessage = (event: MessageEvent<OutgoingMessage>) => {
            Effect.runFork(handler(event.data))
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
      ).pipe(Effect.forkScoped, Effect.asVoid)

    const postTask = (task: IncomingMessage) =>
      Effect.try(() => {
        worker.postMessage(task)
      }).pipe(Effect.catchAll((e) => Effect.logError(e)))

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
