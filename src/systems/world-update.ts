import { createArchetype } from '@/domain/archetypes';
import { System } from '@/runtime/loop';
import { addArchetype } from '@/runtime/world';

export const worldUpdateSystem: System = (
  world,
  { chunkDataQueue, renderQueue },
) => {
  // Process only one chunk per frame to distribute the load
  const chunkResult = chunkDataQueue.shift(); // This system has the side effect of consuming from the queue.
  if (!chunkResult) {
    return [world, []];
  }

  const { blocks, mesh, chunkX, chunkZ } = chunkResult;

  // 1. Create a single entity to represent the chunk itself.
  const chunkArchetype = { chunk: { chunkX, chunkZ } };
  const [worldWithChunk, chunkEntityId] = addArchetype(world, chunkArchetype);

  // 2. Create entities for each individual block within the chunk.
  const worldWithBlocks = blocks.reduce(
    (currentWorld, block) => {
      const blockArchetype = createArchetype({
        type: 'block',
        pos: block.position,
        blockType: block.blockType,
      });
      const [newWorld] = addArchetype(currentWorld, blockArchetype);
      return newWorld;
    },
    worldWithChunk,
  );

  // 3. If the mesh has geometry, add a command to render it.
  // This is another side effect.
  if (mesh.indices.length > 0) {
    renderQueue.push({
      _tag: 'UpsertChunk',
      chunkX,
      chunkZ,
      mesh: { mesh },
    });
  }

  // 4. Update the loaded chunks map in the global state.
  const newLoadedChunks = new Map(
    worldWithBlocks.globalState.chunkLoading.loadedChunks,
  );
  newLoadedChunks.set(`${chunkX},${chunkZ}`, chunkEntityId);

  const newWorld = {
    ...worldWithBlocks,
    globalState: {
      ...worldWithBlocks.globalState,
      chunkLoading: {
        ...worldWithBlocks.globalState.chunkLoading,
        loadedChunks: newLoadedChunks,
      },
    },
  };

  return [newWorld, []];
};
