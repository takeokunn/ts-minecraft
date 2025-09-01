import { setInputState } from '@/domain/components';
import { playerInputQuery } from '@/domain/queries';
import { System } from '@/runtime/loop';
import { query, updateComponent } from '@/runtime/world';

export const inputPollingSystem: System = (world, deps) => {
  const { keyboard, isLocked } = deps.inputState;
  const players = query(world, playerInputQuery);

  if (players.length === 0) {
    return [world, []];
  }

  // Use reduce to thread the world state through the updates, ensuring immutability
  const newWorld = players.reduce((currentWorld, player) => {
    const newPlayerInputState = setInputState(player.inputState, {
      forward: keyboard.has('KeyW'),
      backward: keyboard.has('KeyS'),
      left: keyboard.has('KeyA'),
      right: keyboard.has('KeyD'),
      jump: keyboard.has('Space'),
      sprint: keyboard.has('ShiftLeft'),
      destroy: keyboard.has('Mouse0'), // Left-click
      place: keyboard.has('Mouse2'), // Right-click
      isLocked,
    });

    return updateComponent(
      currentWorld,
      player.entityId,
      'inputState',
      newPlayerInputState,
    );
  }, world);

  return [newWorld, []];
};
