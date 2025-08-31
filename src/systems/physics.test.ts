import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import type { Position, Velocity } from '../domain/components';
import { createEntity, getEntity, WorldLive } from '../runtime/world';
import { physicsSystem } from './physics';

describe('physicsSystem', () => {
  it("should update an entity's position based on its velocity", () => {
    const initialPosition: Position = { _tag: 'Position', x: 10, y: 20, z: 30 };
    const velocity: Velocity = { _tag: 'Velocity', dx: 1, dy: -2, dz: 0.5 };

    const program = Effect.gen(function* (_) {
      // 1. Create an entity with Position and Velocity
      const entityId = yield* _(createEntity(initialPosition, velocity));

      // 2. Run the physics system
      yield* _(physicsSystem);

      // 3. Get the updated components to verify the change
      const components = yield* _(getEntity(entityId));
      return { components };
    });

    const runnable = program.pipe(Effect.provide(WorldLive));
    const result = Effect.runSync(runnable);

    const finalPosition = [...result.components!].find(
      (c) => c._tag === 'Position',
    );

    expect(finalPosition).toEqual({
      _tag: 'Position',
      x: 11,
      y: 18,
      z: 30.5,
    });
  });

  it('should not affect entities without both Position and Velocity', () => {
    const initialPosition: Position = { _tag: 'Position', x: 10, y: 20, z: 30 };

    const program = Effect.gen(function* (_) {
      const entityId = yield* _(createEntity(initialPosition)); // No velocity
      yield* _(physicsSystem);
      const components = yield* _(getEntity(entityId));
      return { components };
    });

    const runnable = program.pipe(Effect.provide(WorldLive));
    const result = Effect.runSync(runnable);

    const finalPosition = [...result.components!].find(
      (c) => c._tag === 'Position',
    );

    // Position should be unchanged
    expect(finalPosition).toEqual(initialPosition);
  });
});
