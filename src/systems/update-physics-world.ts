
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { SpatialGrid } from '@/infrastructure/spatial-grid';
import { AABB } from '@/domain/types';

export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const spatialGrid = yield* _(SpatialGrid);
  const colliders = world.queries.positionCollider(world);

  spatialGrid.clear();

  for (const entity of colliders) {
    const {
      entityId,
      position: { x, y, z },
      collider: { width, height, depth },
    } = entity;

    const aabb: AABB = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minY: y,
      maxY: y + height,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    };

    spatialGrid.insert(entityId, aabb);
  }
});
