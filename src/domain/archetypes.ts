import { Schema as S } from 'effect'
import { match } from 'ts-pattern'
import { BlockType, BlockTypeSchema, hotbarSlots } from './block'
import {
  Camera,
  CameraState,
  Chunk,
  Collider,
  type ComponentName,
  type Components,
  createInputState,
  createTargetNone,
  Gravity,
  Hotbar,
  Player,
  Position,
  Renderable,
  TargetBlockComponent,
  TerrainBlock,
  Velocity,
} from './components'

// --- Constants ---

const PLAYER_WIDTH = 0.6
const PLAYER_HEIGHT = 1.8
const PLAYER_DEPTH = 0.6
const PLAYER_GRAVITY = 0.01
const BLOCK_SIZE = 1

// --- Schema ---

const PlayerArchetypeBuilderSchema = S.Struct({
  type: S.Literal('player'),
  pos: Position,
})

const BlockArchetypeBuilderSchema = S.Struct({
  type: S.Literal('block'),
  pos: Position,
  blockType: BlockTypeSchema,
})

const CameraArchetypeBuilderSchema = S.Struct({
  type: S.Literal('camera'),
  pos: Position,
})

const TargetBlockArchetypeBuilderSchema = S.Struct({
  type: S.Literal('targetBlock'),
  pos: Position,
})

const ChunkArchetypeBuilderSchema = S.Struct({
  type: S.Literal('chunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
})

export const ArchetypeBuilderSchema = S.Union(
  PlayerArchetypeBuilderSchema,
  BlockArchetypeBuilderSchema,
  CameraArchetypeBuilderSchema,
  TargetBlockArchetypeBuilderSchema,
  ChunkArchetypeBuilderSchema,
)
export type ArchetypeBuilder = S.Schema.Type<typeof ArchetypeBuilderSchema>

// --- Types ---

/**
 * An archetype is a template for creating an entity, defined as a partial set of components.
 */
export type Archetype = Partial<Components>

// --- Public API ---

/**
 * Creates an archetype object based on the provided builder.
 * @param builder - The archetype builder specifying the type and parameters.
 * @returns An archetype object (a partial set of components).
 */
export const createArchetype = (builder: ArchetypeBuilder): Archetype => {
  return match(builder)
    .with({ type: 'player' }, ({ pos }) => ({
      player: new Player({ isGrounded: false }),
      position: new Position({ x: pos.x, y: pos.y, z: pos.z }),
      velocity: new Velocity({ dx: 0, dy: 0, dz: 0 }),
      gravity: new Gravity({ value: PLAYER_GRAVITY }),
      cameraState: new CameraState({ pitch: 0, yaw: 0 }),
      inputState: createInputState(),
      collider: new Collider({
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        depth: PLAYER_DEPTH,
      }),
      hotbar: new Hotbar({ slots: hotbarSlots, selectedIndex: 0 }),
      target: createTargetNone(),
    }))
    .with({ type: 'block' }, ({ pos, blockType }) => ({
      position: new Position({ x: pos.x, y: pos.y, z: pos.z }),
      renderable: new Renderable({ geometry: 'box', blockType }),
      collider: new Collider({
        width: BLOCK_SIZE,
        height: BLOCK_SIZE,
        depth: BLOCK_SIZE,
      }),
      terrainBlock: new TerrainBlock({}),
    }))
    .with({ type: 'camera' }, ({ pos }) => ({
      camera: new Camera({}),
      position: new Position({ x: pos.x, y: pos.y, z: pos.z }),
    }))
    .with({ type: 'targetBlock' }, ({ pos }) => ({
      position: new Position({ x: pos.x, y: pos.y, z: pos.z }),
      targetBlock: new TargetBlockComponent({}),
    }))
    .with({ type: 'chunk' }, ({ chunkX, chunkZ }) => ({
      chunk: new Chunk({ chunkX, chunkZ }),
    }))
    .exhaustive()
}

/**
 * A type guard that checks if an archetype has a given set of components.
 * @param archetype - The archetype to check.
 * @param components - An array of component names to check for.
 * @returns True if the archetype has all the specified components, false otherwise.
 */
export function hasComponents<T extends ReadonlyArray<ComponentName>>(
  archetype: Archetype,
  components: T,
): archetype is Archetype & { readonly [K in T[number]]: Components[K] } {
  return components.every((component) => component in archetype)
}
