import { Effect, Layer } from 'effect';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createEntity,
  getEntity,
  type World,
  WorldLive,
} from '../runtime/world';
import { GameStateLive } from '../runtime/game-state';
import { collisionSystem } from './collision';
import type { GameState } from '../runtime/game-state';

// Helper to run tests within the Effect context
const runTest = <E, A>(eff: Effect.Effect<A, E, World | GameState>): A =>
  Effect.runSync(eff.pipe(Effect.provide(Layer.merge(WorldLive, GameStateLive))));

describe('collisionSystem', () => {
  it('should stop an entity when it collides with a terrain block', () => {
    const program = Effect.gen(function* (_) {
      // Entity moving towards the block
      const movingEntity = yield* _(
        createEntity(
          { _tag: 'Position', x: 0, y: 0, z: 0 },
          { _tag: 'Velocity', dx: 1, dy: 0, dz: 0 },
          { _tag: 'Collider', width: 1, height: 1, depth: 1 },
        ),
      );
      // Stationary block
      yield* _(
        createEntity(
          { _tag: 'Position', x: 1, y: 0, z: 0 },
          { _tag: 'TerrainBlock' },
        ),
      );

      yield* _(collisionSystem);

      const components = yield* _(getEntity(movingEntity));
      return [...(components ?? [])].find((c) => c._tag === 'Velocity');
    });

    const finalVelocity = runTest(program);
    expect(finalVelocity).toEqual({ _tag: 'Velocity', dx: 0, dy: 0, dz: 0 });
  });

  it('should not affect non-colliding entities', () => {
    const program = Effect.gen(function* (_) {
      const movingEntity = yield* _(
        createEntity(
          { _tag: 'Position', x: 0, y: 0, z: 0 },
          { _tag: 'Velocity', dx: 1, dy: 0, dz: 0 },
          { _tag: 'Collider', width: 1, height: 1, depth: 1 },
        ),
      );
      // Block is far away
      yield* _(
        createEntity(
          { _tag: 'Position', x: 10, y: 0, z: 0 },
          { _tag: 'TerrainBlock' },
        ),
      );

      yield* _(collisionSystem);

      const components = yield* _(getEntity(movingEntity));
      return [...(components ?? [])].find((c) => c._tag === 'Velocity');
    });

    const finalVelocity = runTest(program);
    expect(finalVelocity).toEqual({ _tag: 'Velocity', dx: 1, dy: 0, dz: 0 });
  });

  // --- Property-Based Tests for aabbIntersect ---
  const positionArbitrary = fc.record({
    _tag: fc.constant('Position' as const),
    x: fc.float(),
    y: fc.float(),
    z: fc.float(),
  });

  const colliderArbitrary = fc.record({
    _tag: fc.constant('Collider' as const),
    width: fc.float({ min: 0.1, max: 10 }),
    height: fc.float({ min: 0.1, max: 10 }),
    depth: fc.float({ min: 0.1, max: 10 }),
  });

  it('should always report intersection for overlapping boxes (PBT)', () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        colliderArbitrary,
        positionArbitrary,
        colliderArbitrary,
        (posA, colA, posB, _colB) => {
          // Force overlap by setting B's position to be inside A
          posB.x = posA.x + (Math.random() - 0.5) * colA.width;
          posB.y = posA.y + (Math.random() - 0.5) * colA.height;
          posB.z = posA.z + (Math.random() - 0.5) * colA.depth;

          const program = Effect.gen(function* (_) {
            const entityA = yield* _(
              createEntity(posA, colA, {
                _tag: 'Velocity',
                dx: 1,
                dy: 0,
                dz: 0,
              }),
            );
            yield* _(createEntity(posB, { _tag: 'TerrainBlock' }));
            yield* _(collisionSystem);
            const components = yield* _(getEntity(entityA));
            return [...(components ?? [])].find((c) => c._tag === 'Velocity');
          });
          const finalVelocity = runTest(program);
          // Because they start overlapping, the velocity should be zeroed.
          return finalVelocity?.dx === 0;
        },
      ),
    );
  });
});
