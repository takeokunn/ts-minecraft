import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { ChunkX, ChunkZ, Float, Int, Vector3IntSchema } from './common'
import { EntityIdSchema } from './entity'
import { BlockTypeSchema } from './block-types'

// --- Component Schemas using S.Struct ---

export const Position = S.Struct({
  x: Float,
  y: Float,
  z: Float,
})
export type Position = S.Schema.Type<typeof Position>

export const Velocity = S.Struct({
  dx: Float,
  dy: Float,
  dz: Float,
})
export type Velocity = S.Schema.Type<typeof Velocity>

export const Player = S.Struct({
  isGrounded: S.Boolean,
})
export type Player = S.Schema.Type<typeof Player>

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

export const CameraState = S.Struct({
  pitch: Float,
  yaw: Float,
})
export type CameraState = S.Schema.Type<typeof CameraState>

export const Hotbar = S.Struct({
  slots: S.Array(BlockTypeSchema),
  selectedIndex: Int,
})
export type Hotbar = S.Schema.Type<typeof Hotbar>

export const TargetBlock = S.Struct({
  _tag: S.Literal('block'),
  entityId: EntityIdSchema,
  face: Vector3IntSchema,
  position: Position,
})
export type TargetBlock = S.Schema.Type<typeof TargetBlock>

export const TargetNone = S.Struct({
  _tag: S.Literal('none'),
})
export type TargetNone = S.Schema.Type<typeof TargetNone>

export const Target = S.Union(TargetBlock, TargetNone)
export type Target = S.Schema.Type<typeof Target>

export const Gravity = S.Struct({
  value: Float,
})
export type Gravity = S.Schema.Type<typeof Gravity>

export const Collider = S.Struct({
  width: Float,
  height: Float,
  depth: Float,
})
export type Collider = S.Schema.Type<typeof Collider>

export const Renderable = S.Struct({
  geometry: S.String,
  blockType: BlockTypeSchema,
})
export type Renderable = S.Schema.Type<typeof Renderable>

export const InstancedMeshRenderable = S.Struct({
  meshType: S.String,
})
export type InstancedMeshRenderable = S.Schema.Type<typeof InstancedMeshRenderable>

export const TerrainBlock = S.Struct({})
export type TerrainBlock = S.Schema.Type<typeof TerrainBlock>

export const Chunk = S.Struct({
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  blocks: S.Array(BlockTypeSchema),
})
export type Chunk = S.Schema.Type<typeof Chunk>

export const Camera = S.Struct({
  position: Position,
  target: S.optional(Position),
  damping: Float,
})
export type Camera = S.Schema.Type<typeof Camera>

export const TargetBlockComponent = S.Struct({})
export type TargetBlockComponent = S.Schema.Type<typeof TargetBlockComponent>

export const ChunkLoaderState = S.Struct({
  loadedChunks: S.ReadonlySet(S.String).pipe(S.annotations({ arbitrary: () => fc.array(fc.string()).map(arr => new Set(arr)) })),
})
export type ChunkLoaderState = S.Schema.Type<typeof ChunkLoaderState>


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

export const AnyComponent = S.Union(...Object.values(ComponentSchemas).filter((s) => s !== Target && s !== ChunkLoaderState))
export type AnyComponent = S.Schema.Type<typeof AnyComponent>

export const PartialComponentsSchema = S.partial(S.Struct(ComponentSchemas)).pipe(
  S.annotations({
    arbitrary: () =>
      fc.record(
        Object.fromEntries(
          Object.entries(ComponentSchemas).map(([key, schema]) => [key, fc.option(Arbitrary.make(schema), { nil: undefined })]),
        ),
      ),
  }),
)
export type PartialComponents = S.Schema.Type<typeof PartialComponentsSchema>

export type ComponentName = keyof typeof ComponentSchemas
export const componentNames = Object.keys(ComponentSchemas) as Array<ComponentName>
export const ComponentNameSchema = S.keyof(S.Struct(ComponentSchemas))
export const componentNamesSet = new Set<string>(componentNames)

export type ComponentOfName<T extends ComponentName> = S.Schema.Type<(typeof ComponentSchemas)[T]>

export type Components = {
  [K in ComponentName]: ComponentOfName<K>
}
