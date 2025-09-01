
import { Effect, Layer, Queue } from 'effect';
import { worldUpdateSystem } from './world-update';
import { World } from '@/runtime/world';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepPartial } from 'vitest';
import {
  ChunkDataQueue,
  RenderQueue,
  ChunkGenerationResult,
} from '@/domain/types';
import { Archetypes } from '@/domain/archetypes';
import { EntityId } from '@/domain/entity';
import { blockTypeNames } from '@/domain/block';

vi.mock('@/domain/archetypes', () => ({
  Archetypes: {
    createBlock: vi.fn((pos: any, type: any) =>
      Effect.succeed({
        id: 3 as EntityId,
        position: pos,
        block: { type },
      }),
    ),
  },
}));

const createBlockSpy = vi.spyOn(Archetypes, 'createBlock');

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const defaultWorld: World = {
    entities: new Set(),
    archetypes: Archetypes,
    ...overrides,
    components: {
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

const chunkGenerationResultArbitrary = fc.record({
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
  blocks: fc.array(
    fc.record({
      x: fc.integer(),
      y: fc.integer(),
      z: fc.integer(),
      blockType: fc.constantFrom(...blockTypeNames),
    }),
  ),
  mesh: fc.record({
    positions: fc.uint32Array(),
    normals: fc.uint32Array(),
    uvs: fc.uint32Array(),
    indices: fc.uint32Array({ minLength: 1 }),
  }),
});

describe('systems/world-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing if chunk data queue is empty', async () => {
    const world = createMockWorld();
    const chunkQueue = await Effect.runPromise(
      Queue.unbounded<ChunkGenerationResult>(),
    );
    const renderQueue = await Effect.runPromise(Queue.unbounded<any>());

    const run = Effect.provide(
      worldUpdateSystem,
      Layer.mergeAll(
        Layer.succeed(World, world),
        Layer.succeed(ChunkDataQueue, chunkQueue),
        Layer.succeed(RenderQueue, renderQueue),
      ),
    );

    await Effect.runPromise(run);

    expect(createBlockSpy).not.toHaveBeenCalled();
    const renderQueueSize = await Effect.runPromise(Queue.size(renderQueue));
    expect(renderQueueSize).toBe(0);
  });

  it('should create blocks and offer mesh to render queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        chunkGenerationResultArbitrary,
        async (mockResult) => {
          vi.clearAllMocks();
          const world = createMockWorld();
          const chunkQueue = await Effect.runPromise(
            Queue.unbounded<ChunkGenerationResult>(),
          );
          await Effect.runPromise(Queue.offer(chunkQueue, mockResult));
          const renderQueue = await Effect.runPromise(
            Queue.unbounded<any>(),
          );

          const run = Effect.provide(
            worldUpdateSystem,
            Layer.mergeAll(
              Layer.succeed(World, world),
              Layer.succeed(ChunkDataQueue, chunkQueue),
              Layer.succeed(RenderQueue, renderQueue),
            ),
          );

          await Effect.runPromise(run);

          expect(createBlockSpy).toHaveBeenCalledTimes(
            mockResult.blocks.length,
          );
          mockResult.blocks.forEach((block) => {
            expect(createBlockSpy).toHaveBeenCalledWith(
              { x: block.x, y: block.y, z: block.z },
              block.blockType,
            );
          });

          const renderQueueSize = await Effect.runPromise(
            Queue.size(renderQueue),
          );
          expect(renderQueueSize).toBe(1);
          const command = await Effect.runPromise(
            Queue.take(renderQueue),
          );
          expect(command).toEqual({
            _tag: 'UpsertChunk',
            chunkX: mockResult.chunkX,
            chunkZ: mockResult.chunkZ,
            mesh: mockResult.mesh,
          });
        },
      ),
    );
  });
});
