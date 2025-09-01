import { query, removeEntity } from '@/runtime/world';
import { System } from '@/runtime/loop';
import { RENDER_DISTANCE, CHUNK_SIZE } from '@/domain/world-constants';
import { playerQuery } from '@/domain/queries';
import { EntityId, SystemCommand } from '@/domain/types';

type ChunkCoord = { readonly x: number; readonly z: number };

export const calculateChunkUpdates = (
  currentPlayerChunk: ChunkCoord,
  loadedChunks: ReadonlyMap<string, EntityId>,
  renderDistance: number,
): { toLoad: ChunkCoord[]; toUnload: EntityId[] } => {
  const requiredChunks = new Set<string>();
  for (
    let x = currentPlayerChunk.x - renderDistance;
    x <= currentPlayerChunk.x + renderDistance;
    x++
  ) {
    for (
      let z = currentPlayerChunk.z - renderDistance;
      z <= currentPlayerChunk.z + renderDistance;
      z++
    ) {
      requiredChunks.add(`${x},${z}`);
    }
  }

  const toUnload = [...loadedChunks.entries()]
    .filter(([key]) => !requiredChunks.has(key))
    .map(([, entityId]) => entityId);

  const toLoad: ChunkCoord[] = [...requiredChunks]
    .filter(key => !loadedChunks.has(key))
    .map(key => {
      const [xStr, zStr] = key.split(',');
      // This should be safe as we construct the keys ourselves
      return { x: parseInt(xStr!, 10), z: parseInt(zStr!, 10) };
    });

  return { toLoad, toUnload };
};

export const chunkLoadingSystem: System = (world, _deps) => {
  const player = query(world, playerQuery)[0];
  if (!player) {
    return [world, []];
  }

  const { position: playerPosition } = player;
  const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);

  const { lastPlayerChunk, loadedChunks } = world.globalState.chunkLoading;

  if (lastPlayerChunk?.x === playerChunkX && lastPlayerChunk?.z === playerChunkZ) {
    return [world, []];
  }

  const { toLoad, toUnload } = calculateChunkUpdates(
    { x: playerChunkX, z: playerChunkZ },
    loadedChunks,
    RENDER_DISTANCE,
  );

  // Create commands to generate new chunks
  const commands: SystemCommand[] = toLoad.map(({ x, z }) => ({
    _tag: 'GenerateChunk',
    chunkX: x,
    chunkZ: z,
  }));

  // Remove entities for unloaded chunks
  const worldAfterUnload = toUnload.reduce(
    (currentWorld, entityId) => removeEntity(currentWorld, entityId),
    world,
  );

  // Update the last known player chunk position
  const newWorld = {
    ...worldAfterUnload,
    globalState: {
      ...worldAfterUnload.globalState,
      chunkLoading: {
        ...worldAfterUnload.globalState.chunkLoading,
        lastPlayerChunk: {
          x: playerChunkX,
          z: playerChunkZ,
        },
      },
    },
  };

  return [newWorld, commands];
};
