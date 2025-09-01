
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import {
  CameraState,
  InputState,
  Velocity,
} from '@/domain/components';
import { match } from 'ts-pattern';

export const PLAYER_SPEED = 5;
export const SPRINT_MULTIPLIER = 1.6;
export const JUMP_FORCE = 7;
const DECELERATION = 0.98;
const MIN_VELOCITY_THRESHOLD = 0.001;

export const calculateHorizontalVelocity = (
  input: Pick<
    InputState,
    'forward' | 'backward' | 'left' | 'right' | 'sprint'
  >,
  camera: Pick<CameraState, 'yaw'>,
): { x: number; z: number } => {
  const speed = input.sprint
    ? PLAYER_SPEED * SPRINT_MULTIPLIER
    : PLAYER_SPEED;
  let moveX = 0;
  let moveZ = 0;

  if (input.forward) moveZ -= 1;
  if (input.backward) moveZ += 1;
  if (input.left) moveX -= 1;
  if (input.right) moveX += 1;

  const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }

  const sinYaw = Math.sin(camera.yaw);
  const cosYaw = Math.cos(camera.yaw);

  const x = moveX * cosYaw - moveZ * sinYaw;
  const z = moveX * sinYaw + moveZ * cosYaw;

  return { x: x * speed, z: z * speed };
};

export const calculateVerticalVelocity = (
  isGrounded: boolean,
  jumpPressed: boolean,
  currentY: number,
): number => {
  if (jumpPressed && isGrounded) {
    return JUMP_FORCE;
  }
  return currentY;
};

export const applyDeceleration = (
  velocity: Pick<Velocity, 'x' | 'z'>,
): Pick<Velocity, 'x' | 'z'> => {
  let { x, z } = velocity;
  x *= DECELERATION;
  z *= DECELERATION;

  if (Math.abs(x) < MIN_VELOCITY_THRESHOLD) x = 0;
  if (Math.abs(z) < MIN_VELOCITY_THRESHOLD) z = 0;

  return { x, z };
};

export const playerMovementSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const players = world.queries.playerMovement(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];
  const {
    entityId,
    player: playerData,
    inputState,
    velocity,
    cameraState,
  } = player;

  const newY = calculateVerticalVelocity(
    playerData.isGrounded,
    inputState.jump,
    velocity.y,
  );

  const hasHorizontalInput =
    inputState.forward ||
    inputState.backward ||
    inputState.left ||
    inputState.right;

  const { x, z } = match(hasHorizontalInput)
    .with(true, () => calculateHorizontalVelocity(inputState, cameraState))
    .otherwise(() => applyDeceleration(velocity));

  world.components.velocity.set(entityId, {
    x,
    y: newY,
    z,
  });

  if (inputState.jump && playerData.isGrounded) {
    world.components.player.set(entityId, { isGrounded: false });
  }
});
