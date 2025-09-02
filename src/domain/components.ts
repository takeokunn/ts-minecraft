import { Schema as S } from 'effect'
import { BlockTypeSchema } from './block'
import { Float, Int, Vector3IntSchema } from './common'
import { EntityId, EntityIdSchema } from './entity'



// --- Component Schemas ---

export class Position extends S.Class<Position>('Position')({
  x: Float,
  y: Float,
  z: Float,
}) {}

export class Velocity extends S.Class<Velocity>('Velocity')({
  dx: Float,
  dy: Float,
  dz: Float,
}) {}

export class Player extends S.Class<Player>('Player')({
  isGrounded: S.Boolean,
}) {}

export class InputState extends S.Class<InputState>('InputState')({
  forward: S.Boolean,
  backward: S.Boolean,
  left: S.Boolean,
  right: S.Boolean,
  jump: S.Boolean,
  sprint: S.Boolean,
  place: S.Boolean,
  destroy: S.Boolean,
  isLocked: S.Boolean,
}) {}
export const createInputState = (): InputState =>
  new InputState({
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
export const setInputState = (state: InputState, changes: Partial<InputState>): InputState => {
  return new InputState({ ...state, ...changes })
}

export class CameraState extends S.Class<CameraState>('CameraState')({
  pitch: Float,
  yaw: Float,
}) {}

export class Hotbar extends S.Class<Hotbar>('Hotbar')({
  slots: S.Array(BlockTypeSchema),
  selectedIndex: Int,
}) {}

export class TargetBlock extends S.Class<TargetBlock>('TargetBlock')({
  _tag: S.Literal('block'),
  entityId: EntityIdSchema,
  face: Vector3IntSchema,
  position: Position,
}) {}
export class TargetNone extends S.Class<TargetNone>('TargetNone')({
  _tag: S.Literal('none'),
}) {}
export const Target = S.Union(TargetBlock, TargetNone)
export type Target = S.Schema.Type<typeof Target>
export const createTargetNone = (): Target => new TargetNone({ _tag: 'none' })
export const createTargetBlock = (
  entityId: EntityId,
  face: { readonly x: number; readonly y: number; readonly z: number },
  position: Position,
): Target => new TargetBlock({ _tag: 'block', entityId, face, position })

export class Gravity extends S.Class<Gravity>('Gravity')({
  value: Float,
}) {}

export class Collider extends S.Class<Collider>('Collider')({
  width: Float,
  height: Float,
  depth: Float,
}) {}

export class Renderable extends S.Class<Renderable>('Renderable')({
  geometry: S.String,
  blockType: BlockTypeSchema,
}) {}

export class InstancedMeshRenderable extends S.Class<InstancedMeshRenderable>('InstancedMeshRenderable')({
  meshType: S.String,
}) {}

export class TerrainBlock extends S.Class<TerrainBlock>('TerrainBlock')({}) {}

export class Chunk extends S.Class<Chunk>('Chunk')({
  chunkX: Int,
  chunkZ: Int,
}) {}

export class Camera extends S.Class<Camera>('Camera')({
  position: Position,
  target: S.optional(Position),
  damping: Float,
}) {}

export class TargetBlockComponent extends S.Class<TargetBlockComponent>('TargetBlockComponent')({}) {}

export class ChunkLoaderState extends S.Class<ChunkLoaderState>('ChunkLoaderState')({
  loadedChunks: S.ReadonlySet(S.String),
}) {}

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

export const AnyComponent = S.Union(...Object.values(ComponentSchemas).filter((s) => 'ast' in s))
export type AnyComponent = S.Schema.Type<typeof AnyComponent>

export type Components = {
  readonly [K in keyof typeof ComponentSchemas]: S.Schema.Type<(typeof ComponentSchemas)[K]>
}

export type ComponentName = keyof Components
export const componentNames: ReadonlyArray<ComponentName> = Object.keys(ComponentSchemas).filter(
  (key): key is ComponentName => Object.prototype.hasOwnProperty.call(ComponentSchemas, key),
)
export const componentNamesSet = new Set<ComponentName>(componentNames)