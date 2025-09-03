import { ComputationWorker } from '@/runtime/services'
import { Effect, Layer, Hub } from 'effect'

type Message = {
  type: 'chunkGenerated'
  chunkX: number
  chunkZ: number
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  blocks: unknown[]
}

export const ComputationWorkerLive = Layer.scoped(
  ComputationWorker,
  Effect.gen(function* (_) {
    const worker = yield* _(
      Effect.acquireRelease(
        Effect.sync(() => new Worker(new URL('../workers/computation.worker.ts', import.meta.url), { type: 'module' })),
        (worker) => Effect.sync(() => worker.terminate()),
      ),
    )
    const messageHub = yield* _(Hub.unbounded<Message>())

    const handleMessage = (event: MessageEvent<Message>) => {
      Effect.runFork(Hub.publish(messageHub, event.data))
    }
    const handleError = (error: ErrorEvent) => {
      Effect.runFork(Effect.logError('Computation Worker Error:', error))
    }

    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          worker.addEventListener('message', handleMessage)
          worker.addEventListener('error', handleError)
        }),
        () =>
          Effect.sync(() => {
            worker.removeEventListener('message', handleMessage)
            worker.removeEventListener('error', handleError)
          }),
      ),
    )

    const postTask = (task: { type: 'generateChunk'; chunkX: number; chunkZ: number }) =>
      Effect.try(() => {
        worker.postMessage(task)
      })

    const onMessage = (handler: (message: Message) => Effect.Effect<void>) =>
      Hub.subscribe(messageHub).pipe(
        Effect.flatMap((subscription) =>
          Effect.forever(
            subscription.take.pipe(
              Effect.flatMap(handler),
              Effect.catchAll((error) => Effect.logError(error)),
            ),
          ),
        ),
        Effect.forkScoped,
        Effect.void,
      )

    return ComputationWorker.of({
      postTask,
      onMessage,
    })
  }),
)
