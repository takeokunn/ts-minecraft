import { Effect } from "effect";
import { CameraState, Player } from "../domain/components";
import { Camera, Input } from "../runtime/services";
import { World, queryEntities, updateComponentData } from "../runtime/world";

const SENSITIVITY = 0.002;

export const cameraControlSystem: Effect.Effect<
  void,
  never,
  World | Input | Camera
> = Effect.gen(function* (_) {
  const players = yield* _(queryEntities({ all: [Player, CameraState] }));
  if (players.length === 0) {
    return;
  }
  const playerId = players[0];

  const inputService = yield* _(Input);
  const cameraService = yield* _(Camera);

  const mouseState = yield* _(inputService.getMouseState());
  yield* _(cameraService.moveRight(-mouseState.dx * SENSITIVITY)); // Yaw
  yield* _(cameraService.rotatePitch(-mouseState.dy * SENSITIVITY)); // Pitch

  const yaw = yield* _(cameraService.getYaw());
  const pitch = yield* _(cameraService.getPitch());

  yield* _(
    updateComponentData(
      playerId,
      { _tag: "CameraState" },
      {
        pitch: pitch,
        yaw: yaw,
      },
    ),
  );
}).pipe(Effect.withSpan("cameraControlSystem"));