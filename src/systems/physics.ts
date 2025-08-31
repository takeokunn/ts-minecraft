import { Effect } from "effect";
import { Gravity, Position, Velocity } from "../domain/components";
import { physicsQuery } from "../domain/queries";
import { World, getComponentStore, queryEntities } from "../runtime/world";

export const physicsSystem = Effect.gen(function* (_) {
  const entities = yield* _(queryEntities(physicsQuery));
  if (entities.length === 0) {
    return;
  }

  const positions = yield* _(getComponentStore(Position));
  const velocities = yield* _(getComponentStore(Velocity));
  const gravities = yield* _(getComponentStore(Gravity));

  for (const id of entities) {
    // Apply gravity to velocity
    const dy = velocities.dy[id];
    const gravityValue = gravities.value[id];
    const newDy = Math.max(-2, dy - gravityValue); // Simple terminal velocity
    velocities.dy[id] = newDy;

    // Apply velocity to position
    positions.x[id] += velocities.dx[id];
    positions.y[id] += newDy;
    positions.z[id] += velocities.dz[id];
  }
}).pipe(Effect.withSpan("physicsSystem"));