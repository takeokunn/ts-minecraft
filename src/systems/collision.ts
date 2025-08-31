import { Effect } from 'effect';
import {
  type Collider,
  ColliderSchema,
  type Player,
  PlayerSchema,
  type Position,
  PositionSchema,
  TerrainBlockSchema,
  type Velocity,
  VelocitySchema,
} from '../domain/components';
import { GameState } from '../runtime/game-state';
import {
  type QueryResult,
  query,
  updateComponent,
  type World,
} from '../runtime/world';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

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

export const collisionSystem: Effect.Effect<void, never, World | GameState> =
  Effect.gen(function* (_) {
    const players: ReadonlyArray<
      QueryResult<
        [
          typeof PositionSchema,
          typeof VelocitySchema,
          typeof ColliderSchema,
          typeof PlayerSchema,
        ]
      >
    > = yield* _(
      query(PositionSchema, VelocitySchema, ColliderSchema, PlayerSchema),
    );
    const playerEntity = players[0];

    if (!playerEntity) {
      return;
    }

    const pos: Position = playerEntity.get(PositionSchema);
    const vel: Velocity = playerEntity.get(VelocitySchema);
    const col: Collider = playerEntity.get(ColliderSchema);
    const player: Player = playerEntity.get(PlayerSchema);

    const terrainBlocks = yield* _(query(PositionSchema, TerrainBlockSchema));
    const blockCollider: Collider = {
      _tag: 'Collider',
      width: 1,
      height: 1,
      depth: 1,
    };

    const newPos: Mutable<Position> = { ...pos };
    const newVel: Mutable<Velocity> = { ...vel };
    let isGrounded = false;

    // --- Broad phase: Get nearby blocks ---
    const nearbyBlocks = terrainBlocks.filter((block) => {
      const blockPos = block.get(PositionSchema);
      const dx = Math.abs(pos.x - blockPos.x);
      const dy = Math.abs(pos.y - blockPos.y);
      const dz = Math.abs(pos.z - blockPos.z);
      return dx < 4 && dy < 4 && dz < 4; // Check within a 4-block radius
    });

    // --- Y-axis collision ---
    newPos.y += newVel.dy;
    for (const block of nearbyBlocks) {
      const blockPos = block.get(PositionSchema);
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
    for (const block of nearbyBlocks) {
      const blockPos = block.get(PositionSchema);
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
    for (const block of nearbyBlocks) {
      const blockPos = block.get(PositionSchema);
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

    const newPlayerState: Player = { ...player, isGrounded };

    yield* _(updateComponent(playerEntity.id, newPos));
    yield* _(updateComponent(playerEntity.id, newVel));
    yield* _(updateComponent(playerEntity.id, newPlayerState));
  }).pipe(Effect.withSpan('collisionSystem'));