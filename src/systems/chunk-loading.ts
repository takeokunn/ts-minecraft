import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { GenerateChunkCommand } from '@/domain/types';
import { EntityId } from '@/domain/entity';

export const CHUNK_SIZE = 10;

type ChunkCoord = { x: number; z: number };

export const calculateChunkUpdates = (
  currentPlayerChunk: ChunkCoord,
  loadedChunks: Map<string, EntityId>,
  renderDistance: number,
): {
  toLoad: ChunkCoord[];
  toUnload: EntityId[];
} => {
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

  const toUnload: EntityId[] = [];
  for (const [key, chunkEntityId] of loadedChunks.entries()) {
    if (!requiredChunks.has(key)) {
      toUnload.push(chunkEntityId);
    }
  }

  const toLoad: ChunkCoord[] = [];
  for (const key of requiredChunks) {
    if (!loadedChunks.has(key)) {
      const [xStr, zStr] = key.split(',');
      toLoad.push({ x: parseInt(xStr, 10), z: parseInt(zStr, 10) });
    }
  }

  return { toLoad, toUnload };
};

const getOrCreateChunkLoader = (world: World) => {
  const loaders = (world as any).queries.chunkLoader(world);
  if (loaders.length > 0) {
    return loaders[0];
  }
  const loaderEid = world.createEntity();
  const loaderState = {
    currentPlayerChunkX: Infinity,
    currentPlayerChunkZ: Infinity,
  };
  (world as any).components.chunkLoaderState.set(loaderEid, loaderState);
  return {
    entityId: loaderEid,
    chunkLoaderState: loaderState,
  };
};

export const chunkLoadingSystem = Effect.gen(function* ($) {
  const world = yield* $(World as any);
  const players = (world as any).queries.player(world);
  if (players.length === 0) {
    return [];
  }
  const player = players[0];
  const { position: playerPosition } = player;

  const loader = getOrCreateChunkLoader(world);
  const { entityId: loaderId, chunkLoaderState } = loader;

  const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);

  if (
    playerChunkX === chunkLoaderState.currentPlayerChunkX &&
    playerChunkZ === chunkLoaderState.currentPlayerChunkZ
  ) {
    return [];
  }

  (world as any).components.chunkLoaderState.set(loaderId, {
    currentPlayerChunkX: playerChunkX,
    currentPlayerChunkZ: playerChunkZ,
  });

  const loadedChunks = new Map<string, EntityId>();
  const chunks = (world as any).queries.chunk(world);
  for (const chunk of chunks) {
    loadedChunks.set(
      `${chunk.chunk.x},${chunk.chunk.z}`,
      chunk.entityId,
    );
  }

  const { toLoad, toUnload } = calculateChunkUpdates(
    { x: playerChunkX, z: playerChunkZ },
    loadedChunks,
    (world as any).globalState.chunk.renderDistance,
  );

  yield* $(Effect.forEach(toUnload, (id) => world.removeEntity(id)));

  const commands: GenerateChunkCommand[] = toLoad.map(
    ({ x, z }) => ({
      _tag: 'GenerateChunk',
      chunkX: x,
      chunkZ: z,
    }),
  );

  return commands;
});