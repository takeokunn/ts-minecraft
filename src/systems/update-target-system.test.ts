
import { Effect, Layer } from 'effect';
import { updateTargetSystem } from './update-target-system';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'jest-without-globals';
import { DeepPartial } from 'vitest';
import { Raycast } from '@/domain/types';
import { Queries } from '@/domain/queries';
import { RaycastResult } from '@/infrastructure/raycast-three';

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const playerEid = 1 as EntityId;

  const defaultWorld: World = {
    entities: new Set([playerEid]),
    queries: Queries,
    globalState: {
      isPaused: false,
      player: {
        id: playerEid,
      },
      ...overrides.globalState,
    },
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: true }]]),
      target: new Map([[playerEid, { entityId: -1 } as any]]),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

const raycastResultArbitrary = fc.oneof(
  fc.constant(undefined),
  fc.record({
    entityId: fc.integer({ min: 1, max: 1000 }).map((n) => n as EntityId),
    face: fc.record({
      x: fc.integer({ min: -1, max: 1 }),
      y: fc.integer({ min: -1, max: 1 }),
      z: fc.integer({ min: -1, max: 1 }),
    }),
    intersection: fc.record({
      x: fc.float(),
      y: fc.float(),
      z: fc.float(),
    }),
  }),
);

describe('systems/update-target-system', () => {
  const mockRaycast: Raycast = {
    castRay: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update target component based on raycast result', async () => {
    await fc.assert(
      fc.asyncProperty(
        raycastResultArbitrary,
        async (raycastResult) => {
          vi.clearAllMocks();
          const world = createMockWorld();
          (mockRaycast.castRay as vi.Mock).mockReturnValue(
            raycastResult,
          );

          const run = Effect.provide(
            updateTargetSystem,
            Layer.mergeAll(
              Layer.succeed(World, world),
              Layer.succeed(Raycast, mockRaycast),
            ),
          );

          await Effect.runPromise(run);

          const playerEid = 1 as EntityId;
          const updatedTarget =
            world.components.target.get(playerEid);

          if (raycastResult) {
            expect(updatedTarget).toEqual({
              entityId: raycastResult.entityId,
              faceX: raycastResult.face.x,
              faceY: raycastResult.face.y,
              faceZ: raycastResult.face.z,
            });
          } else {
            expect(updatedTarget).toEqual({
              entityId: -1,
              faceX: 0,
              faceY: 0,
              faceZ: 0,
            });
          }
        },
      ),
    );
  });
});
