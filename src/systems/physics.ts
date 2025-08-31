import { Effect } from "effect";
import { Gravity, Velocity } from "../domain/components";
import { World } from "../runtime/world";

export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);

  // --- Gravity ---
  const { entities, velocitys, gravitys } = yield* _(
    world.querySoA(Velocity, Gravity),
  );

  const updateEffects = [];
  for (let i = 0; i < entities.length; i++) {
    const id = entities[i];
    const vel = {
      dx: velocitys.dx[i] as number,
      dy: velocitys.dy[i] as number,
      dz: velocitys.dz[i] as number,
    };
    const grav = {
      value: gravitys.value[i] as number,
    };

    // Simple terminal velocity
    const newDy = Math.max(-2, vel.dy - grav.value);
    const newVel = new Velocity({ ...vel, dy: newDy });
    updateEffects.push(world.updateComponent(id, newVel));
  }

  if (updateEffects.length > 0) {
    yield* _(Effect.all(updateEffects, { discard: true }));
  }
}).pipe(Effect.withSpan("physicsSystem"));

