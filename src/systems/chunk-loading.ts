import { Effect } from 'effect';
import {
  type Chunk,
  ChunkSchema,
  PlayerSchema,
  type Position,
  PositionSchema,
  TerrainBlockSchema,
} from '../domain/components';
import { GameState } from '../runtime/game-state';
import {
  deleteEntity,
  type QueryResult,
  query,
  type World,
} from '../runtime/world';
import { CHUNK_SIZE, generateChunk } from './generation';

const RENDER_DISTANCE = 2; // Render distance in chunks
let currentPlayerChunkX: number = Infinity;
let currentPlayerChunkZ: number = Infinity;

export const chunkLoadingSystem: Effect.Effect<void, never, GameState | World> =
  Effect.gen(function* (_) {
    const gameState: GameState = yield* _(GameState);
    const playerQuery: ReadonlyArray<
      QueryResult<[typeof PlayerSchema, typeof PositionSchema]>
    > = yield* _(query(PlayerSchema, PositionSchema));
    const player:
      | QueryResult<[typeof PlayerSchema, typeof PositionSchema]>
      | undefined = playerQuery[0];

    if (!player) return;

    const playerPosition: Position = player.get(PositionSchema);
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

    const chunksToLoad: Set<string> = new Set<string>();

    // Determine which chunks should be loaded
    for (
      let x: number = playerChunkX - RENDER_DISTANCE;
      x <= playerChunkX + RENDER_DISTANCE;
      x++
    ) {
      for (
        let z: number = playerChunkZ - RENDER_DISTANCE;
        z <= playerChunkZ + RENDER_DISTANCE;
        z++
      ) {
        const key: string = `${x},${z}`;
        chunksToLoad.add(key);
      }
    }

    // Unload old chunks efficiently
    const terrainEntities: ReadonlyArray<
      QueryResult<[typeof TerrainBlockSchema, typeof ChunkSchema]>
    > = yield* _(query(TerrainBlockSchema, ChunkSchema));
    const unloadingEffects: Effect.Effect<void, never, World>[] = [];
    for (const entity of terrainEntities) {
      const chunk: Chunk = entity.get(ChunkSchema);
      const key: string = `${chunk.x},${chunk.z}`;
      if (!chunksToLoad.has(key)) {
        unloadingEffects.push(deleteEntity(entity.id));
        gameState.world.chunkMap.delete(key);
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
    for (const key of chunksToLoad) {
      if (!gameState.world.chunkMap.has(key)) {
        const [x, z] = key.split(',').map(Number);
        if (x === undefined || z === undefined) {
          continue;
        }
        console.log(`Loading chunk: ${x}, ${z}`);
        gameState.world.chunkMap.set(key, new Set()); // Mark as loading/loaded
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
