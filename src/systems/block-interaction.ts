import { Effect } from "effect";
import { createBlock } from "@/domain/archetypes";
import {
  Collider,
  Hotbar,
  InputState,
  Player,
  Position,
  Target,
} from "@/domain/components";
import { GameState } from "@/runtime/game-state";
import {
  World,
  getComponentStore,
  queryEntities,
  removeEntity,
} from "@/runtime/world";
import { BlockType } from "@/domain/block";

const checkPlayerCollision = (
  blockX: number,
  blockY: number,
  blockZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerWidth: number,
  playerHeight: number,
  playerDepth: number,
): boolean => {
  const minPx = playerX - playerWidth / 2;
  const maxPx = playerX + playerWidth / 2;
  const minPy = playerY;
  const maxPy = playerY + playerHeight;
  const minPz = playerZ - playerDepth / 2;
  const maxPz = playerZ + playerDepth / 2;

  const minBx = blockX - 0.5;
  const maxBx = blockX + 0.5;
  const minBy = blockY - 0.5;
  const maxBy = blockY + 0.5;
  const minBz = blockZ - 0.5;
  const maxBz = blockZ + 0.5;

  return (
    minPx < maxBx &&
    maxPx > minBx &&
    minPy < maxBy &&
    maxPy > minBy &&
    minPz < maxBz &&
    maxPz > minBz
  );
};

export const blockInteractionSystem = Effect.gen(function* (_) {
  const gameState = yield* _(GameState);

  const query = {
    all: [Player, InputState, Position, Collider, Target, Hotbar],
  } as const;
  const players = yield* _(queryEntities(query));

  if (players.length === 0) {
    return;
  }
  const playerId = players[0];

  const inputs = yield* _(getComponentStore(InputState));
  const positions = yield* _(getComponentStore(Position));
  const colliders = yield* _(getComponentStore(Collider));
  const targets = yield* _(getComponentStore(Target));
  const hotbars = yield* _(getComponentStore(Hotbar));

  const placeInput = inputs.place[playerId] === 1;
  const destroyInput = inputs.destroy[playerId] === 1;

  if (!placeInput && !destroyInput) {
    return;
  }

  const targetId = targets.id[playerId];
  const targetPosX = targets.position.x[playerId];
  const targetPosY = targets.position.y[playerId];
  const targetPosZ = targets.position.z[playerId];

  // Block Destruction
  if (destroyInput) {
    yield* _(
      gameState.addDestroyedBlock({
        x: targetPosX,
        y: targetPosY,
        z: targetPosZ,
      }),
    );
    yield* _(removeEntity(targetId));
  }

  // Block Placement
  if (placeInput) {
    const newBlockX = targetPosX + targets.face.x[playerId];
    const newBlockY = targetPosY + targets.face.y[playerId];
    const newBlockZ = targetPosZ + targets.face.z[playerId];

    if (
      checkPlayerCollision(
        newBlockX,
        newBlockY,
        newBlockZ,
        positions.x[playerId],
        positions.y[playerId],
        positions.z[playerId],
        colliders.width[playerId],
        colliders.height[playerId],
        colliders.depth[playerId],
      )
    ) {
      return;
    }

    const selectedSlot = hotbars.selectedSlot[playerId];
    const selectedBlockType = hotbars[`slot${selectedSlot}` as keyof typeof hotbars][playerId] as BlockType;

    if (selectedBlockType) {
      yield* _(
        createBlock(
          { x: newBlockX, y: newBlockY, z: newBlockZ },
          selectedBlockType,
        ),
      );
      yield* _(
        gameState.addPlacedBlock({
          x: newBlockX,
          y: newBlockY,
          z: newBlockZ,
          blockType: selectedBlockType,
        }),
      );
    }
  }
});