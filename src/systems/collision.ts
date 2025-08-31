import { Effect } from "effect";
import { Collider, Player, Position, Velocity } from "../domain/components";
import { playerColliderQuery } from "../domain/queries";
import {
  World,
  getComponentStore,
  queryEntities,
} from "../runtime/world";
import { AABB, SpatialGrid } from "@/runtime/services";
import { EntityId } from "@/domain/entity";

// Axis-Aligned Bounding Box (AABB) intersection test.
const aabbIntersect = (a: AABB, b: AABB): boolean => {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY &&
    a.minZ <= b.maxZ &&
    a.maxZ >= b.minZ
  );
};

export const collisionSystem: Effect.Effect<
  void,
  never,
  World | SpatialGrid
> = Effect.gen(function* (_) {
  const spatialGrid = yield* _(SpatialGrid);

  const players = yield* _(queryEntities(playerColliderQuery));
  if (players.length === 0) {
    return;
  }
  const id = players[0];

  const positions = yield* _(getComponentStore(Position));
  const velocities = yield* _(getComponentStore(Velocity));
  const colliders = yield* _(getComponentStore(Collider));
  const playerStates = yield* _(getComponentStore(Player));

  const posX = positions.x[id];
  const posY = positions.y[id];
  const posZ = positions.z[id];
  const colWidth = colliders.width[id];
  const colHeight = colliders.height[id];
  const colDepth = colliders.depth[id];

  // --- 1. Broad phase: Get nearby entities from the spatial grid ---
  const queryAABB: AABB = {
    minX: posX - colWidth / 2 - 2,
    maxX: posX + colWidth / 2 + 2,
    minY: posY - 2,
    maxY: posY + colHeight + 2,
    minZ: posZ - colDepth / 2 - 2,
    maxZ: posZ + colDepth / 2 + 2,
  };
  const nearbyEntityIds = yield* _(spatialGrid.query(queryAABB));

  if (nearbyEntityIds.length === 0) {
    // No need to update anything, physics system already moved the entity
    return;
  }

  // --- 2. Create a fast-access list of AABBs for the narrow phase ---
  const nearbyAABBs: AABB[] = [];
  for (const nearbyId of nearbyEntityIds) {
    if (nearbyId === id) continue; // Don't collide with self
    nearbyAABBs.push({
      minX: positions.x[nearbyId] - colliders.width[nearbyId] / 2,
      maxX: positions.x[nearbyId] + colliders.width[nearbyId] / 2,
      minY: positions.y[nearbyId],
      maxY: positions.y[nearbyId] + colliders.height[nearbyId],
      minZ: positions.z[nearbyId] - colliders.depth[nearbyId] / 2,
      maxZ: positions.z[nearbyId] + colliders.depth[nearbyId] / 2,
    });
  }

  // --- 3. Narrow phase: Resolve collisions axis by axis ---
  let newPosX = posX;
  let newPosY = posY;
  let newPosZ = posZ;
  let velDx = velocities.dx[id];
  let velDy = velocities.dy[id];
  let velDz = velocities.dz[id];
  let isGrounded = false;

  // Y-axis
  newPosY += velDy;
  let playerSweptAABB: AABB = {
    minX: newPosX - colWidth / 2, maxX: newPosX + colWidth / 2,
    minY: newPosY, maxY: newPosY + colHeight,
    minZ: newPosZ - colDepth / 2, maxZ: newPosZ + colDepth / 2,
  };
  for (const blockAABB of nearbyAABBs) {
    if (aabbIntersect(playerSweptAABB, blockAABB)) {
      if (velDy > 0) newPosY = blockAABB.minY - colHeight;
      else {
        newPosY = blockAABB.maxY;
        isGrounded = true;
      }
      velDy = 0;
      break;
    }
  }

  // X-axis
  newPosX += velDx;
  playerSweptAABB = {
    minX: newPosX - colWidth / 2, maxX: newPosX + colWidth / 2,
    minY: newPosY, maxY: newPosY + colHeight,
    minZ: newPosZ - colDepth / 2, maxZ: newPosZ + colDepth / 2,
  };
  for (const blockAABB of nearbyAABBs) {
    if (aabbIntersect(playerSweptAABB, blockAABB)) {
      if (velDx > 0) newPosX = blockAABB.minX - colWidth / 2;
      else newPosX = blockAABB.maxX + colWidth / 2;
      velDx = 0;
      break;
    }
  }

  // Z-axis
  newPosZ += velDz;
  playerSweptAABB = {
    minX: newPosX - colWidth / 2, maxX: newPosX + colWidth / 2,
    minY: newPosY, maxY: newPosY + colHeight,
    minZ: newPosZ - colDepth / 2, maxZ: newPosZ + colDepth / 2,
  };
  for (const blockAABB of nearbyAABBs) {
    if (aabbIntersect(playerSweptAABB, blockAABB)) {
      if (velDz > 0) newPosZ = blockAABB.minZ - colDepth / 2;
      else newPosZ = blockAABB.maxZ + colDepth / 2;
      velDz = 0;
      break;
    }
  }

  // --- 4. Apply the final state to the component stores ---
  positions.x[id] = newPosX;
  positions.y[id] = newPosY;
  positions.z[id] = newPosZ;
  velocities.dx[id] = velDx;
  velocities.dy[id] = velDy;
  velocities.dz[id] = velDz;
  playerStates.isGrounded[id] = isGrounded ? 1 : 0;
}).pipe(Effect.withSpan("collisionSystem"));