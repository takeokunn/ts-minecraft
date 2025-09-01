import * as S from '@effect/schema/Schema'
import { BlockType, BlockTypeSchema } from './block'
import { Float, Int, Vector3Int, Vector3IntSchema } from './common'
import { EntityId } from './entity'

// --- Component Schemas and Functions ---

// Position
export const Position = S.Struct({ x: Float, y: Float, z: Float })
export type Position = S.Schema.Type<typeof Position>
export const createPosition = (x: number, y: number, z: number): Position => ({
  x,
  y,
  z,
})
export const setPosition = (pos: Position, changes: Partial<Position>): Position => ({ ...pos, ...changes })

// Velocity
export const Velocity = S.Struct({ dx: Float, dy: Float, dz: Float })
export type Velocity = S.Schema.Type<typeof Velocity>
export const createVelocity = (dx: number, dy: number, dz: number): Velocity => ({ dx, dy, dz })
export const setVelocity = (vel: Velocity, changes: Partial<Velocity>): Velocity => ({ ...vel, ...changes })

// Player
export const Player = S.Struct({ isGrounded: S.Boolean })
export type Player = S.Schema.Type<typeof Player>
export const createPlayer = (isGrounded: boolean): Player => ({ isGrounded })
export const setPlayerGrounded = (player: Player, isGrounded: boolean): Player => ({ ...player, isGrounded })

// InputState
export const InputState = S.Struct({
  forward: S.Boolean,
  backward: S.Boolean,
  left: S.Boolean,
  right: S.Boolean,
  jump: S.Boolean,
  sprint: S.Boolean,
  place: S.Boolean,
  destroy: S.Boolean,
  isLocked: S.Boolean,
})
export type InputState = S.Schema.Type<typeof InputState>
export const createInputState = (): InputState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  place: false,
  destroy: false,
  isLocked: false,
})
export const setInputState = (state: InputState, changes: Partial<InputState>): InputState => ({ ...state, ...changes })

// CameraState
export const CameraState = S.Struct({ pitch: Float, yaw: Float })
export type CameraState = S.Schema.Type<typeof CameraState>
export const createCameraState = (pitch: number, yaw: number): CameraState => ({
  pitch,
  yaw,
})
export const setCameraState = (state: CameraState, changes: Partial<CameraState>): CameraState => ({ ...state, ...changes })

// Hotbar
export const Hotbar = S.Struct({
  slots: S.Array(BlockTypeSchema),
  selectedIndex: Int,
})
export type Hotbar = S.Schema.Type<typeof Hotbar>
export const createHotbar = (slots: ReadonlyArray<BlockType>, selectedIndex: number): Hotbar => ({ slots, selectedIndex })
export const setHotbarSelectedIndex = (hotbar: Hotbar, selectedIndex: number): Hotbar => ({ ...hotbar, selectedIndex })

// Target (Discriminated Union)
export const TargetNone = S.Struct({ type: S.Literal('none') })
export type TargetNone = S.Schema.Type<typeof TargetNone>
export const TargetBlock = S.Struct({
  type: S.Literal('block'),
  entityId: EntityId,
  face: Vector3IntSchema,
})
export type TargetBlock = S.Schema.Type<typeof TargetBlock>
export const Target = S.Union(TargetNone, TargetBlock)
export type Target = S.Schema.Type<typeof Target>

export const createTargetNone = (): Target => ({ type: 'none' })
export const createTargetBlock = (entityId: EntityId, face: { readonly x: number; readonly y: number; readonly z: number }): Target => ({ type: 'block', entityId, face })
export const setTarget = (target: Target): Target => target
export const matchTarget = <A, B>(
  target: Target,
  matchers: {
    onBlock: (entityId: EntityId, face: Vector3Int) => A
    onNone: () => B
  },
): A | B => {
  if (target.type === 'block') {
    return matchers.onBlock(target.entityId, target.face)
  }
  return matchers.onNone()
}

// Gravity
export const Gravity = S.Struct({ value: Float })
export type Gravity = S.Schema.Type<typeof Gravity>
export const createGravity = (value: number): Gravity => ({ value })

// Collider
export const Collider = S.Struct({ width: Float, height: Float, depth: Float })
export type Collider = S.Schema.Type<typeof Collider>
export const createCollider = (width: number, height: number, depth: number): Collider => ({ width, height, depth })

// Renderable
export const Renderable = S.Struct({
  geometry: S.String,
  blockType: BlockTypeSchema,
})
export type Renderable = S.Schema.Type<typeof Renderable>
export const createRenderable = (geometry: string, blockType: BlockType): Renderable => ({ geometry, blockType })

// InstancedMeshRenderable
export const InstancedMeshRenderable = S.Struct({ meshType: S.String })
export type InstancedMeshRenderable = S.Schema.Type<typeof InstancedMeshRenderable>
export const createInstancedMeshRenderable = (meshType: string): InstancedMeshRenderable => ({ meshType })

// TerrainBlock (Tag Component)
export const TerrainBlock = S.Struct({})
export type TerrainBlock = S.Schema.Type<typeof TerrainBlock>
export const createTerrainBlock = (): TerrainBlock => ({})

// Chunk
export const Chunk = S.Struct({ chunkX: Int, chunkZ: Int })
export type Chunk = S.Schema.Type<typeof Chunk>
export const createChunk = (chunkX: number, chunkZ: number): Chunk => ({
  chunkX,
  chunkZ,
})

// Camera (Tag Component)
export const Camera = S.Struct({})
export type Camera = S.Schema.Type<typeof Camera>
export const createCamera = (): Camera => ({})

// TargetBlockComponent (Tag Component for the highlighted block)
export const TargetBlockComponent = S.Struct({})
export type TargetBlockComponent = S.Schema.Type<typeof TargetBlockComponent>
export const createTargetBlockComponent = (): TargetBlockComponent => ({})

// ChunkLoaderState
export const ChunkLoaderState = S.Struct({
  loadedChunks: S.ReadonlySet(S.String),
})
export type ChunkLoaderState = S.Schema.Type<typeof ChunkLoaderState>
export const createChunkLoaderState = (loadedChunks: ReadonlySet<string>): ChunkLoaderState => ({ loadedChunks })
export const setChunkLoaderState = (state: ChunkLoaderState, loadedChunks: ReadonlySet<string>): ChunkLoaderState => ({ ...state, loadedChunks })

// --- Aggregated Component Types ---

export const ComponentSchemas = {
  position: Position,
  velocity: Velocity,
  player: Player,
  inputState: InputState,
  cameraState: CameraState,
  hotbar: Hotbar,
  target: Target,
  gravity: Gravity,
  collider: Collider,
  renderable: Renderable,
  instancedMeshRenderable: InstancedMeshRenderable,
  terrainBlock: TerrainBlock,
  chunk: Chunk,
  camera: Camera,
  targetBlock: TargetBlockComponent,
  chunkLoaderState: ChunkLoaderState,
} as const

export const AnyComponent = S.Union(...Object.values(ComponentSchemas))
export type AnyComponent = S.Schema.Type<typeof AnyComponent>

export type Components = {
  readonly [K in keyof typeof ComponentSchemas]: S.Schema.Type<(typeof ComponentSchemas)[K]>
}

export type ComponentName = keyof Components
export const componentNames = Object.keys(ComponentSchemas) as unknown as ReadonlyArray<ComponentName>

/**
 * Creates a default InputState component.
 * @deprecated Use createInputState instead.
 */
export const createDefaultInputState = createInputState
