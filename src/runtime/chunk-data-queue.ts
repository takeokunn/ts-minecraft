
import { Effect, Layer, Queue } from 'effect';
import {
  ChunkDataQueue,
  type ChunkGenerationResult,
} from './services';

export const ChunkDataQueueLive = Layer.effect(
  ChunkDataQueue,
  Effect.gen(function* (_) {
    const queue = yield* _(Queue.unbounded<ChunkGenerationResult>());

    return ChunkDataQueue.of({
      offer: (chunkData) => queue.offer(chunkData),
      take: () => queue.take.pipe(Effect.asSome, Effect.race(Effect.succeedNone)),
    });
  }),
);
