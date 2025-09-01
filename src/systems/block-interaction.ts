import { createArchetype } from '@/domain/archetypes';
import { PlacedBlock } from '@/domain/block';
import {
  createTargetNone,
  Position,
  setInputState,
} from '@/domain/components';
import { playerTargetQuery } from '@/domain/queries';
import { System } from '@/runtime/loop';
import { addArchetype, query, removeEntity, updateComponent, World } from '@/runtime/world';
import { match } from 'ts-pattern';

const getNewBlockPosition = (
  targetPosition: Position,
  face: { readonly x: number; readonly y: number; readonly z: number },
): Position => ({
  x: targetPosition.x + face.x,
  y: targetPosition.y + face.y,
  z: targetPosition.z + face.z,
});

const handleDestroyBlock = (world: World, player: ReturnType<typeof query<['player', 'inputState', 'target', 'hotbar']>>[number]): World => {
  if (player.target.type !== 'block') return world;

  const targetPosition = world.components.position.get(player.target.entityId);
  if (!targetPosition) return world;

  const blockKey = `${targetPosition.x},${targetPosition.y},${targetPosition.z}`;

  // 1. Remove the entity
  const worldWithoutEntity = removeEntity(world, player.target.entityId);

  // 2. Update edited blocks state
  const newDestroyed = new Set(worldWithoutEntity.globalState.editedBlocks.destroyed).add(blockKey);
  const newPlaced = { ...worldWithoutEntity.globalState.editedBlocks.placed };
  delete newPlaced[blockKey];

  const worldWithUpdatedState = {
    ...worldWithoutEntity,
    globalState: {
      ...worldWithoutEntity.globalState,
      editedBlocks: {
        placed: newPlaced,
        destroyed: newDestroyed,
      },
    },
  };

  // 3. Reset player's target
  return updateComponent(worldWithUpdatedState, player.entityId, 'target', createTargetNone());
};

const handlePlaceBlock = (world: World, player: ReturnType<typeof query<['player', 'inputState', 'target', 'hotbar']>>[number]): World => {
  if (player.target.type !== 'block') return world;

  const targetPosition = world.components.position.get(player.target.entityId);
  if (!targetPosition) return world;

  const { hotbar } = player;
  const newBlockPos = getNewBlockPosition(targetPosition, player.target.face);
  const selectedBlockType = hotbar.slots[hotbar.selectedIndex];
  if (!selectedBlockType) return world;

  // 1. Create and add the new block entity
  const newBlockArchetype = createArchetype({
    type: 'block',
    pos: newBlockPos,
    blockType: selectedBlockType,
  });
  const [worldWithNewBlock] = addArchetype(world, newBlockArchetype);

  // 2. Update edited blocks state
  const blockKey = `${newBlockPos.x},${newBlockPos.y},${newBlockPos.z}`;
  const newBlock: PlacedBlock = {
    position: newBlockPos,
    blockType: selectedBlockType,
  };
  const newPlaced = { ...worldWithNewBlock.globalState.editedBlocks.placed, [blockKey]: newBlock };
  const newDestroyed = new Set(worldWithNewBlock.globalState.editedBlocks.destroyed);
  newDestroyed.delete(blockKey);

  const worldWithUpdatedState = {
    ...worldWithNewBlock,
    globalState: {
      ...worldWithNewBlock.globalState,
      editedBlocks: {
        placed: newPlaced,
        destroyed: newDestroyed,
      },
    },
  };

  // 3. Reset place input to prevent placing multiple blocks
  const newPlayerInput = setInputState(player.inputState, { place: false });
  return updateComponent(worldWithUpdatedState, player.entityId, 'inputState', newPlayerInput);
};

export const blockInteractionSystem: System = (world, _deps) => {
  const players = query(world, playerTargetQuery);

  const newWorld = players.reduce((currentWorld, player) => {
    return match(player)
      .with(
        { target: { type: 'block' }, inputState: { destroy: true } },
        p => handleDestroyBlock(currentWorld, p),
      )
      .with(
        { target: { type: 'block' }, inputState: { place: true } },
        p => handlePlaceBlock(currentWorld, p),
      )
      .otherwise(() => currentWorld);
  }, world);

  return [newWorld, []];
};
