import { Effect, Layer, Ref } from "effect";
import { AABB, SpatialGrid } from "@/runtime/services";
import { EntityId } from "@/domain/entity";

const CELL_SIZE = 4; // World units

const make = Effect.gen(function* (_) {
  // The spatial grid is a map where the key is a cell coordinate (e.g., "x,y,z")
  // and the value is a set of entity IDs in that cell.
  const grid = Ref.unsafeMake(new Map<string, Set<EntityId>>());

  const getCellCoords = (x: number, y: number, z: number) => {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const cellZ = Math.floor(z / CELL_SIZE);
    return `${cellX},${cellY},${cellZ}`;
  };

  const self: SpatialGrid = {
    clear: () => Ref.set(grid, new Map()),

    register: (entityId, aabb) =>
      Ref.update(grid, (g) => {
        const minCellX = Math.floor(aabb.minX / CELL_SIZE);
        const maxCellX = Math.floor(aabb.maxX / CELL_SIZE);
        const minCellY = Math.floor(aabb.minY / CELL_SIZE);
        const maxCellY = Math.floor(aabb.maxY / CELL_SIZE);
        const minCellZ = Math.floor(aabb.minZ / CELL_SIZE);
        const maxCellZ = Math.floor(aabb.maxZ / CELL_SIZE);

        for (let x = minCellX; x <= maxCellX; x++) {
          for (let y = minCellY; y <= maxCellY; y++) {
            for (let z = minCellZ; z <= maxCellZ; z++) {
              const key = `${x},${y},${z}`;
              if (!g.has(key)) {
                g.set(key, new Set());
              }
              g.get(key)!.add(entityId);
            }
          }
        }
        return g;
      }),

    query: (aabb) =>
      Ref.get(grid).pipe(
        Effect.map((g) => {
          const potentialCollisions = new Set<EntityId>();
          const minCellX = Math.floor(aabb.minX / CELL_SIZE);
          const maxCellX = Math.floor(aabb.maxX / CELL_SIZE);
          const minCellY = Math.floor(aabb.minY / CELL_SIZE);
          const maxCellY = Math.floor(aabb.maxY / CELL_SIZE);
          const minCellZ = Math.floor(aabb.minZ / CELL_SIZE);
          const maxCellZ = Math.floor(aabb.maxZ / CELL_SIZE);

          for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
              for (let z = minCellZ; z <= maxCellZ; z++) {
                const key = `${x},${y},${z}`;
                if (g.has(key)) {
                  for (const entityId of g.get(key)!) {
                    potentialCollisions.add(entityId);
                  }
                }
              }
            }
          }
          return Array.from(potentialCollisions);
        }),
      ),
  };

  return self;
});

export const SpatialGridLive = Layer.effect(SpatialGrid, make);
