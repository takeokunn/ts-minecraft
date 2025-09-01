import { terrainBlockQuery } from '@/domain/queries';
import { EntityId } from '@/domain/entity';
import { query } from '@/runtime/world';
import { castRay } from '@/infrastructure/raycast-three';
import { System } from '@/runtime/loop';

export const raycastSystem: System = (world, deps) => {
  // Create a map of position strings to entity IDs for all terrain blocks.
  // This is used by the raycaster to quickly find which entity was hit.
  const terrainEntities = query(world, terrainBlockQuery);
  const terrainBlockMap = new Map<string, EntityId>(
    terrainEntities.map(e => {
      const { position, entityId } = e;
      return [`${position.x},${position.y},${position.z}`, entityId];
    }),
  );

  const raycastResult = castRay(deps.threeContext, terrainBlockMap);

  // Avoid creating a new world state if the result hasn't changed.
  if (world.globalState.raycastResult === raycastResult) {
    return [world, []];
  }

  // Return a new world object with the updated raycast result.
  const newWorld = {
    ...world,
    globalState: {
      ...world.globalState,
      raycastResult,
    },
  };
  return [newWorld, []];
};
