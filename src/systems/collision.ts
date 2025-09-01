import {
  Collider,
  Position,
  setPlayerGrounded,
  setPosition,
  setVelocity,
  Velocity,
} from '@/domain/components';
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry';
import { playerColliderQuery } from '@/domain/queries';
import { query as queryGrid } from '@/infrastructure/spatial-grid';
import { System } from '@/runtime/loop';
import { query, updateComponent } from '@/runtime/world';

type CollisionResult = {
  readonly newPosition: Position;
  readonly newVelocity: Velocity;
  readonly isGrounded: boolean;
};

export const resolveCollisions = (
  position: Position,
  velocity: Velocity,
  collider: Collider,
  nearbyAABBs: readonly AABB[],
): CollisionResult => {
  let newPos = { ...position };
  let newVel = { ...velocity };
  let isGrounded = false;

  // Y-axis
  newPos = setPosition(newPos, { y: newPos.y + newVel.dy });
  let playerAABB = createAABB(newPos, collider);
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dy > 0) {
        newPos = setPosition(newPos, { y: blockAABB.minY - collider.height });
      } else {
        newPos = setPosition(newPos, { y: blockAABB.maxY });
        isGrounded = true;
      }
      newVel = setVelocity(newVel, { dy: 0 });
      playerAABB = createAABB(newPos, collider);
    }
  }

  // X-axis
  newPos = setPosition(newPos, { x: newPos.x + newVel.dx });
  playerAABB = createAABB(newPos, collider);
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dx > 0) {
        newPos = setPosition(newPos, {
          x: blockAABB.minX - collider.width / 2,
        });
      } else {
        newPos = setPosition(newPos, {
          x: blockAABB.maxX + collider.width / 2,
        });
      }
      newVel = setVelocity(newVel, { dx: 0 });
      playerAABB = createAABB(newPos, collider);
    }
  }

  // Z-axis
  newPos = setPosition(newPos, { z: newPos.z + newVel.dz });
  playerAABB = createAABB(newPos, collider);
  for (const blockAABB of nearbyAABBs) {
    if (areAABBsIntersecting(playerAABB, blockAABB)) {
      if (newVel.dz > 0) {
        newPos = setPosition(newPos, {
          z: blockAABB.minZ - collider.depth / 2,
        });
      } else {
        newPos = setPosition(newPos, {
          z: blockAABB.maxZ + collider.depth / 2,
        });
      }
      newVel = setVelocity(newVel, { dz: 0 });
      playerAABB = createAABB(newPos, collider);
    }
  }

  return { newPosition: newPos, newVelocity: newVel, isGrounded };
};

export const collisionSystem: System = (world, _deps) => {
  const players = query(world, playerColliderQuery);
  if (players.length === 0) {
    return [world, []];
  }

  const { spatialGrid } = world.globalState;

  const newWorld = players.reduce((currentWorld, entity) => {
    const { entityId, position, velocity, collider, player } = entity;

    const broadphaseAABB = createAABB(
      {
        x: position.x + velocity.dx / 2,
        y: position.y + velocity.dy / 2,
        z: position.z + velocity.dz / 2,
      },
      {
        width: collider.width + Math.abs(velocity.dx),
        height: collider.height + Math.abs(velocity.dy),
        depth: collider.depth + Math.abs(velocity.dz),
      },
    );
    const nearbyEntityIds = queryGrid(spatialGrid, broadphaseAABB);

    const nearbyAABBs: AABB[] = [];
    for (const nearbyId of nearbyEntityIds) {
      if (nearbyId === entityId) continue;

      const pos = currentWorld.components.position.get(nearbyId);
      const col = currentWorld.components.collider.get(nearbyId);
      if (pos && col) {
        nearbyAABBs.push(createAABB(pos, col));
      }
    }

    const { newPosition, newVelocity, isGrounded } = resolveCollisions(
      position,
      velocity,
      collider,
      nearbyAABBs,
    );

    const worldWithNewPos = updateComponent(
      currentWorld,
      entityId,
      'position',
      newPosition,
    );
    const worldWithNewVel = updateComponent(
      worldWithNewPos,
      entityId,
      'velocity',
      newVelocity,
    );
    const newPlayerState = setPlayerGrounded(player, isGrounded);
    return updateComponent(
      worldWithNewVel,
      entityId,
      'player',
      newPlayerState,
    );
  }, world);

  return [newWorld, []];
};