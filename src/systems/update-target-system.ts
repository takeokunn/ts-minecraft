import { Effect, Option } from "effect";
import * as THREE from "three";
import { Player, Target } from "@/domain/components";
import { Renderer, RaycastService } from "@/runtime/services";
import { World, getComponentStore, queryEntities } from "@/runtime/world";

export const updateTargetSystem = Effect.gen(function* (_) {
  const raycastService = yield* _(RaycastService);
  const renderer = yield* _(Renderer);

  const players = yield* _(queryEntities({ all: [Player] }));
  if (players.length === 0) {
    yield* _(renderer.updateHighlight(null));
    return;
  }
  const playerId = players[0];

  const targets = yield* _(getComponentStore(Target));
  const raycastResult = yield* _(raycastService.cast());

  if (Option.isSome(raycastResult)) {
    const { entityId, face, intersection } = raycastResult.value;
    targets.entityId[playerId] = entityId;
    targets.faceX[playerId] = face.x;
    targets.faceY[playerId] = face.y;
    targets.faceZ[playerId] = face.z;
    yield* _(renderer.updateHighlight(intersection as THREE.Intersection));
  } else {
    targets.entityId[playerId] = -1; // No target
    yield* _(renderer.updateHighlight(null));
  }
}).pipe(Effect.withSpan("updateTargetSystem"));