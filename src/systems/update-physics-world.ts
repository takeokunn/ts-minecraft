import { Effect } from "effect";
import { World, getComponentStore, queryEntities } from "@/runtime/world";
import { SpatialGrid, AABB } from "@/runtime/services";
import { positionColliderQuery } from "@/domain/queries";
import { Collider, Position } from "@/domain/components";

/**
 * A system that runs each frame to clear and repopulate the SpatialGrid.
 * This ensures that broad-phase collision detection operates on up-to-date entity positions.
 */
export const updatePhysicsWorldSystem = Effect.gen(function* (_) {
  const spatialGrid = yield* _(SpatialGrid);

  // 1. Clear the spatial grid from the previous frame.
  yield* _(spatialGrid.clear());

  // 2. Query for all entities that have a physical presence.
  const entities = yield* _(queryEntities(positionColliderQuery));
  if (entities.length === 0) {
    return;
  }

  const positions = yield* _(getComponentStore(Position));
  const colliders = yield* _(getComponentStore(Collider));

  // 3. Register each entity's AABB in the spatial grid for this frame.
  const registerEffects = [];
  for (const entityId of entities) {
    const posX = positions.x[entityId];
    const posY = positions.y[entityId];
    const posZ = positions.z[entityId];
    const colWidth = colliders.width[entityId];
    const colHeight = colliders.height[entityId];
    const colDepth = colliders.depth[entityId];

    const aabb: AABB = {
      minX: posX - colWidth / 2,
      maxX: posX + colWidth / 2,
      minY: posY,
      maxY: posY + colHeight,
      minZ: posZ - colDepth / 2,
      maxZ: posZ + colDepth / 2,
    };

    registerEffects.push(spatialGrid.register(entityId, aabb));
  }

  yield* _(
    Effect.all(registerEffects, { discard: true, concurrency: "unbounded" }),
  );
}).pipe(Effect.withSpan("updatePhysicsWorldSystem"));