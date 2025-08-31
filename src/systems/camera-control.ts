import { Effect, Option } from "effect";
import { CameraState, Player } from "../domain/components";
import { Camera, Input } from "../runtime/services";
import { World } from "../runtime/world";

export const cameraControlSystem: Effect.Effect<
  void,
  never,
  World | Input | Camera
> = Effect.gen(function* (_) {
  const world = yield* _(World);
  const playerOption = yield* _(world.querySingle(Player, CameraState));
  if (Option.isNone(playerOption)) {
    return;
  }

  const [id] = playerOption.value;

  const inputService = yield* _(Input);
  const cameraService = yield* _(Camera);

  const mouseState = yield* _(inputService.getMouseState());
  yield* _(cameraService.moveRight(-mouseState.dx * 0.002)); // Yaw
  yield* _(cameraService.rotatePitch(-mouseState.dy * 0.002)); // Pitch

  const yaw = yield* _(cameraService.getYaw());
  const pitch = yield* _(cameraService.getPitch());

  yield* _(
    world.updateComponent(
      id,
      new CameraState({
        pitch: pitch,
        yaw: yaw,
      }),
    ),
  );
}).pipe(Effect.withSpan("cameraControlSystem"));
