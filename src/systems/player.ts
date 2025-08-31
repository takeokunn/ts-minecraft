

import { Effect } from 'effect';
import {
  CameraStateSchema,
  InputStateSchema,
  PlayerSchema,
  VelocitySchema,
} from '../domain/components';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import { Input } from '../runtime/services';
import {
  query,
  updateComponent,
  type World,
} from '../runtime/world';

const PLAYER_SPEED = 0.08;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_FORCE = 0.18;
const DECELERATION = 0.85;
const MIN_VELOCITY = 0.001;

export const playerControlSystem: Effect.Effect<
  void,
  never,
  World | Input | ThreeJsContext
> = Effect.gen(function* (_) {
  const players = yield* _(
    query(PlayerSchema, InputStateSchema, VelocitySchema, CameraStateSchema),
  );
  const playerEntity = players[0];
  if (!playerEntity) return;

  const inputService = yield* _(Input);
  const { controls } = yield* _(ThreeJsContext);
  const input = playerEntity.get(InputStateSchema);
  const velocity = playerEntity.get(VelocitySchema);
  const player = playerEntity.get(PlayerSchema);

  // --- Camera Rotation ---
  const mouseState = yield* _(inputService.getMouseState());
  // Directly manipulate the camera via controls, which is not ideal in ECS,
  // but PointerLockControls works this way.
  controls.moveRight(-mouseState.dx * 0.002); // Yaw
  const camera = controls.getObject().children[0];
  if (camera) {
    camera.rotation.x -= mouseState.dy * 0.002; // Pitch, applied to a child object
    // Clamp pitch
    const pitch = camera.rotation.x;
    camera.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, pitch),
    );
  }

  const yaw = controls.getObject().rotation.y;

  // --- Movement ---
  const speed = input.sprint
    ? PLAYER_SPEED * SPRINT_MULTIPLIER
    : PLAYER_SPEED;

  let dx = 0;
  let dz = 0;

  // Use the yaw from the controls object for movement calculation
  if (input.forward) {
    dx -= Math.sin(yaw) * speed;
    dz -= Math.cos(yaw) * speed;
  }
  if (input.backward) {
    dx += Math.sin(yaw) * speed;
    dz += Math.cos(yaw) * speed;
  }
  if (input.left) {
    dx -= Math.cos(yaw) * speed;
    dz += Math.sin(yaw) * speed;
  }
  if (input.right) {
    dx += Math.cos(yaw) * speed;
    dz -= Math.sin(yaw) * speed;
  }

  let newDx = dx;
  let newDz = dz;

  if (newDx === 0 && newDz === 0) {
    newDx = velocity.dx * DECELERATION;
    newDz = velocity.dz * DECELERATION;
    if (Math.abs(newDx) < MIN_VELOCITY) newDx = 0;
    if (Math.abs(newDz) < MIN_VELOCITY) newDz = 0;
  }

  // --- Jumping ---
  let newDy = velocity.dy;
  let newIsGrounded = player.isGrounded;

  if (input.jump && player.isGrounded) {
    newDy = JUMP_FORCE;
    newIsGrounded = false;
  }

  // --- Update Components ---
  yield* _(
    updateComponent(playerEntity.id, {
      _tag: 'Velocity',
      dx: newDx,
      dy: newDy,
      dz: newDz,
    }),
  );
  yield* _(
    updateComponent(playerEntity.id, {
      ...player,
      isGrounded: newIsGrounded,
    }),
  );
  // Sync CameraState with the controls for saving or other systems
  const cameraObject = controls.getObject().children[0];
  if (cameraObject) {
    yield* _(
      updateComponent(playerEntity.id, {
        _tag: 'CameraState',
        pitch: cameraObject.rotation.x,
        yaw: yaw,
      }),
    );
  }
}).pipe(Effect.withSpan('playerControlSystem'));
