import { Effect } from 'effect';
import { Chunk, Player, Position, TerrainBlock } from '../domain/components';
import { GameState } from '../runtime/game-state';
import { World } from '../runtime/world';
import { CHUNK_SIZE, generateChunk } from './generation';

const RENDER_DISTANCE = 2; // Render distance in chunks
let currentPlayerChunkX: number = Infinity;
let currentPlayerChunkZ: number = Infinity;

// Note: This system is stateful (`currentPlayerChunkX`, `currentPlayerChunkZ`).
// A more robust implementation might store this state within a Ref or the GameState service.
export const chunkLoadingSystem: Effect.Effect<void, never, GameState | World> =
  Effect.gen(function* (_) {
    const world = yield* _(World);
    const gameState = yield* _(GameState);

    const playerOption = yield* _(world.querySingle(Player, Position));

    if (Option.isNone(playerOption)) {
      return;
    }

    const [_id, [_player, playerPosition]] = playerOption.value;
    const playerChunkX: number = Math.floor(playerPosition.x / CHUNK_SIZE);
    const playerChunkZ: number = Math.floor(playerPosition.z / CHUNK_SIZE);

    // Only run logic if the player has changed chunks
    if (
      playerChunkX === currentPlayerChunkX &&
      playerChunkZ === currentPlayerChunkZ
    ) {
      return;
    }

    console.log(`Player moved to chunk: ${playerChunkX}, ${playerChunkZ}`);
    currentPlayerChunkX = playerChunkX;
    currentPlayerChunkZ = playerChunkZ;

    const chunksToLoad = new Map<string, { x: number; z: number }>();

    // Determine which chunks should be loaded
    for (
      let x = playerChunkX - RENDER_DISTANCE;
      x <= playerChunkX + RENDER_DISTANCE;
      x++
    ) {
      for (
        let z = playerChunkZ - RENDER_DISTANCE;
        z <= playerChunkZ + RENDER_DISTANCE;
        z++
      ) {
        const key = `${x},${z}`;
        chunksToLoad.set(key, { x, z });
      }
    }

    // Unload old chunks
    const terrainEntities = yield* _(world.query(TerrainBlock, Chunk));
    const unloadingEffects: Effect.Effect<void, never, World>[] = [];
    const loadedChunks = new Map<string, boolean>();

    for (const [id, [_terrain, chunk]] of terrainEntities) {
      const key = `${chunk.x},${chunk.z}`;
      loadedChunks.set(key, true);
      if (!chunksToLoad.has(key)) {
        unloadingEffects.push(world.removeEntity(id));
      }
    }

    if (unloadingEffects.length > 0) {
      console.log(`Unloading ${unloadingEffects.length} entities.`);
      yield* _(
        Effect.all(unloadingEffects, { discard: true, concurrency: 'inherit' }),
      );
    }

    // Load new chunks
    const loadingEffects: Effect.Effect<void, never, GameState | World>[] = [];
    for (const [key, { x, z }] of chunksToLoad) {
      if (!loadedChunks.has(key)) {
        console.log(`Loading chunk: ${x}, ${z}`);
        loadingEffects.push(generateChunk(x, z));
      }
    }

    if (loadingEffects.length > 0) {
      console.log(`Loading ${loadingEffects.length} new chunks.`);
      yield* _(
        Effect.all(loadingEffects, { discard: true, concurrency: 'inherit' }),
      );
    }
  });
