import { Effect } from "effect";
import { Chunk, Player, Position, TerrainBlock } from "../domain/components";
import { playerQuery } from "../domain/queries";
import { GameState } from "../runtime/game-state";
import { ChunkDataQueue, ComputationWorker } from "../runtime/services";
import {
  World,
  createEntity,
  getComponentStore,
  queryEntities,
  removeEntity,
} from "../runtime/world";
import { GenerateChunkTask } from "@/workers/computation.worker";
import { EntityId } from "@/domain/entity";

export const CHUNK_SIZE = 10;
const RENDER_DISTANCE = 2;
let currentPlayerChunkX: number = Infinity;
let currentPlayerChunkZ: number = Infinity;

export const chunkLoadingSystem: Effect.Effect<
  void,
  never,
  GameState | World | ComputationWorker | ChunkDataQueue
> = Effect.gen(function* (_) {
  const gameStateService = yield* _(GameState);
  const computationWorker = yield* _(ComputationWorker);
  const chunkDataQueue = yield* _(ChunkDataQueue);

  const players = yield* _(queryEntities(playerQuery));
  if (players.length === 0) {
    return;
  }
  const playerId = players[0];
  const positions = yield* _(getComponentStore(Position));
  const playerPositionX = positions.x[playerId];
  const playerPositionZ = positions.z[playerId];

  const playerChunkX = Math.floor(playerPositionX / CHUNK_SIZE);
  const playerChunkZ = Math.floor(playerPositionZ / CHUNK_SIZE);

  if (
    playerChunkX === currentPlayerChunkX &&
    playerChunkZ === currentPlayerChunkZ
  ) {
    return;
  }

  currentPlayerChunkX = playerChunkX;
  currentPlayerChunkZ = playerChunkZ;

  const gameState = yield* _(gameStateService.get);
  const requiredChunks = new Set<string>();

  for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
    for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
      requiredChunks.add(`${x},${z}`);
    }
  }

  const chunkEntities = yield* _(queryEntities({ all: [Chunk] }));
  const chunkComponents = yield* _(getComponentStore(Chunk));
  const loadedChunks = new Map<string, EntityId>();
  for (const chunkId of chunkEntities) {
    loadedChunks.set(`${chunkComponents.x[chunkId]},${chunkComponents.z[chunkId]}`, chunkId);
  }

  // Unload chunks that are no longer required
  const terrainBlocks = yield* _(queryEntities({ all: [TerrainBlock, Position] }));
  const terrainPositions = yield* _(getComponentStore(Position));
  const unloadEffects: Effect.Effect<void>[] = [];

  for (const [key, entityId] of loadedChunks.entries()) {
    if (!requiredChunks.has(key)) {
      const [xStr, zStr] = key.split(',');
      const chunkX = parseInt(xStr, 10);
      const chunkZ = parseInt(zStr, 10);

      // Find and remove all terrain blocks within this chunk
      for (const blockId of terrainBlocks) {
        const blockChunkX = Math.floor(terrainPositions.x[blockId] / CHUNK_SIZE);
        const blockChunkZ = Math.floor(terrainPositions.z[blockId] / CHUNK_SIZE);
        if (blockChunkX === chunkX && blockChunkZ === chunkZ) {
          unloadEffects.push(removeEntity(blockId));
        }
      }
      // Remove the chunk marker entity
      unloadEffects.push(removeEntity(entityId));
    }
  }

  if (unloadEffects.length > 0) {
    yield* _(Effect.all(unloadEffects, { discard: true, concurrency: "unbounded" }));
  }

  // Load new chunks
  for (const key of requiredChunks) {
    if (!loadedChunks.has(key)) {
      const [xStr, zStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const z = parseInt(zStr, 10);

      // Create a chunk marker entity immediately to prevent duplicate loading
      yield* _(createEntity({ _tag: "Chunk", x, z }));

      const generationEffect = Effect.gen(function* (_) {
        const task: GenerateChunkTask = {
          type: 'generateChunk',
          payload: {
            chunkX: x,
            chunkZ: z,
            seeds: gameState.seeds,
            amplitude: gameState.amplitude,
            editedBlocks: gameState.editedBlocks,
          },
        };
        const chunkData = yield* _(computationWorker.postTask(task));
        if (chunkData.blocks.length > 0) {
          yield* _(chunkDataQueue.offer(chunkData));
        }
      });

      yield* _(Effect.fork(generationEffect));
    }
  }
});