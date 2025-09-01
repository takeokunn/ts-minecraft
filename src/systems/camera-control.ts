import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { Camera, Input } from '@/domain/types';
import { CameraState } from '@/domain/components';

const SENSITIVITY = 0.002;

export const calculateCameraState = (
  currentState: CameraState,
  mouseDelta: { dx: number; dy: number },
  sensitivity: number,
): CameraState => {
  const newYaw = currentState.yaw - mouseDelta.dx * sensitivity;
  const newPitch = currentState.pitch - mouseDelta.dy * sensitivity;
  const clampedPitch = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, newPitch),
  );
  return { yaw: newYaw, pitch: clampedPitch };
};

export const cameraControlSystem = Effect.gen(function* ($) {
  const world = yield* $(World as any);
  const input = yield* $(Input as any);
  const camera = yield* $(Camera as any);
  const players = (world as any).queries.player(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];
  const { entityId, cameraState } = player;

  const mouseDelta = input.getMouseDelta();
  const newCameraState = calculateCameraState(
    cameraState,
    mouseDelta,
    SENSITIVITY,
  );

  (world as any).components.cameraState.set(entityId, newCameraState);

  camera.setYaw(newCameraState.yaw);
  camera.rotatePitch(newCameraState.pitch - cameraState.pitch);
});