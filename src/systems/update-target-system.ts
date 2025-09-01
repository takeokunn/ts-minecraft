
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { Raycast } from '@/domain/types';
import { match } from 'ts-pattern';

export const updateTargetSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const raycast = yield* _(Raycast);
  const players = world.queries.playerTarget(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];

  const raycastResult = raycast.castRay();

  const newTarget = match(raycastResult)
    .with(undefined, () => ({
      entityId: -1,
      faceX: 0,
      faceY: 0,
      faceZ: 0,
    }))
    .otherwise((result) => ({
      entityId: result.entityId,
      faceX: result.face.x,
      faceY: result.face.y,
      faceZ: result.face.z,
    }));

  world.components.target.set(player.entityId, newTarget);
});
