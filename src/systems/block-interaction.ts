import { Effect, Option } from "effect";
import * as THREE from "three";
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
import { World } from "@/runtime/world";

// AABB check for player collision
const checkPlayerCollision = (
  blockPos: THREE.Vector3,
  playerPos: Position,
  playerCol: Collider,
): boolean => {
  const minPx = playerPos.x - playerCol.width / 2;
  const maxPx = playerPos.x + playerCol.width / 2;
  const minPy = playerPos.y - playerCol.height / 2;
  const maxPy = playerPos.y + playerCol.height / 2;
  const minPz = playerPos.z - playerCol.depth / 2;
  const maxPz = playerPos.z + playerCol.depth / 2;

  const minBx = blockPos.x - 0.5;
  const maxBx = blockPos.x + 0.5;
  const minBy = blockPos.y - 0.5;
  const maxBy = blockPos.y + 0.5;
  const minBz = blockPos.z - 0.5;
  const maxBz = blockPos.z + 0.5;

  return (
    minPx <= maxBx &&
    maxPx >= minBx &&
    minPy <= maxBy &&
    maxPy >= minBy &&
    minPz <= maxBz &&
    maxPz >= minBz
  );
};

export const blockInteractionSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const gameState = yield* _(GameState);

  const playerOption = yield* _(
    world.querySingle(Player, InputState, Position, Collider, Target, Hotbar),
  );

  if (Option.isNone(playerOption)) {
    return;
  }

  const [
    id,
    [_player, input, playerPos, playerCol, target, hotbar],
  ] = playerOption.value;

  // Block Destruction
  if (input.destroy) {
    yield* _(
      gameState.addDestroyedBlock({
        x: target.position.x,
        y: target.position.y,
        z: target.position.z,
      }),
    );
    yield* _(world.removeEntity(target.id));
  }

  // Block Placement
  if (input.place) {
    const newBlockPos = new THREE.Vector3(
      target.position.x + target.face[0],
      target.position.y + target.face[1],
      target.position.z + target.face[2],
    );

    if (checkPlayerCollision(newBlockPos, playerPos, playerCol)) {
      return;
    }

    const selectedBlockType = hotbar.slots[hotbar.selectedSlot];

    if (selectedBlockType) {
      yield* _(
        createBlock(
          {
            x: newBlockPos.x,
            y: newBlockPos.y,
            z: newBlockPos.z,
          },
          selectedBlockType,
        ),
      );
      yield* _(
        gameState.addPlacedBlock({
          x: newBlockPos.x,
          y: newBlockPos.y,
          z: newBlockPos.z,
          blockType: selectedBlockType,
        }),
      );
    }
  }
});

