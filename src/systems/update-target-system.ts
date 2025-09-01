import {
  createTargetBlock,
  createTargetNone,
} from '@/domain/components';
import { playerTargetQuery } from '@/domain/queries';
import { System } from '@/runtime/loop';
import { query, updateComponent } from '@/runtime/world';
import { match } from 'ts-pattern';

export const updateTargetSystem: System = (world, _deps) => {
  const { raycastResult } = world.globalState;
  const players = query(world, playerTargetQuery);

  if (players.length === 0) {
    return [world, []];
  }

  // Determine the new target state based on the raycast result.
  const newTarget = match(raycastResult)
    .with(null, () => createTargetNone())
    .otherwise(result => createTargetBlock(result.entityId, result.face));

  // Filter to find only players whose target needs to be updated.
  const playersToUpdate = players.filter(
    p => JSON.stringify(p.target) !== JSON.stringify(newTarget),
  );

  // If no players need an update, return the original world.
  if (playersToUpdate.length === 0) {
    return [world, []];
  }

  // Use reduce to apply the update to all relevant players.
  const newWorld = playersToUpdate.reduce((currentWorld, player) => {
    return updateComponent(
      currentWorld,
      player.entityId,
      'target',
      newTarget,
    );
  }, world);

  return [newWorld, []];
};