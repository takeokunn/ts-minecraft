
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import {
  Collider,
  Position,
  type Hotbar,
} from '@/domain/components';
import { BlockType } from '@/domain/block';
import { match } from 'ts-pattern';

export const checkPlayerCollision = (
  blockPos: Position,
  playerPos: Position,
  playerCollider: Collider,
): boolean => {
  const minPx = playerPos.x - playerCollider.width / 2;
  const maxPx = playerPos.x + playerCollider.width / 2;
  const minPy = playerPos.y;
  const maxPy = playerPos.y + playerCollider.height;
  const minPz = playerPos.z - playerCollider.depth / 2;
  const maxPz = playerPos.z + playerCollider.depth / 2;

  const minBx = blockPos.x - 0.5;
  const maxBx = blockPos.x + 0.5;
  const minBy = blockPos.y - 0.5;
  const maxBy = blockPos.y + 0.5;
  const minBz = blockPos.z - 0.5;
  const maxBz = blockPos.z + 0.5;

  return (
    minPx < maxBx &&
    maxPx > minBx &&
    minPy < maxBy &&
    maxPy > minBy &&
    minPz < maxBz &&
    maxPz > minBz
  );
};

const getSelectedBlockType = (hotbar: Hotbar): BlockType | null => {
  const selectedSlotKey = `slot${hotbar.selectedSlot}` as keyof Hotbar;
  return (hotbar[selectedSlotKey] as BlockType) ?? null;
};

const handleDestroyBlock = (
  world: World,
  target: {
    entityId: number;
    faceX: number;
    faceY: number;
    faceZ: number;
  },
  targetPos: Position,
) => {
  const { x, y, z } = targetPos;
  const key = `${x},${y},${z}`;
  (world as any).globalState.editedBlocks.destroyed.add(key);
  (world as any).globalState.editedBlocks.placed.delete(key);
  return world.removeEntity(target.entityId);
};

const handlePlaceBlock = (
  world: World,
  player: any,
  target: any,
  targetPos: Position,
) => {
  const newBlockPos = {
    x: targetPos.x + target.faceX,
    y: targetPos.y + target.faceY,
    z: targetPos.z + target.faceZ,
  };

  const playerPos = (world as any).components.position.get(player.entityId);
  const playerCollider = (world as any).components.collider.get(player.entityId);

  if (
    !playerPos ||
    !playerCollider ||
    checkPlayerCollision(newBlockPos, playerPos, playerCollider)
  ) {
    return Effect.succeed(undefined);
  }

  const blockType = getSelectedBlockType(player.hotbar);
  if (!blockType) {
    return Effect.succeed(undefined);
  }

  const newBlockKey = `${newBlockPos.x},${newBlockPos.y},${newBlockPos.z}`;
  (world as any).globalState.editedBlocks.placed.set(newBlockKey, {
    ...newBlockPos,
    blockType,
  });
  (world as any).globalState.editedBlocks.destroyed.delete(newBlockKey);

  return (world as any).archetypes.createBlock(newBlockPos, blockType);
};

export const blockInteractionSystem = Effect.gen(function* ($) {
  const world = yield* $(World as any);
  const players = (world as any).queries.playerTarget(world);

  if (players.length === 0) {
    return;
  }
  const player = players[0];
  const {
    inputState: { place, destroy },
    target,
  } = player;

  if ((!place && !destroy) || target.entityId === -1) {
    return;
  }

  const targetPos = (world as any).components.position.get(target.entityId);
  if (!targetPos) {
    return;
  }

  yield* $(
    match({ place, destroy })
      .with({ destroy: true }, () =>
        handleDestroyBlock(world, target, targetPos),
      )
      .with({ place: true }, () =>
        handlePlaceBlock(world, player, target, targetPos),
      )
      .otherwise(() => Effect.succeed(undefined) as any),
  );
});
