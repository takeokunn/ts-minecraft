
import { Effect, Layer } from 'effect';
import {
  CHUNK_SIZE,
  calculateChunkUpdates,
  chunkLoadingSystem,
} from './chunk-loading';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepPartial } from '@/domain/types';
import { Queries } from '@/domain/queries';

const RENDER_DISTANCE = 2;

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const playerEid = 1 as EntityId;

  const defaultWorld: World = {
    entities: new Set([playerEid]),
    queries: Queries,
    globalState: {
      isPaused: false,
      physics: {
        gravity: 20,
        simulationRate: 60,
      },
      player: {
        id: playerEid,
      },
      chunk: {
        renderDistance: RENDER_DISTANCE,
        unloadDistance: 3,
        size: CHUNK_SIZE,
      },
      ...overrides.globalState,
    },
    removeEntity: vi.fn(() => Effect.succeed(true)),
    createEntity: vi.fn(() => 2 as EntityId),
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: true }]]),
      position: new Map([[playerEid, { x: 0, y: 0, z: 0 }]]),
      chunkLoaderState: new Map(),
      chunk: new Map(),
      ...overrides.components,
    },
  };

  return defaultWorld as any;
};

const chunkCoordArbitrary = fc.integer({ min: -10, max: 10 });

describe('systems/chunk-loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateChunkUpdates', () => {
    it('should identify chunks to load and unload', () => {
      fc.assert(
        fc.property(
          chunkCoordArbitrary,
          chunkCoordArbitrary,
          chunkCoordArbitrary,
          chunkCoordArbitrary,
          (
            currentX,
            currentZ,
            previousX,
            previousZ,
          ) => {
            const loadedChunks = new Map<string, EntityId>();
            for (
              let x = previousX - RENDER_DISTANCE;
              x <= previousX + RENDER_DISTANCE;
              x++
            ) {
              for (
                let z = previousZ - RENDER_DISTANCE;
                z <= previousZ + RENDER_DISTANCE;
                z++
              ) {
                loadedChunks.set(`${x},${z}`, (x * 1000 + z) as EntityId);
              }
            }

            const { toLoad, toUnload } = calculateChunkUpdates(
              { x: currentX, z: currentZ },
              loadedChunks,
              RENDER_DISTANCE,
            );

            const requiredChunks = new Set<string>();
            for (
              let x = currentX - RENDER_DISTANCE;
              x <= currentX + RENDER_DISTANCE;
              x++
            ) {
              for (
                let z = currentZ - RENDER_DISTANCE;
                z <= currentZ + RENDER_DISTANCE;
                z++
              ) {
                requiredChunks.add(`${x},${z}`);
              }
            }

            toLoad.forEach((chunk) => {
              const key = `${chunk.x},${chunk.z}`;
              expect(requiredChunks.has(key)).toBe(true);
              expect(loadedChunks.has(key)).toBe(false);
            });

            toUnload.forEach((entityId) => {
              let found = false;
              for (const [key, id] of loadedChunks.entries()) {
                if (id === entityId) {
                  expect(requiredChunks.has(key)).toBe(false);
                  found = true;
                  break;
                }
              }
              expect(found).toBe(true);
            });
          },
        ),
      );
    });
  });

  describe('chunkLoadingSystem', () => {
    it('should do nothing if player has not moved to a new chunk', async () => {
      const world = createMockWorld({
        components: {
          position: new Map([
            [1 as EntityId, { x: 0, y: 0, z: 0 }],
          ]),
          chunkLoaderState: new Map([
            [
              2 as EntityId,
              {
                currentPlayerChunkX: 0,
                currentPlayerChunkZ: 0,
              },
            ],
          ]),
        },
      });

      const run = Effect.provide(
        chunkLoadingSystem,
        Layer.succeed(World as any, world as any),
      );
      const commands = await Effect.runPromise(run);

      expect(commands).toHaveLength(0);
    });

    it('should create a loader and load initial chunks if loader does not exist (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(
          chunkCoordArbitrary,
          chunkCoordArbitrary,
          async (playerChunkX, playerChunkZ) => {
            const world = createMockWorld({
              components: {
                position: new Map([
                  [
                    1 as EntityId,
                    {
                      x: playerChunkX * CHUNK_SIZE,
                      y: 0,
                      z: playerChunkZ * CHUNK_SIZE,
                    },
                  ],
                ]),
              },
            });

            const run = Effect.provide(
              chunkLoadingSystem,
              Layer.succeed(World as any, world as any),
            );
            const commands = await Effect.runPromise(run);

            const loaders = (world as any).queries.chunkLoader(world);
            expect(loaders.length).toBe(1);
            const loader = loaders[0];
            expect(loader?.chunkLoaderState).toEqual({
              currentPlayerChunkX: playerChunkX,
              currentPlayerChunkZ: playerChunkZ,
            });

            const sideLength = RENDER_DISTANCE * 2 + 1;
            expect(commands).toHaveLength(sideLength * sideLength);

            const cornerChunk = {
              _tag: 'GenerateChunk',
              chunkX: playerChunkX - RENDER_DISTANCE,
              chunkZ: playerChunkZ - RENDER_DISTANCE,
            };
            expect(commands).toContainEqual(cornerChunk);
          },
        ),
      );
    });

    it('should unload distant chunks and load new ones when player moves (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(
          chunkCoordArbitrary,
          chunkCoordArbitrary,
          fc.integer({ min: 1, max: RENDER_DISTANCE * 2 }),
          async (startX, startZ, moveDist) => {
            const chunkToUnloadX = startX - RENDER_DISTANCE - 1;
            const chunkToUnloadZ = startZ;
            const chunkToUnloadEid = 3 as EntityId;

            const world = createMockWorld({
              components: {
                position: new Map([
                  [
                    1 as EntityId,
                    {
                      x: (startX + moveDist) * CHUNK_SIZE,
                      y: 0,
                      z: startZ * CHUNK_SIZE,
                    },
                  ],
                ]),
                chunkLoaderState: new Map([
                  [
                    2 as EntityId,
                    {
                      currentPlayerChunkX: startX,
                      currentPlayerChunkZ: startZ,
                    },
                  ],
                ]),
                chunk: new Map([
                  [
                    chunkToUnloadEid,
                    { x: chunkToUnloadX, z: chunkToUnloadZ },
                  ],
                ]),
              },
            });

            const run = Effect.provide(
              chunkLoadingSystem,
              Layer.succeed(World as any, world as any),
            );
            const commands = await Effect.runPromise(run);

            const endX = startX + moveDist;
            const endZ = startZ;

            const loaders = (world as any).queries.chunkLoader(world);
            const updatedLoader = loaders[0]?.chunkLoaderState;
            expect(updatedLoader).toEqual({
              currentPlayerChunkX: endX,
              currentPlayerChunkZ: endZ,
            });

            expect(world.removeEntity).toHaveBeenCalledWith(
              chunkToUnloadEid,
            );

            const expectedNewChunksCount =
              moveDist * (RENDER_DISTANCE * 2 + 1);
            expect(commands).toHaveLength(expectedNewChunksCount);

            const newChunkX = endX + RENDER_DISTANCE;
            expect(commands).toContainEqual({
              _tag: 'GenerateChunk',
              chunkX: newChunkX,
              chunkZ: endZ,
            });
          },
        ),
      );
    });
  });
});
