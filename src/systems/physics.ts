import { Effect } from 'effect';
import { Gravity, Velocity } from '../domain/components';
import { World } from '../runtime/world';

export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);

  // --- Gravity ---
  const entities = yield* _(world.query(Velocity, Gravity));

  yield* _(
    Effect.forEach(
      entities,
      ([id, [vel, grav]]) => {
        // Simple terminal velocity
        const newDy = Math.max(-2, vel.dy - grav.value);
        const newVel = new Velocity({ ...vel, dy: newDy });
        return world.updateComponent(id, newVel);
      },
      { discard: true },
    ),
  );
}).pipe(Effect.withSpan('physicsSystem'));

