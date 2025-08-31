import { Effect } from "effect";
import {
  CameraState,
  InputState,
  Player,
  Velocity,
} from "../domain/components";
import { playerQuery } from "../domain/queries";
import { World, getComponentStore, queryEntities } from "../runtime/world";

const PLAYER_SPEED = 0.08;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_FORCE = 0.18;
const DECELERATION = 0.85;
const MIN_VELOCITY = 0.001;

export const playerMovementSystem: Effect.Effect<void, never, World> = Effect.gen(
  function* (_) {
    const entities = yield* _(queryEntities(playerQuery));
    if (entities.length === 0) {
      return;
    }
    const id = entities[0];

    const players = yield* _(getComponentStore(Player));
    const inputStates = yield* _(getComponentStore(InputState));
    const velocities = yield* _(getComponentStore(Velocity));
    const cameraStates = yield* _(getComponentStore(CameraState));

    const isGrounded = players.isGrounded[id] === 1;
    const sprint = inputStates.sprint[id] === 1;
    const yaw = cameraStates.yaw[id];

    const speed = sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED;

    let dx = 0;
    let dz = 0;

    if (inputStates.forward[id] === 1) {
      dx -= Math.sin(yaw) * speed;
      dz -= Math.cos(yaw) * speed;
    }
    if (inputStates.backward[id] === 1) {
      dx += Math.sin(yaw) * speed;
      dz += Math.cos(yaw) * speed;
    }
    if (inputStates.left[id] === 1) {
      dx -= Math.cos(yaw) * speed;
      dz += Math.sin(yaw) * speed;
    }
    if (inputStates.right[id] === 1) {
      dx += Math.cos(yaw) * speed;
      dz -= Math.sin(yaw) * speed;
    }

    let newDx = dx;
    let newDz = dz;

    if (newDx === 0 && newDz === 0) {
      newDx = velocities.dx[id] * DECELERATION;
      newDz = velocities.dz[id] * DECELERATION;
      if (Math.abs(newDx) < MIN_VELOCITY) newDx = 0;
      if (Math.abs(newDz) < MIN_VELOCITY) newDz = 0;
    }

    let newDy = velocities.dy[id];
    if (inputStates.jump[id] === 1 && isGrounded) {
      newDy = JUMP_FORCE;
      players.isGrounded[id] = 0; // Set to false
    }

    velocities.dx[id] = newDx;
    velocities.dy[id] = newDy;
    velocities.dz[id] = newDz;
  },
).pipe(Effect.withSpan("playerMovementSystem"));