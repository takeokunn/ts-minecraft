import { match } from 'ts-pattern';
import { BlockType, hotbarSlots } from './block';
import {
  Components,
  Position,
  createHotbar,
  createInputState,
  createPosition,
  createTargetNone,
  createVelocity,
} from './components';

export type Archetype = Partial<Components>;

export type ArchetypeBuilder =
  | { readonly type: 'player'; readonly pos: Position }
  | {
      readonly type: 'block';
      readonly pos: Position;
      readonly blockType: BlockType;
    }
  | { readonly type: 'camera'; readonly pos: Position }
  | { readonly type: 'targetBlock'; readonly pos: Position };

const playerArchetype = (pos: Position): Archetype => ({
  player: { isGrounded: false },
  position: createPosition(pos.x, pos.y, pos.z),
  velocity: createVelocity(0, 0, 0),
  gravity: { value: 0.01 },
  cameraState: { pitch: 0, yaw: 0 },
  inputState: createInputState(),
  collider: {
    width: 0.6,
    height: 1.8,
    depth: 0.6,
  },
  hotbar: createHotbar(hotbarSlots, 0),
  target: createTargetNone(),
});

const blockArchetype = (
  pos: Position,
  blockType: BlockType,
): Archetype => ({
  position: createPosition(pos.x, pos.y, pos.z),
  renderable: {
    geometry: 'box' as const,
    blockType,
  },
  collider: { width: 1, height: 1, depth: 1 },
  terrainBlock: {},
});

const cameraArchetype = (pos: Position): Archetype => ({
  camera: {},
  position: createPosition(pos.x, pos.y, pos.z),
});

const targetBlockArchetype = (pos: Position): Archetype => ({
  position: createPosition(pos.x, pos.y, pos.z),
  targetBlock: {},
});

import { match } from 'ts-pattern';
import { BlockType, hotbarSlots } from './block';
import {
  Components,
  Position,
  createCamera,
  createCameraState,
  createCollider,
  createGravity,
  createHotbar,
  createInputState,
  createPosition,
  createRenderable,
  createTargetBlockComponent,
  createTargetNone,
  createTerrainBlock,
  createVelocity,
} from './components';

// --- Constants ---

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const PLAYER_DEPTH = 0.6;
const PLAYER_GRAVITY = 0.01;
const BLOCK_SIZE = 1;

// --- Types ---

/**
 * An archetype is a template for creating an entity, defined as a partial set of components.
 */
export type Archetype = Partial<Components>;

/**
 * A builder type to specify which archetype to create and with what parameters.
 * This is used with the `createArchetype` function.
 */
export type ArchetypeBuilder =
  | { readonly type: 'player'; readonly pos: Position }
  | {
      readonly type: 'block';
      readonly pos: Position;
      readonly blockType: BlockType;
    }
  | { readonly type: 'camera'; readonly pos: Position }
  | { readonly type: 'targetBlock'; readonly pos: Position };

// --- Private Archetype Factories ---

const playerArchetype = (pos: Position): Archetype => ({
  player: { isGrounded: false },
  position: createPosition(pos.x, pos.y, pos.z),
  velocity: createVelocity(0, 0, 0),
  gravity: createGravity(PLAYER_GRAVITY),
  cameraState: createCameraState(0, 0),
  inputState: createInputState(),
  collider: createCollider(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH),
  hotbar: createHotbar(hotbarSlots, 0),
  target: createTargetNone(),
});

const blockArchetype = (
  pos: Position,
  blockType: BlockType,
): Archetype => ({
  position: createPosition(pos.x, pos.y, pos.z),
  renderable: createRenderable('box', blockType),
  collider: createCollider(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE),
  terrainBlock: createTerrainBlock(),
});

const cameraArchetype = (pos: Position): Archetype => ({
  camera: createCamera(),
  position: createPosition(pos.x, pos.y, pos.z),
});

const targetBlockArchetype = (pos: Position): Archetype => ({
  position: createPosition(pos.x, pos.y, pos.z),
  targetBlock: createTargetBlockComponent(),
});

// --- Public API ---

/**
 * Creates an archetype object based on the provided builder.
 * @param builder - The archetype builder specifying the type and parameters.
 * @returns An archetype object (a partial set of components).
 */
export const createArchetype = (builder: ArchetypeBuilder): Archetype => {
  return match(builder)
    .with({ type: 'player' }, ({ pos }) => playerArchetype(pos))
    .with({ type: 'block' }, ({ pos, blockType }) =>
      blockArchetype(pos, blockType),
    )
    .with({ type: 'camera' }, ({ pos }) => cameraArchetype(pos))
    .with({ type: 'targetBlock' }, ({ pos }) => targetBlockArchetype(pos))
    .exhaustive();
};

/**
 * A type guard that checks if an archetype has a given set of components.
 * @param archetype - The archetype to check.
 * @param components - An array of component names to check for.
 * @returns True if the archetype has all the specified components, false otherwise.
 */
export function hasComponents<T extends ReadonlyArray<keyof Components>>(
  archetype: Archetype,
  components: T,
): archetype is Archetype & { readonly [K in T[number]]: Components[K] } {
  return components.every(component => component in archetype);
}


export function hasComponents<T extends ReadonlyArray<keyof Components>>(
  archetype: Archetype,
  components: T,
): archetype is Archetype & { readonly [K in T[number]]: Components[K] } {
  return components.every(component => component in archetype);
}