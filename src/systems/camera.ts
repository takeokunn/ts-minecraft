import { Effect, Option } from "effect";
import { CameraState, Player, Position } from "@/domain/components";
import { ThreeJsContext } from "@/infrastructure/renderer-three";
import { World } from "@/runtime/world";

export const cameraSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const { controls } = yield* _(ThreeJsContext);

  const playerOption = yield* _(world.querySingle(Player, Position, CameraState));

  if (Option.isSome(playerOption)) {
    const [_id, [_player, pos, camState]] = playerOption.value;

    controls.getObject().position.set(pos.x, pos.y + 1.6, pos.z); // Eye level

    const camera = controls.getObject();
    camera.rotation.order = "YXZ";
    camera.rotation.y = camState.yaw;
    const pitchObject = camera.children[0];
    if (pitchObject) {
      pitchObject.rotation.x = camState.pitch;
    }
  }
});
