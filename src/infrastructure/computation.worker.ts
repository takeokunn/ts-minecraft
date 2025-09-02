import { ChunkGenerationResult, ComputationTask, WorkerError } from '@/domain/types'
import { Context, Effect, Layer, Pool } from 'effect'

export { WorkerError } from '@/domain/types'

const createWorker = Effect.sync(() => new Worker(new URL('../workers/computation.worker.ts', import.meta.url)))

const createWorkerPool = Pool.make({
  acquire: createWorker,
  size: navigator.hardwareConcurrency || 4,
})

export class ComputationWorker extends Context.Tag('ComputationWorker')<
  ComputationWorker,
  {
    readonly postTask: (task: ComputationTask) => Effect.Effect<ChunkGenerationResult, WorkerError>
  }
>() {}

export const ComputationWorkerLive = Layer.scoped(
  ComputationWorker,
  Effect.gen(function* ($) {
    const pool = yield* $(createWorkerPool)
    const postTask = (task: ComputationTask) =>
      Effect.scoped(
        Effect.gen(function* ($) {
          const worker = yield* $(pool.get)
          return yield* $(
            Effect.async<ChunkGenerationResult, WorkerError>((resume) => {
              worker.onmessage = (e) => {
                if (e.data._tag === 'error') {
                  resume(Effect.fail(new WorkerError({ reason: e.data.error })))
                } else {
                  resume(Effect.succeed(e.data.result))
                }
              }
              worker.onerror = (e) => {
                resume(Effect.fail(new WorkerError({ reason: e.message })))
              }
              worker.postMessage(task)
            }),
          )
        }),
      )
    return { postTask }
  }),
)
