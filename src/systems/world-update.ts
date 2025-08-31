import { createBlock } from "@/domain/archetypes";
import { ChunkDataQueue, RenderQueue, UpsertChunkRenderCommand } from "@/runtime/services";
import { Effect, Option } from "effect";

/**
 * This system takes generated chunk data from the ChunkDataQueue
 * and applies it to the world, then sends the mesh data to the render queue.
 * It processes one chunk per frame to avoid blocking the main thread.
 */
export const worldUpdateSystem = Effect.gen(function* (_) {
  const chunkDataQueue = yield* _(ChunkDataQueue);
  const renderQueue = yield* _(RenderQueue);

  const chunkResultOption = yield* _(chunkDataQueue.take);
  if (Option.isNone(chunkResultOption)) {
    return;
  }

  const { blocks, mesh, chunkX, chunkZ } = chunkResultOption.value;

  // 1. Send mesh data to the renderer
  if (mesh.indices.length > 0) {
    const command: UpsertChunkRenderCommand = {
      _tag: "UpsertChunk",
      chunkX,
      chunkZ,
      mesh,
    };
    yield* _(renderQueue.offer(command));
  }

  // 2. Create block entities in the world
  if (blocks.length > 0) {
    const creationEffects = blocks.map((block) =>
      createBlock({ x: block.x, y: block.y, z: block.z }, block.blockType),
    );
    yield* _(Effect.all(creationEffects, { discard: true, concurrency: "unbounded" }));
  }
});