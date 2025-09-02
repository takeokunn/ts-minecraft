import { Schema as S, Class } from 'effect/Schema'
import { BlockTypeSchema } from './block'
import { Float, Int, Vector3IntSchema } from './common'
import { EntityId, EntityIdSchema } from './entity'



// --- Component Schemas ---

export class Position extends Class<Position>('Position')({
  x: Float,
  y: Float,
  z: Float,
}) {}

export class Velocity extends Class<Velocity>('Velocity')({
  dx: Float,
  dy: Float,
  dz: Float,
}) {}

export class Player extends Class<Player>('Player')({
  isGrounded: S.Boolean,
}) {}

export class InputState extends Class<InputState>('InputState')({
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

export class CameraState extends Class<CameraState>('CameraState')({
  pitch: Float,
  yaw: Float,
}) {}

export class Hotbar extends Class<Hotbar>('Hotbar')({
  slots: S.Array(BlockTypeSchema),
  selectedIndex: Int,
}) {}

export class TargetBlock extends Class<TargetBlock>('TargetBlock')({
  _tag: S.Literal('block'),
  entityId: EntityIdSchema,
  face: Vector3IntSchema,
  position: Position,
}) {}
export class TargetNone extends Class<TargetNone>('TargetNone')({
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

export class Gravity extends Class<Gravity>('Gravity')({
  value: Float,
}) {}

export class Collider extends Class<Collider>('Collider')({
  width: Float,
  height: Float,
  depth: Float,
}) {}

export class Renderable extends Class<Renderable>('Renderable')({
  geometry: S.String,
  blockType: BlockTypeSchema,
}) {}

export class InstancedMeshRenderable extends Class<InstancedMeshRenderable>('InstancedMeshRenderable')({
  meshType: S.String,
}) {}

export class TerrainBlock extends Class<TerrainBlock>('TerrainBlock')({}) {}

export class Chunk extends Class<Chunk>('Chunk')({
  chunkX: Int,
  chunkZ: Int,
  blocks: S.Array(BlockTypeSchema),
}) {}

export class Camera extends Class<Camera>('Camera')({
  position: Position,
  target: S.optional(Position),
  damping: Float,
}) {}

export class TargetBlockComponent extends Class<TargetBlockComponent>('TargetBlockComponent')({}) {}

export class ChunkLoaderState extends Class<ChunkLoaderState>('ChunkLoaderState')({
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

export type ComponentClass<T extends AnyComponent> = S.Schema.Class<T>

export const getComponentId = <T extends AnyComponent>(componentClass: ComponentClass<T>): ComponentName => {
  // HACK: The component name is stored in the AST.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (componentClass as any).ast.annotations[0].name as ComponentName
}

export type Components = {
  readonly [K in keyof typeof ComponentSchemas]: S.Schema.Type<(typeof ComponentSchemas)[K]>
}

export type ComponentName = keyof Components
export const componentNames: ComponentName[] = Object.keys(ComponentSchemas).filter(
  (key): key is ComponentName => Object.prototype.hasOwnProperty.call(ComponentSchemas, key),
)
export const componentNamesSet = new Set<string>(componentNames)
