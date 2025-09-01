import type { AABB, EntityId } from '@/domain/types';

const CELL_SIZE = 4;

export type SpatialGrid = {
  register: (entityId: EntityId, aabb: AABB) => void;
  query: (aabb: AABB) => EntityId[];
  clear: () => void;
};

export function createSpatialGrid(): SpatialGrid {
  let grid: Map<string, Set<EntityId>> = new Map();

  const forEachCellInAABB = (aabb: AABB, callback: (key: string) => void): void => {
    const minCellX = Math.floor(aabb.minX / CELL_SIZE);
    const maxCellX = Math.floor(aabb.maxX / CELL_SIZE);
    const minCellY = Math.floor(aabb.minY / CELL_SIZE);
    const maxCellY = Math.floor(aabb.maxY / CELL_SIZE);
    const minCellZ = Math.floor(aabb.minZ / CELL_SIZE);
    const maxCellZ = Math.floor(aabb.maxZ / CELL_SIZE);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          callback(`${x},${y},${z}`);
        }
      }
    }
  };

  const register = (entityId: EntityId, aabb: AABB): void => {
    forEachCellInAABB(aabb, key => {
      if (!grid.has(key)) {
        grid.set(key, new Set());
      }
      grid.get(key)!.add(entityId);
    });
  };

  const query = (aabb: AABB): EntityId[] => {
    const potentialCollisions = new Set<EntityId>();
    forEachCellInAABB(aabb, key => {
      if (grid.has(key)) {
        for (const entityId of grid.get(key)!) {
          potentialCollisions.add(entityId);
        }
      }
    });
    return Array.from(potentialCollisions);
  };

  const clear = (): void => {
    grid.clear();
  };

  return {
    register,
    query,
    clear,
  };
}