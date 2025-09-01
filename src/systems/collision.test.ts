
import { Effect, Layer } from 'effect';
import {
  aabbIntersect,
  resolveCollisions,
  collisionSystem,
} from './collision';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepPartial } from 'vitest';
import { AABB, Velocity } from '@/domain/types';
import { SpatialGrid } from '@/infrastructure/spatial-grid';
import { Queries } from '@/domain/queries';

const aabbArbitrary: fc.Arbitrary<AABB> = fc
  .record({
    minX: fc.float({ min: -100, max: 100, noNaN: true }),
    minY: fc.float({ min: -100, max: 100, noNaN: true }),
    minZ: fc.float({ min: -100, max: 100, noNaN: true }),
    width: fc.float({ min: 0.1, max: 10, noNaN: true }),
    height: fc.float({ min: 0.1, max: 10, noNaN: true }),
    depth: fc.float({ min: 0.1, max: 10, noNaN: true }),
  })
  .map(
    ({
      minX,
      minY,
      minZ,
      width,
      height,
      depth,
    }): AABB => ({
      minX,
      minY,
      minZ,
      maxX: minX + width,
      maxY: minY + height,
      maxZ: minZ + depth,
    }),
  );

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
      ...overrides.globalState,
    },
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: false }]]),
      position: new Map([[playerEid, { x: 0, y: 1.1, z: 0 }]]),
      velocity: new Map([[playerEid, { x: 0, y: -0.5, z: 0 }]]),
      collider: new Map([
        [playerEid, { width: 0.8, height: 1.8, depth: 0.8 }],
      ]),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

describe('systems/collision', () => {
  describe('aabbIntersect', () => {
    it('should be commutative', () => {
      fc.assert(
        fc.property(aabbArbitrary, aabbArbitrary, (a, b) => {
          expect(aabbIntersect(a, b)).toEqual(aabbIntersect(b, a));
        }),
      );
    });

    it('should always intersect with itself', () => {
      fc.assert(
        fc.property(aabbArbitrary, (a) => {
          expect(aabbIntersect(a, a)).toBe(true);
        }),
      );
    });
  });

  describe('resolveCollisions with PBT', () => {
    const playerAABB: AABB = {
      minX: -0.4,
      maxX: 0.4,
      minY: 0,
      maxY: 1.8,
      minZ: -0.4,
      maxZ: 0.4,
    };

    it('should become grounded and stop when landing on a block', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -0.1, max: -5 }),
          (dy) => {
            const pAABB = { ...playerAABB, minY: 1, maxY: 1 + 1.8 };
            const pVel: Velocity = { x: 0, y: dy, z: 0 };
            const groundBlock: AABB = {
              minX: -1,
              maxX: 1,
              minY: 0,
              maxY: 1,
              minZ: -1,
              maxZ: 1,
            };

            const { newPosition, newVelocity, isGrounded } =
              resolveCollisions(pAABB, pVel, [groundBlock]);

            expect(isGrounded).toBe(true);
            expect(newVelocity.y).toBe(0);
            expect(newPosition.y).toBeCloseTo(groundBlock.maxY);
          },
        ),
      );
    });

    it('should stop at a ceiling', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.1, max: 5 }),
          (dy) => {
            const pAABB = { ...playerAABB, minY: -2, maxY: -2 + 1.8 };
            const pVel: Velocity = { x: 0, y: dy, z: 0 };
            const ceilingBlock: AABB = {
              minX: -1,
              maxX: 1,
              minY: 0,
              maxY: 1,
              minZ: -1,
              maxZ: 1,
            };

            const { newPosition, newVelocity, isGrounded } =
              resolveCollisions(pAABB, pVel, [ceilingBlock]);

            expect(isGrounded).toBe(false);
            expect(newVelocity.y).toBe(0);
            expect(newPosition.y).toBeCloseTo(ceilingBlock.minY - 1.8);
          },
        ),
      );
    });

    it('should stop at a wall on the X axis', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.1, max: 5 }),
          (dx) => {
            const pAABB = { ...playerAABB, minX: -2, maxX: -2 + 0.8 };
            const pVel: Velocity = { x: dx, y: 0, z: 0 };
            const wallBlock: AABB = {
              minX: 0,
              maxX: 1,
              minY: 0,
              maxY: 2,
              minZ: -1,
              maxZ: 1,
            };

            const { newPosition, newVelocity } = resolveCollisions(
              pAABB,
              pVel,
              [wallBlock],
            );

            expect(newVelocity.x).toBe(0);
            expect(newPosition.x).toBeCloseTo(wallBlock.minX - 0.4);
          },
        ),
      );
    });
  });

  describe('collisionSystem', () => {
    const mockSpatialGrid: SpatialGrid = {
      insert: vi.fn(),
      query: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should query the grid and update component state after collision', async () => {
      const blockEid = 2 as EntityId;
      const world = createMockWorld({
        entities: new Set([1 as EntityId, blockEid]),
        components: {
          position: new Map([
            [1 as EntityId, { x: 0, y: 1.1, z: 0 }],
            [blockEid, { x: 0, y: 0, z: 0 }],
          ]),
          collider: new Map([
            [1 as EntityId, { width: 0.8, height: 1.8, depth: 0.8 }],
            [blockEid, { width: 1, height: 1, depth: 1 }],
          ]),
        },
      });

      (mockSpatialGrid.query as vi.Mock).mockReturnValue([blockEid]);

      const run = Effect.provide(
        collisionSystem,
        Layer.mergeAll(
          Layer.succeed(World, world),
          Layer.succeed(SpatialGrid, mockSpatialGrid),
        ),
      );

      await Effect.runPromise(run);

      expect(mockSpatialGrid.query).toHaveBeenCalled();
      const playerEid = 1 as EntityId;
      expect(world.components.position.get(playerEid)).toEqual(
        expect.objectContaining({ y: 1 }),
      );
      expect(world.components.velocity.get(playerEid)).toEqual(
        expect.objectContaining({ y: 0 }),
      );
      expect(world.components.player.get(playerEid)).toEqual({
        isGrounded: true,
      });
    });
  });
});
