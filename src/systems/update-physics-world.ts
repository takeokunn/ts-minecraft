import { createAABB } from '@/domain/geometry';
import { positionColliderQuery } from '@/domain/queries';
import {
  createSpatialGrid,
  register,
} from '@/infrastructure/spatial-grid';
import { System } from '@/runtime/loop';
import { query } from '@/runtime/world';

/**
 * Rebuilds the spatial grid for broadphase collision detection.
 * This system should run after physics updates positions, but before collision resolution.
 */
export const updatePhysicsWorldSystem: System = (world, _deps) => {
  const collidableEntities = query(world, positionColliderQuery);

  // Optimization: If there are no collidable entities and the grid is already empty,
  // return the world as-is.
  if (
    collidableEntities.length === 0 &&
    world.globalState.spatialGrid.grid.size === 0
  ) {
    return [world, []];
  }

  // Create a new grid and register all collidable entities.
  const newGrid = collidableEntities.reduce((grid, entity) => {
    const { entityId, position, collider } = entity;
    const aabb = createAABB(position, collider);
    return register(grid, entityId, aabb);
  }, createSpatialGrid());

  // Return a new world state with the updated grid.
  const newWorld = {
    ...world,
    globalState: {
      ...world.globalState,
      spatialGrid: newGrid,
    },
  };
  return [newWorld, []];
};