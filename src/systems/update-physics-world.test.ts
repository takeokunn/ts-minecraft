
import { Effect, Layer } from 'effect';
import { updatePhysicsWorldSystem } from './update-physics-world';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepPartial } from 'vitest';
import { AABB } from '@/domain/types';
import { SpatialGrid } from '@/infrastructure/spatial-grid';
import { Queries } from '@/domain/queries';

const positionColliderArbitrary = fc.record({
  x: fc.float({ min: -100, max: 100, noNaN: true }),
  y: fc.float({ min: -100, max: 100, noNaN: true }),
  z: fc.float({ min: -100, max: 100, noNaN: true }),
  width: fc.float({ min: 0.1, max: 10, noNaN: true }),
  height: fc.float({ min: 0.1, max: 10, noNaN: true }),
  depth: fc.float({ min: 0.1, max: 10, noNaN: true }),
});

const createMockWorld = (
  colliders: any[],
  overrides: DeepPartial<World> = {},
): World => {
  const entities = new Set<EntityId>();
  const position = new Map();
  const collider = new Map();

  colliders.forEach((c, i) => {
    const eid = (i + 1) as EntityId;
    entities.add(eid);
    position.set(eid, { x: c.x, y: c.y, z: c.z });
    collider.set(eid, {
      width: c.width,
      height: c.height,
      depth: c.depth,
    });
  });

  const defaultWorld: World = {
    entities,
    queries: Queries,
    ...overrides,
    components: {
      position,
      collider,
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

describe('systems/update-physics-world', () => {
  const mockSpatialGrid: SpatialGrid = {
    clear: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear the grid and register all collidable entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(positionColliderArbitrary),
        async (colliders) => {
          vi.clearAllMocks();
          const world = createMockWorld(colliders);

          const run = Effect.provide(
            updatePhysicsWorldSystem,
            Layer.mergeAll(
              Layer.succeed(World, world),
              Layer.succeed(SpatialGrid, mockSpatialGrid),
            ),
          );

          await Effect.runPromise(run);

          expect(mockSpatialGrid.clear).toHaveBeenCalled();
          expect(mockSpatialGrid.insert).toHaveBeenCalledTimes(
            colliders.length,
          );

          colliders.forEach((c, i) => {
            const eid = (i + 1) as EntityId;
            const expectedAABB: AABB = {
              minX: c.x - c.width / 2,
              maxX: c.x + c.width / 2,
              minY: c.y,
              maxY: c.y + c.height,
              minZ: c.z - c.depth / 2,
              maxZ: c.z + c.depth / 2,
            };
            expect(mockSpatialGrid.insert).toHaveBeenCalledWith(
              eid,
              expectedAABB,
            );
          });
        },
      ),
    );
  });
});
