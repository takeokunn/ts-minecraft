
import { Effect, Layer, Pool } from 'effect';
import {
  ComputationResult,
  ComputationTask,
} from '../workers/computation.worker';
import { ComputationWorker } from '../runtime/services';

const createWorker = () =>
  Effect.sync(() => new Worker(new URL('../workers/computation.worker.ts', import.meta.url), { type: 'module' }));

const releaseWorker = (worker: Worker) => Effect.sync(() => worker.terminate());

export const ComputationWorkerLive = Layer.scoped(
  ComputationWorker,
  Effect.gen(function* (_) {
    const pool = yield* _(
      Pool.make({
        acquire: createWorker(),
        size: navigator.hardwareConcurrency || 2,
      }),
    );

    const postTask = <T extends ComputationTask>(
      task: T,
    ): Effect.Effect<ComputationResult<T>> =>
      Effect.scoped(
        pool.get.pipe(
          Effect.flatMap((worker) =>
            Effect.async<ComputationResult<T>>((resume) => {
              worker.onmessage = (e: MessageEvent<ComputationResult<T>>) => {
                resume(Effect.succeed(e.data));
              };
              worker.onerror = (e) => {
                resume(Effect.fail(new Error(e.message)));
              };
              worker.postMessage(task);
            }),
          ),
        ),
      );

    return { postTask };
  }),
);
