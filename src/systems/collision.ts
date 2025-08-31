import { Effect } from "effect";
import {
  Collider,
  Player,
  Position,
  TerrainBlock,
  Velocity,
} from "../domain/components";
import { World } from "../runtime/world";

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
    const {
      entities: playerEntities,
      positions: playerPositions,
      velocitys: playerVelocitys,
      colliders: playerColliders,
      players,
    } = yield* _(world.querySoA(Position, Velocity, Collider, Player));

    if (playerEntities.length === 0) {
      return;
    }

    const id = playerEntities[0];
    const pos = {
      x: playerPositions.x[0] as number,
      y: playerPositions.y[0] as number,
      z: playerPositions.z[0] as number,
    };
    const vel = {
      dx: playerVelocitys.dx[0] as number,
      dy: playerVelocitys.dy[0] as number,
      dz: playerVelocitys.dz[0] as number,
    };
    const col = {
      width: playerColliders.width[0] as number,
      height: playerColliders.height[0] as number,
      depth: playerColliders.depth[0] as number,
    };
    const player = {
      isGrounded: players.isGrounded[0] as boolean,
    };

    const {
      entities: blockEntities,
      positions: blockPositions,
      terrainBlocks,
    } = yield* _(world.querySoA(Position, TerrainBlock));

    const blockCollider = new Collider({
      width: 1,
      height: 1,
      depth: 1,
    });

    const newPos = { ...pos };
    const newVel = { ...vel };
    let isGrounded = false;

    // --- Broad phase: Get nearby blocks ---
    const nearbyBlocks: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < blockEntities.length; i++) {
      const blockPos = {
        x: blockPositions.x[i] as number,
        y: blockPositions.y[i] as number,
        z: blockPositions.z[i] as number,
      };
      const dx = Math.abs(pos.x - blockPos.x);
      const dy = Math.abs(pos.y - blockPos.y);
      const dz = Math.abs(pos.z - blockPos.z);
      if (dx < 4 && dy < 4 && dz < 4) {
        nearbyBlocks.push(blockPos);
      }
    }

    // --- Y-axis collision ---
    newPos.y += newVel.dy;
    for (const blockPos of nearbyBlocks) {
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
    for (const blockPos of nearbyBlocks) {
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
    for (const blockPos of nearbyBlocks) {
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
      world.updateComponent(id, new Player({ isGrounded })),
    );
  },
).pipe(Effect.withSpan("collisionSystem"));
