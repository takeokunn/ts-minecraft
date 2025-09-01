import { match } from 'ts-pattern'
import { BlockType, hotbarSlots } from './block'
import { Components, createInputState, Position } from './components'

// --- Constants ---

const PLAYER_WIDTH = 0.6
const PLAYER_HEIGHT = 1.8
const PLAYER_DEPTH = 0.6
const PLAYER_GRAVITY = 0.01
const BLOCK_SIZE = 1

// --- Types ---

/**
 * An archetype is a template for creating an entity, defined as a partial set of components.
 */
export type Archetype = Partial<Components>

/**
 * A builder type to specify which archetype to create and with what parameters.
 * This is used with the `createArchetype` function.
 */
export type ArchetypeBuilder =
  | { readonly type: 'player'; readonly pos: Position }
  | {
      readonly type: 'block'
      readonly pos: Position
      readonly blockType: BlockType
    }
  | { readonly type: 'camera'; readonly pos: Position }
  | { readonly type: 'targetBlock'; readonly pos: Position }
  | {
      readonly type: 'chunk'
      readonly chunkX: number
      readonly chunkZ: number
    }

// --- Private Archetype Factories ---

const playerArchetype = (pos: Position): Archetype => ({
  player: { isGrounded: false },
  position: { x: pos.x, y: pos.y, z: pos.z },
  velocity: { dx: 0, dy: 0, dz: 0 },
  gravity: { value: PLAYER_GRAVITY },
  cameraState: { pitch: 0, yaw: 0 },
  inputState: createInputState(),
  collider: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    depth: PLAYER_DEPTH,
  },
  hotbar: { slots: hotbarSlots, selectedIndex: 0 },
  target: { type: 'none' },
})

const blockArchetype = (pos: Position, blockType: BlockType): Archetype => ({
  position: { x: pos.x, y: pos.y, z: pos.z },
  renderable: { geometry: 'box', blockType },
  collider: {
    width: BLOCK_SIZE,
    height: BLOCK_SIZE,
    depth: BLOCK_SIZE,
  },
  terrainBlock: {},
})

const cameraArchetype = (pos: Position): Archetype => ({
  camera: {},
  position: { x: pos.x, y: pos.y, z: pos.z },
})

const targetBlockArchetype = (pos: Position): Archetype => ({
  position: { x: pos.x, y: pos.y, z: pos.z },
  targetBlock: {},
})

const chunkArchetype = (chunkX: number, chunkZ: number): Archetype => ({
  chunk: { chunkX, chunkZ },
})

// --- Public API ---

/**
 * Creates an archetype object based on the provided builder.
 * @param builder - The archetype builder specifying the type and parameters.
 * @returns An archetype object (a partial set of components).
 */
export const createArchetype = (builder: ArchetypeBuilder): Archetype => {
  return match(builder)
    .with({ type: 'player' }, ({ pos }) => playerArchetype(pos))
    .with({ type: 'block' }, ({ pos, blockType }) => blockArchetype(pos, blockType))
    .with({ type: 'camera' }, ({ pos }) => cameraArchetype(pos))
    .with({ type: 'targetBlock' }, ({ pos }) => targetBlockArchetype(pos))
    .with({ type: 'chunk' }, ({ chunkX, chunkZ }) => chunkArchetype(chunkX, chunkZ))
    .exhaustive()
}

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
  return components.every((component) => component in archetype)
}