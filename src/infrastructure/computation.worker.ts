import { ComputationWorker, PlacedBlock } from '@/runtime/services'
import { Effect, Layer, Queue } from 'effect'

type Message = {
  type: 'chunkGenerated'
  chunkX: number
  chunkZ: number
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  blocks: ReadonlyArray<PlacedBlock>
}

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
    const messageQueue = yield* _(Queue.unbounded<Message>())

    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          const handleMessage = (event: MessageEvent<Message>) => {
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

    const postTask = (task: {
      type: 'generateChunk'
      chunkX: number
      chunkZ: number
    }) =>
      Effect.try(() => {
        worker.postMessage(task)
      })

    const onMessage = (handler: (message: Message) => Effect.Effect<void>) =>
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