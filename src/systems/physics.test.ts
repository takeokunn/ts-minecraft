import { Effect, Layer } from 'effect';
import { integrate, physicsSystem } from './physics';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect } from 'vitest';
import { DeepPartial } from 'vitest';
import { Position, Velocity } from '@/domain/components';
import { Queries } from '@/domain/queries';

const GRAVITY = 20;
const TERMINAL_VELOCITY = 50;
const FRICTION = 0.98;

const positionArbitrary = fc.record({
  x: fc.float({ noNaN: true, min: -1e3, max: 1e3 }),
  y: fc.float({ noNaN: true, min: -1e3, max: 1e3 }),
  z: fc.float({ noNaN: true, min: -1e3, max: 1e3 }),
});

const velocityArbitrary = fc.record({
  x: fc.float({ noNaN: true, min: -100, max: 100 }),
  y: fc.float({
    noNaN: true,
    min: -TERMINAL_VELOCITY - 10,
    max: 100,
  }),
  z: fc.float({ noNaN: true, min: -100, max: 100 }),
});

const deltaTimeArbitrary = fc.float({ min: 0, max: 1 / 60 });

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const eid1 = 1 as EntityId;
  const eid2 = 2 as EntityId;

  const defaultWorld: World = {
    entities: new Set([eid1, eid2]),
    queries: Queries,
    globalState: {
      isPaused: false,
      physics: {
        gravity: GRAVITY,
        simulationRate: 60,
      },
      ...overrides.globalState,
    },
    ...overrides,
    components: {
      position: new Map([
        [eid1, { x: 10, y: 10, z: 10 }],
        [eid2, { x: 20, y: 20, z: 20 }],
      ]),
      velocity: new Map([
        [eid1, { x: 1, y: 2, z: 0 }],
        [eid2, { x: -1, y: 0, z: 0.5 }],
      ]),
      player: new Map([
        [eid1, { isGrounded: false }],
        [eid2, { isGrounded: true }],
      ]),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

describe('Physics System', () => {
  describe('integrate (Pure Logic)', () => {
    it('should not change state if deltaTime is zero', () => {
      fc.assert(
        fc.property(
          positionArbitrary,
          velocityArbitrary,
          fc.boolean(),
          (pos, vel, isGrounded) => {
            const { newPosition, newVelocity } = integrate(
              pos,
              vel,
              isGrounded,
              0,
              GRAVITY,
            );
            expect(newPosition).toEqual(pos);
            expect(newVelocity).toEqual(vel);
          },
        ),
      );
    });

    it('should apply gravity when not grounded', () => {
      fc.assert(
        fc.property(
          positionArbitrary,
          velocityArbitrary,
          deltaTimeArbitrary,
          (pos, vel, dt) => {
            fc.pre(dt > 0);
            const { newVelocity } = integrate(
              pos,
              vel,
              false,
              dt,
              GRAVITY,
            );
            const expectedY = Math.max(
              -TERMINAL_VELOCITY,
              vel.y - GRAVITY * dt,
            );
            expect(newVelocity.y).toBeCloseTo(expectedY);
          },
        ),
      );
    });

    it('should apply friction when grounded', () => {
      fc.assert(
        fc.property(
          positionArbitrary,
          velocityArbitrary,
          deltaTimeArbitrary,
          (pos, vel, dt) => {
            fc.pre(dt > 0);
            const { newVelocity } = integrate(
              pos,
              vel,
              true,
              dt,
              GRAVITY,
            );
            expect(newVelocity.x).toBeCloseTo(vel.x * FRICTION);
            expect(newVelocity.z).toBeCloseTo(vel.z * FRICTION);
            expect(newVelocity.y).toBe(0);
          },
        ),
      );
    });
  });

  describe('physicsSystem', () => {
    it('should apply integration to all physics-enabled entities', async () => {
      const world = createMockWorld();
      const eid1 = 1 as EntityId;
      const eid2 = 2 as EntityId;

      const expected1 = integrate(
        world.components.position.get(eid1)!,
        world.components.velocity.get(eid1)!,
        world.components.player.get(eid1)!.isGrounded,
        1 / 60,
        GRAVITY,
      );
      const expected2 = integrate(
        world.components.position.get(eid2)!,
        world.components.velocity.get(eid2)!,
        world.components.player.get(eid2)!.isGrounded,
        1 / 60,
        GRAVITY,
      );

      const run = Effect.provide(
        physicsSystem,
        Layer.succeed(World, world),
      );
      await Effect.runPromise(run);

      expect(world.components.position.get(eid1)).toEqual(
        expected1.newPosition,
      );
      expect(world.components.velocity.get(eid1)).toEqual(
        expected1.newVelocity,
      );
      expect(world.components.position.get(eid2)).toEqual(
        expected2.newPosition,
      );
      expect(world.components.velocity.get(eid2)).toEqual(
        expected2.newVelocity,
      );
    });
  });
});