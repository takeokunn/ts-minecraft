import { Effect, Layer } from 'effect';
import {
  calculateHorizontalVelocity,
  calculateVerticalVelocity,
  applyDeceleration,
  playerMovementSystem,
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
} from './player-movement';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect } from 'vitest';
import { DeepPartial } from 'vitest';
import {
  CameraState,
  InputState,
  Velocity,
} from '@/domain/components';
import { Queries } from '@/domain/queries';

const cameraStateArbitrary = fc.record({
  pitch: fc.float({
    min: -Math.PI / 2,
    max: Math.PI / 2,
    noNaN: true,
  }),
  yaw: fc.float({
    min: -2 * Math.PI,
    max: 2 * Math.PI,
    noNaN: true,
  }),
});

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
      inputState: new Map([
        [
          playerEid,
          {
            forward: true,
            sprint: false,
            jump: true,
          } as InputState,
        ],
      ]),
      velocity: new Map([[playerEid, { x: 0, y: 0, z: 0 }]]),
      cameraState: new Map([[playerEid, { yaw: 0, pitch: 0 }]]),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

describe('Player Movement System', () => {
  describe('Pure Logic Functions', () => {
    describe('calculateVerticalVelocity', () => {
      it('should apply jump force if grounded and jump is pressed', () => {
        const newDy = calculateVerticalVelocity(true, true, 0);
        expect(newDy).toBe(JUMP_FORCE);
      });

      it('should not change vertical velocity if not grounded', () => {
        const newDy = calculateVerticalVelocity(false, true, 0.1);
        expect(newDy).toBe(0.1);
      });
    });

    describe('applyDeceleration', () => {
      it('should eventually bring velocity to zero', () => {
        let vel = { x: 1, z: 1 };
        for (let i = 0; i < 1000; i++) {
          vel = applyDeceleration(vel);
        }
        expect(vel.x).toBe(0);
        expect(vel.z).toBe(0);
      });
    });

    describe('calculateHorizontalVelocity', () => {
      it('should move at sprint speed when sprinting', () => {
        fc.assert(
          fc.property(cameraStateArbitrary, (camera) => {
            const input = {
              forward: true,
              sprint: true,
            } as InputState;
            const { x, z } = calculateHorizontalVelocity(
              input,
              camera,
            );
            const magnitude = Math.sqrt(x * x + z * z);
            expect(magnitude).toBeCloseTo(
              PLAYER_SPEED * SPRINT_MULTIPLIER,
            );
          }),
        );
      });

      it('should move relative to camera yaw', () => {
        const input = { forward: true } as InputState;
        const camera = { yaw: Math.PI / 2, pitch: 0 };
        const { x, z } = calculateHorizontalVelocity(input, camera);
        expect(x).toBeCloseTo(PLAYER_SPEED);
        expect(z).toBeCloseTo(0);
      });
    });
  });

  describe('playerMovementSystem', () => {
    it('should update velocity based on input', async () => {
      const world = createMockWorld();
      const playerEid = 1 as EntityId;

      const run = Effect.provide(
        playerMovementSystem,
        Layer.succeed(World, world),
      );
      await Effect.runPromise(run);

      const newVelocity = world.components.velocity.get(playerEid);
      const newPlayerState = world.components.player.get(playerEid);

      const expectedHorizontal = calculateHorizontalVelocity(
        world.components.inputState.get(playerEid)!,
        world.components.cameraState.get(playerEid)!,
      );
      const expectedVertical = calculateVerticalVelocity(
        true,
        true,
        0,
      );

      expect(newVelocity).toEqual({
        x: expectedHorizontal.x,
        y: expectedVertical,
        z: expectedHorizontal.z,
      });
      expect(newPlayerState?.isGrounded).toBe(false);
    });
  });
});