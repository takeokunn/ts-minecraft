import { Effect, Option } from "effect";
import * as THREE from "three";
import {
  Collider,
  InputState,
  Player,
  Position,
  Renderable,
  Target,
  TerrainBlock,
} from "@/domain/components";
import { GameState } from "@/runtime/game-state";
import { Input, RenderContext } from "@/runtime/services";
import { World } from "@/runtime/world";
import type { BlockType } from "@/domain/block";

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
  const input = yield* _(Input);
  const gameState = yield* _(GameState);
  const renderContext = yield* _(RenderContext);

  const playerOption = yield* _(
    world.querySingle(Player, InputState, Position, Collider, Target),
  );

  if (Option.isNone(playerOption)) {
    return;
  }

  const [
    id,
    [_player, keyState, playerPos, playerCol, target],
  ] = playerOption.value;

  const mouseState = yield* _(input.getMouseState());

  if (
    !mouseState.leftClick &&
    !mouseState.rightClick &&
    !keyState.place
  ) {
    return;
  }

  // Block Destruction
  if (mouseState.leftClick) {
    // This is a simplified version. A robust solution would require
    // finding the entityId from the raycast result.
    // We'll approximate by finding an entity at the target position.
    const entitiesAtTarget = yield* _(world.query(Position, TerrainBlock));
    for (const [entityId, [pos]] of entitiesAtTarget) {
      if (
        pos.x === target.position.x &&
        pos.y === target.position.y &&
        pos.z === target.position.z
      ) {
        yield* _(
          gameState.addDestroyedBlock({
            x: pos.x,
            y: pos.y,
            z: pos.z,
          }),
        );
        yield* _(world.removeEntity(entityId));
        break; // Assume one block per position
      }
    }
  }

  // Block Placement
  if (mouseState.rightClick || keyState.place) {
    const newBlockPos = new THREE.Vector3(
      target.position.x + target.face[0],
      target.position.y + target.face[1],
      target.position.z + target.face[2],
    );

    if (checkPlayerCollision(newBlockPos, playerPos, playerCol)) {
      return;
    }

    const currentGameState = yield* _(gameState.get);
    const selectedBlockType =
      currentGameState.hotbar.slots[currentGameState.hotbar.selectedSlot];

    if (selectedBlockType) {
      yield* _(
        world.createEntity(
          new TerrainBlock(),
          new Position({
            x: newBlockPos.x,
            y: newBlockPos.y,
            z: newBlockPos.z,
          }),
          new Renderable({
            geometry: "box",
            blockType: selectedBlockType,
          }),
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
    if (keyState.place) {
      yield* _(world.updateComponent(id, { ...keyState, place: false }));
    }
  }
});
