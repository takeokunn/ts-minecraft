import { Effect } from 'effect';
import {
  Collider,
  Player,
  Position,
  TerrainBlock,
  Velocity,
} from '../domain/components';
import { World } from '../runtime/world';

// Axis-Aligned Bounding Box (AABB) intersection test.
const aabbIntersect = (
  minAx: number,
  minAy: number,
  minAz: number,
  maxAx: number,
  maxAy: number,
  maxAz: number,
  minBx: number,
  minBy: number,
  minBz: number,
  maxBx: number,
  maxBy: number,
  maxBz: number,
): boolean => {
  return (
    minAx <= maxBx &&
    maxAx >= minBx &&
    minAy <= maxBy &&
    maxAy >= minBy &&
    minAz <= maxBz &&
    maxAz >= minBz
  );
};

export const collisionSystem: Effect.Effect<void, never, World> = Effect.gen(
  function* (_) {
    const world = yield* _(World);
    const playerOption = yield* _(
      world.querySingle(Position, Velocity, Collider, Player),
    );

    if (Option.isNone(playerOption)) {
      return;
    }

    const [id, [pos, vel, col, player]] = playerOption.value;

    const terrainBlocks = yield* _(world.query(Position, TerrainBlock));
    const blockCollider = new Collider({
      width: 1,
      height: 1,
      depth: 1,
    });

    const newPos = { ...pos };
    const newVel = { ...vel };
    let isGrounded = false;

    // --- Broad phase: Get nearby blocks ---
    const nearbyBlocks: [Position, TerrainBlock][] = [];
    for (const [_id, components] of terrainBlocks) {
      const blockPos = components[0];
      const dx = Math.abs(pos.x - blockPos.x);
      const dy = Math.abs(pos.y - blockPos.y);
      const dz = Math.abs(pos.z - blockPos.z);
      if (dx < 4 && dy < 4 && dz < 4) {
        nearbyBlocks.push(components);
      }
    }

    // --- Y-axis collision ---
    newPos.y += newVel.dy;
    for (const [blockPos] of nearbyBlocks) {
      if (
        aabbIntersect(
          newPos.x - col.width / 2,
          newPos.y - col.height / 2,
          newPos.z - col.depth / 2,
          newPos.x + col.width / 2,
          newPos.y + col.height / 2,
          newPos.z + col.depth / 2,
          blockPos.x - blockCollider.width / 2,
          blockPos.y - blockCollider.height / 2,
          blockPos.z - blockCollider.depth / 2,
          blockPos.x + blockCollider.width / 2,
          blockPos.y + blockCollider.height / 2,
          blockPos.z + blockCollider.depth / 2,
        )
      ) {
        if (newVel.dy > 0) {
          // Moving up
          newPos.y = blockPos.y - blockCollider.height / 2 - col.height / 2;
        } else {
          // Moving down
          newPos.y = blockPos.y + blockCollider.height / 2 + col.height / 2;
          isGrounded = true;
        }
        newVel.dy = 0;
        break;
      }
    }

    // --- X-axis collision ---
    newPos.x += newVel.dx;
    for (const [blockPos] of nearbyBlocks) {
      if (
        aabbIntersect(
          newPos.x - col.width / 2,
          newPos.y - col.height / 2,
          newPos.z - col.depth / 2,
          newPos.x + col.width / 2,
          newPos.y + col.height / 2,
          newPos.z + col.depth / 2,
          blockPos.x - blockCollider.width / 2,
          blockPos.y - blockCollider.height / 2,
          blockPos.z - blockCollider.depth / 2,
          blockPos.x + blockCollider.width / 2,
          blockPos.y + blockCollider.height / 2,
          blockPos.z + blockCollider.depth / 2,
        )
      ) {
        if (newVel.dx > 0) {
          // Moving right
          newPos.x = blockPos.x - blockCollider.width / 2 - col.width / 2;
        } else {
          // Moving left
          newPos.x = blockPos.x + blockCollider.width / 2 + col.width / 2;
        }
        newVel.dx = 0;
        break;
      }
    }

    // --- Z-axis collision ---
    newPos.z += newVel.dz;
    for (const [blockPos] of nearbyBlocks) {
      if (
        aabbIntersect(
          newPos.x - col.width / 2,
          newPos.y - col.height / 2,
          newPos.z - col.depth / 2,
          newPos.x + col.width / 2,
          newPos.y + col.height / 2,
          newPos.z + col.depth / 2,
          blockPos.x - blockCollider.width / 2,
          blockPos.y - blockCollider.height / 2,
          blockPos.z - blockCollider.depth / 2,
          blockPos.x + blockCollider.width / 2,
          blockPos.y + blockCollider.height / 2,
          blockPos.z + blockCollider.depth / 2,
        )
      ) {
        if (newVel.dz > 0) {
          // Moving forward
          newPos.z = blockPos.z - blockCollider.depth / 2 - col.depth / 2;
        } else {
          // Moving backward
          newPos.z = blockPos.z + blockCollider.depth / 2 + col.depth / 2;
        }
        newVel.dz = 0;
        break;
      }
    }

    yield* _(world.updateComponent(id, new Position(newPos)));
    yield* _(world.updateComponent(id, new Velocity(newVel)));
    yield* _(
      world.updateComponent(id, new Player({ ...player, isGrounded })),
    );
  },
).pipe(Effect.withSpan('collisionSystem'));
