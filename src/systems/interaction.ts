import { Effect } from 'effect';
import * as THREE from 'three';
import {
  ColliderSchema,
  InputStateSchema,
  PlayerSchema,
  PositionSchema,
  type Position,
  type Renderable,
  type TerrainBlock,
  type Collider,
} from '../domain/components';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import { type BlockType, GameState } from '../runtime/game-state';
import { Input, RenderContext, Renderer } from '../runtime/services';
import {
  createEntity,
  deleteEntity,
  getComponent,
  query,
  World,
} from '../runtime/world';

const raycaster = new THREE.Raycaster();
const REACH = 8; // How far the player can interact with blocks

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

export const interactionSystem: Effect.Effect<
  void,
  never,
  Input | ThreeJsContext | World | GameState | RenderContext | Renderer
> = Effect.gen(function* (_) {
  const input = yield* _(Input);
  const { camera, scene } = yield* _(ThreeJsContext);
  const renderer = yield* _(Renderer);
  yield* _(World);
  const gameState: GameState = yield* _(GameState);
  const renderContext = yield* _(RenderContext);

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children);

  let target: THREE.Intersection | null = null;
  for (const intersection of intersects) {
    // Ignore transparent objects like water for targeting
    const object = intersection.object as THREE.Mesh;
    if (
      object.name !== 'water' &&
      object.name !== 'glass' &&
      intersection.distance <= REACH
    ) {
      target = intersection;
      break;
    }
  }

  // Update highlight mesh via the Renderer service
  yield* _(renderer.updateHighlight(target));

  const mouseState = yield* _(input.getMouseState());
  const players = yield* _(
    query(PlayerSchema, InputStateSchema, PositionSchema, ColliderSchema),
  );
  const playerEntity = players[0];
  if (!playerEntity) return;

  const keyState = playerEntity.get(InputStateSchema);

  if (
    !target ||
    (!mouseState.leftClick && !mouseState.rightClick && !keyState.place)
  ) {
    return;
  }

  const { instanceId, object } = target;
  const blockType = object.name as BlockType;

  if (mouseState.leftClick && instanceId !== undefined) {
    const entityId = renderContext.instanceIdToEntityId
      .get(blockType)
      ?.get(instanceId);
    if (entityId) {
      const position = yield* _(getComponent(entityId, PositionSchema));
      if (position) {
        gameState.addDestroyedBlock({
          x: position.x,
          y: position.y,
          z: position.z,
        });
        yield* _(deleteEntity(entityId));
      }
    }
  }

  if ((mouseState.rightClick || keyState.place) && target.face) {
    // More accurate position calculation, similar to 3dminecraft.html
    const hitPos = new THREE.Vector3()
      .copy(target.point)
      .sub(target.face.normal.multiplyScalar(0.5))
      .round();
    const newBlockPos = new THREE.Vector3()
      .copy(hitPos)
      .add(target.face.normal);

    const playerPos = playerEntity.get(PositionSchema);
    const playerCol = playerEntity.get(ColliderSchema);

    if (checkPlayerCollision(newBlockPos, playerPos, playerCol)) {
      return; // Don't place block if it collides with the player
    }

    const selectedBlockType =
      gameState.hotbar.slots[gameState.hotbar.selectedSlot];

    if (selectedBlockType) {
      yield* _(
        createEntity(
          { _tag: 'TerrainBlock' } as TerrainBlock,
          {
            _tag: 'Position',
            x: newBlockPos.x,
            y: newBlockPos.y,
            z: newBlockPos.z,
          } as Position,
          {
            _tag: 'Renderable',
            geometry: 'box',
            blockType: selectedBlockType,
          } as Renderable,
        ),
      );
      gameState.addPlacedBlock({
        x: newBlockPos.x,
        y: newBlockPos.y,
        z: newBlockPos.z,
        blockType: selectedBlockType,
      });
    }
  }
});
