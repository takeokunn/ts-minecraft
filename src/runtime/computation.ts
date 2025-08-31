import { ChunkGenerationResult, ComputationTask } from "@/workers/computation.worker";
import { Context, Effect, Layer, Pool, Queue } from "effect";

const MAX_WORKERS = navigator.hardwareConcurrency || 4;

export interface ComputationService {
  readonly generateChunk: (
    params: ComputationTask["payload"],
  ) => Effect.Effect<void>;
  readonly resultsQueue: Queue.Queue<ChunkGenerationResult>;
}

export const ComputationService = Context.GenericTag<ComputationService>(
  "ComputationService",
);

export const ComputationServiceLive = Layer.scoped(
  ComputationService,
  Effect.gen(function* (_) {
    const resultsQueue = yield* _(Queue.unbounded<ChunkGenerationResult>());

    const workerPool = yield* _(
      Pool.make({
        acquire: Effect.sync(
          () => new Worker(new URL("../workers/computation.worker.ts", import.meta.url), { type: "module" }),
        ),
        release: (worker) => Effect.sync(() => worker.terminate()),
        size: MAX_WORKERS,
      }),
    );

    yield* _(
      Effect.scoped(
        workerPool.get.pipe(
          Effect.flatMap((worker) =>
            Effect.async<never, never, void>((resume) => {
              worker.onmessage = (
                ev: MessageEvent<ChunkGenerationResult>,
              ) => {
                Effect.runFork(resultsQueue.offer(ev.data));
              };
              worker.onerror = (err) => {
                console.error("Computation worker error:", err);
              };
              // This worker will be released when the scope closes
            }),
          ),
          Effect.forever,
        ),
      ),
      Effect.forkScoped,
    );

    const generateChunk = (params: ComputationTask["payload"]) =>
      Effect.gen(function* (_) {
        const task: ComputationTask = {
          type: "generateChunk",
          payload: params,
        };
        // This will acquire a worker, post a message, and release it automatically
        yield* _(
          Effect.scoped(
            workerPool.get.pipe(
              Effect.map((worker) => worker.postMessage(task)),
            ),
          ),
        );
      });

    return { generateChunk, resultsQueue };
  }),
);