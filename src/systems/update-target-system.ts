import { Effect, Option } from "effect";
import * as THREE from "three";
import { Player, Target } from "@/domain/components";
import { Renderer, RaycastService } from "@/runtime/services";
import { World } from "@/runtime/world";

export const updateTargetSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const raycastService = yield* _(RaycastService);
  const renderer = yield* _(Renderer);

  const playerOption = yield* _(world.querySingle(Player));
  if (Option.isNone(playerOption)) {
    yield* _(renderer.updateHighlight(null));
    return;
  }
  const [playerId] = playerOption.value;

  // Always remove the old target first
  yield* _(world.removeComponent(playerId, Target));

  const raycastResult = yield* _(raycastService.cast());

  if (Option.isSome(raycastResult)) {
    const { entityId, position, face, intersection } = raycastResult.value;
    yield* _(
      world.addComponent(
        playerId,
        new Target({
          id: entityId,
          position: position,
          face: [face.x, face.y, face.z],
        }),
      ),
    );
    yield* _(renderer.updateHighlight(intersection as THREE.Intersection));
  } else {
    yield* _(renderer.updateHighlight(null));
  }
}).pipe(Effect.withSpan("updateTargetSystem"));
