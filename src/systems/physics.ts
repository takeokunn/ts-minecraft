import { Effect } from 'effect';
import {
  type Gravity,
  GravitySchema,
  type Velocity,
  VelocitySchema,
} from '../domain/components';
import {
  type QueryResult,
  query,
  updateComponent,
  type World,
} from '../runtime/world';

export const physicsSystem: Effect.Effect<void, never, World> = Effect.gen(
  function* (_) {
    // --- Gravity ---
    const entitiesWithGravity: ReadonlyArray<
      QueryResult<[typeof VelocitySchema, typeof GravitySchema]>
    > = yield* _(query(VelocitySchema, GravitySchema));
    yield* _(
      Effect.forEach(
        entitiesWithGravity,
        (
          entity: QueryResult<[typeof VelocitySchema, typeof GravitySchema]>,
        ) => {
          const vel: Velocity = entity.get(VelocitySchema);
          const grav: Gravity = entity.get(GravitySchema);
          // Simple terminal velocity
          const newDy = Math.max(-2, vel.dy - grav.value);
          const newVel: Velocity = { ...vel, dy: newDy };
          return updateComponent(entity.id, newVel);
        },
        { discard: true },
      ),
    );
  },
).pipe(Effect.withSpan('physicsSystem'));
