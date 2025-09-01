import type { EntityId } from '@/domain/entity';
import type { AABB } from '@/domain/geometry';

const CELL_SIZE = 4;

export type SpatialGrid = {
  readonly _brand: 'SpatialGrid';
  readonly grid: ReadonlyMap<string, ReadonlySet<EntityId>>;
};

const forEachCellInAABB = (
  aabb: AABB,
  callback: (key: string) => void,
): void => {
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

export const createSpatialGrid = (): SpatialGrid => ({
  _brand: 'SpatialGrid',
  grid: new Map(),
});

export const register = (
  spatialGrid: SpatialGrid,
  entityId: EntityId,
  aabb: AABB,
): SpatialGrid => {
  const newGridMap = new Map(spatialGrid.grid);

  forEachCellInAABB(aabb, key => {
    const currentCell = newGridMap.get(key) ?? new Set();
    const newCell = new Set(currentCell);
    newCell.add(entityId);
    newGridMap.set(key, newCell);
  });

  return {
    ...spatialGrid,
    grid: newGridMap,
  };
};

export const query = (
  spatialGrid: SpatialGrid,
  aabb: AABB,
): readonly EntityId[] => {
  const potentialCollisions = new Set<EntityId>();
  forEachCellInAABB(aabb, key => {
    const cell = spatialGrid.grid.get(key);
    if (cell) {
      for (const entityId of cell) {
        potentialCollisions.add(entityId);
      }
    }
  });
  return Array.from(potentialCollisions);
};
