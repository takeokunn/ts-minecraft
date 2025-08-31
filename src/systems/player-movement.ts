import { Effect, Option } from "effect";
import {
  CameraState,
  InputState,
  Player,
  Velocity,
} from "../domain/components";
import { World } from "../runtime/world";

const PLAYER_SPEED = 0.08;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_FORCE = 0.18;
const DECELERATION = 0.85;
const MIN_VELOCITY = 0.001;

export const playerMovementSystem: Effect.Effect<void, never, World> = Effect.gen(
  function* (_) {
    const world = yield* _(World);
    const playerOption = yield* _(
      world.querySingle(Player, InputState, Velocity, CameraState),
    );
    if (Option.isNone(playerOption)) {
      return;
    }

    const [id, components] = playerOption.value;
    const {
      Player: player,
      InputState: input,
      Velocity: velocity,
      CameraState: camera,
    } = components;

    const speed = input.sprint
      ? PLAYER_SPEED * SPRINT_MULTIPLIER
      : PLAYER_SPEED;

    let dx = 0;
    let dz = 0;

    if (input.forward) {
      dx -= Math.sin(camera.yaw) * speed;
      dz -= Math.cos(camera.yaw) * speed;
    }
    if (input.backward) {
      dx += Math.sin(camera.yaw) * speed;
      dz += Math.cos(camera.yaw) * speed;
    }
    if (input.left) {
      dx -= Math.cos(camera.yaw) * speed;
      dz += Math.sin(camera.yaw) * speed;
    }
    if (input.right) {
      dx += Math.cos(camera.yaw) * speed;
      dz -= Math.sin(camera.yaw) * speed;
    }

    let newDx = dx;
    let newDz = dz;

    if (newDx === 0 && newDz === 0) {
      newDx = velocity.dx * DECELERATION;
      newDz = velocity.dz * DECELERATION;
      if (Math.abs(newDx) < MIN_VELOCITY) newDx = 0;
      if (Math.abs(newDz) < MIN_VELOCITY) newDz = 0;
    }

    let newDy = velocity.dy;
    let newIsGrounded = player.isGrounded;

    if (input.jump && player.isGrounded) {
      newDy = JUMP_FORCE;
      newIsGrounded = false;
    }

    yield* _(
      world.updateComponent(
        id,
        new Velocity({
          dx: newDx,
          dy: newDy,
          dz: newDz,
        }),
      ),
    );
    yield* _(
      world.updateComponent(
        id,
        new Player({
          ...player,
          isGrounded: newIsGrounded,
        }),
      ),
    );
  },
).pipe(Effect.withSpan("playerMovementSystem"));
