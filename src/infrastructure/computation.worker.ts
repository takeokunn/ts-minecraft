import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Pool from 'effect/Pool'
import type { ChunkGenerationResult, ComputationTask } from '@/domain/types'

// --- Error Type ---

export class WorkerError extends Error {
  readonly _tag = 'WorkerError'
  constructor(readonly reason: unknown) {
    super('A worker failed to execute a task.', { cause: reason })
    this.name = 'WorkerError'
  }
}

// --- Service Definition ---

export interface ComputationWorker {
  readonly postTask: (task: ComputationTask) => Effect.Effect<ChunkGenerationResult, WorkerError>
}

export const ComputationWorker = Context.Tag<ComputationWorker>()

// --- Live Implementation ---

export const ComputationWorkerLive = Layer.scoped(
  ComputationWorker,
  Effect.gen(function* () {
    const maxWorkers = navigator.hardwareConcurrency || 4

    const createWorker = Effect.acquireRelease(
      Effect.sync(
        () => new Worker(new URL('../workers/computation.worker.ts', import.meta.url), { type: 'module' }),
      ),
      (worker) => Effect.sync(() => worker.terminate()),
    )

    const workerPool = yield* Pool.make({ acquire: createWorker, size: maxWorkers })

    const postTask = (task: ComputationTask): Effect.Effect<ChunkGenerationResult, WorkerError> =>
      Effect.scoped(
        Effect.gen(function* () {
          const worker = yield* Pool.get(workerPool)
          return yield* Effect.async<ChunkGenerationResult, WorkerError>((resume) => {
            const handleMessage = (ev: MessageEvent<ChunkGenerationResult>) => {
              cleanUp()
              resume(Effect.succeed(ev.data))
            }
            const handleError = (err: ErrorEvent) => {
              cleanUp()
              resume(Effect.fail(new WorkerError(err)))
            }
            const cleanUp = () => {
              worker.removeEventListener('message', handleMessage)
              worker.removeEventListener('error', handleError)
            }

            worker.addEventListener('message', handleMessage, { once: true })
            worker.addEventListener('error', handleError, { once: true })
            worker.postMessage(task)
          })
        }),
      )

    return ComputationWorker.of({ postTask })
  }),
)
