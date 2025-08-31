import { Chunk, Effect, Layer, Queue } from "effect";
import { RenderCommand, RenderQueue } from "./services";

export const RenderQueueLive = Layer.effect(
  RenderQueue,
  Effect.gen(function* (_) {
    const queue = yield* _(Queue.unbounded<RenderCommand>());

    return RenderQueue.of({
      offer: (command) => queue.offer(command),
      takeAll: () => queue.takeAll,
    });
  }),
);
