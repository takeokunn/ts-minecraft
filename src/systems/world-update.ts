
import { Effect, Option, Queue } from 'effect';
import { World } from '@/runtime/world';
import {
  ChunkDataQueue,
  RenderQueue,
  UpsertChunkRenderCommand,
} from '@/domain/types';

export const worldUpdateSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const chunkDataQueue = yield* _(ChunkDataQueue);
  const renderQueue = yield* _(RenderQueue);

  const chunkResultOption = yield* _(Queue.poll(chunkDataQueue));

  if (Option.isNone(chunkResultOption)) {
    return;
  }

  const chunkResult = chunkResultOption.value;
  const { blocks, mesh, chunkX, chunkZ } = chunkResult;

  if (mesh.indices.length > 0) {
    const command: UpsertChunkRenderCommand = {
      _tag: 'UpsertChunk',
      chunkX,
      chunkZ,
      mesh,
    };
    yield* _(Queue.offer(renderQueue, command));
  }

  yield* _(
    Effect.forEach(blocks, (block) =>
      world.archetypes.createBlock(
        { x: block.x, y: block.y, z: block.z },
        block.blockType,
      ),
    ),
  );
});
