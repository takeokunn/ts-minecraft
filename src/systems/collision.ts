
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { SpatialGrid } from '@/infrastructure/spatial-grid';
import { AABB, Position, Velocity } from '@/domain/types';
import { pipe } from 'effect/Function';
import { match } from 'ts-pattern';

export const aabbIntersect = (a: AABB, b: AABB): boolean => {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
};

type CollisionResult = {
  newPosition: Position;
  newVelocity: Velocity;
  isGrounded: boolean;
};

const resolveAxisCollision = (
  axis: 'x' | 'y' | 'z',
  pos: Position,
  vel: Velocity,
  aabb: AABB,
  nearbyAABBs: AABB[],
): {
  pos: Position;
  vel: Velocity;
  isGrounded?: boolean;
} => {
  const { width, height, depth } = {
    width: aabb.maxX - aabb.minX,
    height: aabb.maxY - aabb.minY,
    depth: aabb.maxZ - aabb.minZ,
  };

  const newPos = { ...pos };
  const newVel = { ...vel };
  let isGrounded = false;

  const [p, d, s] = match(axis)
    .with('x', () => ['x', 'dx', width] as const)
    .with('y', () => ['y', 'dy', height] as const)
    .with('z', () => ['z', 'dz', depth] as const)
    .exhaustive();

  newPos[p] += newVel[d];

  const sweptAABB: AABB = {
    minX: newPos.x - width / 2,
    maxX: newPos.x + width / 2,
    minY: newPos.y,
    maxY: newPos.y + height,
    minZ: newPos.z - depth / 2,
    maxZ: newPos.z + depth / 2,
  };

  for (const blockAABB of nearbyAABBs) {
    if (aabbIntersect(sweptAABB, blockAABB)) {
      if (newVel[d] > 0) {
        newPos[p] =
          blockAABB[match(axis)
            .with('x', () => 'minX' as const)
            .with('y', () => 'minY' as const)
            .with('z', () => 'minZ' as const)
            .exhaustive()] -
          (axis === 'y' ? height : s / 2);
      } else {
        newPos[p] =
          blockAABB[match(axis)
            .with('x', () => 'maxX' as const)
            .with('y', () => 'maxY' as const)
            .with('z', () => 'maxZ' as const)
            .exhaustive()] + (axis === 'y' ? 0 : s / 2);
        if (axis === 'y') {
          isGrounded = true;
        }
      }
      newVel[d] = 0;
      break;
    }
  }

  return { pos: newPos, vel: newVel, isGrounded };
};

export const resolveCollisions = (
  entityAABB: AABB,
  entityVelocity: Velocity,
  nearbyAABBs: AABB[],
): CollisionResult => {
  const width = entityAABB.maxX - entityAABB.minX;
  const depth = entityAABB.maxZ - entityAABB.minZ;

  const initialPos = {
    x: entityAABB.minX + width / 2,
    y: entityAABB.minY,
    z: entityAABB.minZ + depth / 2,
  };

  const yResult = resolveAxisCollision(
    'y',
    initialPos,
    entityVelocity,
    entityAABB,
    nearbyAABBs,
  );
  const xResult = resolveAxisCollision(
    'x',
    yResult.pos,
    yResult.vel,
    entityAABB,
    nearbyAABBs,
  );
  const zResult = resolveAxisCollision(
    'z',
    xResult.pos,
    xResult.vel,
    entityAABB,
    nearbyAABBs,
  );

  return {
    newPosition: zResult.pos,
    newVelocity: zResult.vel,
    isGrounded: yResult.isGrounded ?? false,
  };
};

export const collisionSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const spatialGrid = yield* _(SpatialGrid);
  const players = world.queries.playerCollider(world);

  for (const player of players) {
    const {
      entityId,
      position,
      velocity,
      collider: { width, height, depth },
    } = player;

    const entityAABB: AABB = {
      minX: position.x - width / 2,
      maxX: position.x + width / 2,
      minY: position.y,
      maxY: position.y + height,
      minZ: position.z - depth / 2,
      maxZ: position.z + depth / 2,
    };

    const queryAABB: AABB = {
      minX: entityAABB.minX - 2,
      maxX: entityAABB.maxX + 2,
      minY: entityAABB.minY - 2,
      maxY: entityAABB.maxY + 2,
      minZ: entityAABB.minZ - 2,
      maxZ: entityAABB.maxZ + 2,
    };
    const nearbyEntityIds = spatialGrid.query(queryAABB);

    const nearbyAABBs: AABB[] = nearbyEntityIds
      .filter((nearbyId) => nearbyId !== entityId)
      .flatMap((nearbyId) => {
        const nearbyPos = world.components.position.get(nearbyId);
        const nearbyCollider =
          world.components.collider.get(nearbyId);
        if (nearbyPos && nearbyCollider) {
          return [
            {
              minX: nearbyPos.x - nearbyCollider.width / 2,
              maxX: nearbyPos.x + nearbyCollider.width / 2,
              minY: nearbyPos.y - nearbyCollider.height / 2,
              maxY: nearbyPos.y + nearbyCollider.height / 2,
              minZ: nearbyPos.z - nearbyCollider.depth / 2,
              maxZ: nearbyPos.z + nearbyCollider.depth / 2,
            },
          ];
        }
        return [];
      });

    const { newPosition, newVelocity, isGrounded } = resolveCollisions(
      entityAABB,
      velocity,
      nearbyAABBs,
    );

    world.components.position.set(entityId, newPosition);
    world.components.velocity.set(entityId, newVelocity);
    world.components.player.set(entityId, { isGrounded });
  }
});
