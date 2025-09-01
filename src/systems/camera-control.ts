import { clampPitch } from '@/domain/camera-logic';
import { setCameraState } from '@/domain/components';
import { playerQuery } from '@/domain/queries';
import { System } from '@/runtime/loop';
import { query, updateComponent } from '@/runtime/world';

const MOUSE_SENSITIVITY = 0.002;

export const cameraControlSystem: System = (world, { mouseDelta }) => {
  const { dx, dy } = mouseDelta;

  if (dx === 0 && dy === 0) {
    return [world, []];
  }

  const players = query(world, playerQuery);
  if (players.length === 0) {
    return [world, []];
  }

  const deltaPitch = -dy * MOUSE_SENSITIVITY;
  const deltaYaw = -dx * MOUSE_SENSITIVITY;

  const newWorld = players.reduce((currentWorld, player) => {
    const { entityId, cameraState } = player;

    const newPitch = clampPitch(cameraState.pitch + deltaPitch);
    const newYaw = cameraState.yaw + deltaYaw;

    const newCameraState = setCameraState(cameraState, {
      pitch: newPitch,
      yaw: newYaw,
    });

    return updateComponent(
      currentWorld,
      entityId,
      'cameraState',
      newCameraState,
    );
  }, world);

  return [newWorld, []];
};