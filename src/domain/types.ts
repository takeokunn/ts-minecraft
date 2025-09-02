import { Brand, Option as EffectOption, Either as EffectEither, Schema as S, Data } from 'effect'
import { BlockTypeSchema, PlacedBlockSchema } from './block'
import { Position } from './components'
import { EntityId } from './entity'

// --- Branded Types ---

// Re-export Brand for convenience
export type Brand<T, U extends string | symbol> = T & Brand.Brand<U>

// --- Player Identifier ---
export type PlayerId = Brand<EntityId, 'PlayerId'>
export const PlayerId = Brand.nominal<PlayerId>()

// --- World-related Identifiers and Coordinates ---
export type ChunkId = Brand<string, 'ChunkId'>
export const ChunkId = Brand.nominal<ChunkId>()

export type WorldPosition = Brand<[number, number, number], 'WorldPosition'>
export const WorldPosition = Brand.nominal<WorldPosition>()

export type ChunkPosition = Brand<[number, number], 'ChunkPosition'>
export const ChunkPosition = Brand.nominal<ChunkPosition>()

// --- Physics-related Types ---
export type Velocity = Brand<[number, number, number], 'Velocity'>
export const Velocity = Brand.nominal<Velocity>()

export type Direction = Brand<[number, number, number], 'Direction'>
export const Direction = Brand.nominal<Direction>()

// --- Effect Re-exports for consistency ---

// Option
export type Option<T> = EffectOption.Option<T>
export const some = EffectOption.some
export const none = EffectOption.none
export const isSome = EffectOption.isSome
export const isNone = EffectOption.isNone
export const fromNullable = EffectOption.fromNullable

// Either
export type Either<L, R> = EffectEither.Either<L, R>
export const left = EffectEither.left
export const right = EffectEither.right
export const isLeft = EffectEither.isLeft
export const isRight = EffectEither.isRight

// --- Reusable Schemas ---

const ChunkMeshSchema = S.Struct({
  positions: S.instanceOf(Float32Array),
  normals: S.instanceOf(Float32Array),
  uvs: S.instanceOf(Float32Array),
  indices: S.instanceOf(Uint32Array),
})
export type ChunkMesh = S.Schema.Type<typeof ChunkMeshSchema>

// --- Worker Communication Schemas ---

export const GenerationParamsSchema = S.Struct({
  chunkX: S.Number,
  chunkZ: S.Number,
  seeds: S.Struct({
    world: S.Number,
    biome: S.Number,
    trees: S.Number,
  }),
  amplitude: S.Number,
  editedBlocks: S.Struct({
    placed: S.Record({ key: S.String, value: S.Struct({ position: Position, blockType: BlockTypeSchema }) }),
    destroyed: S.Set(S.String),
  }),
})
export type GenerationParams = S.Schema.Type<typeof GenerationParamsSchema>

export const ChunkGenerationResultSchema = S.Struct({
  blocks: S.Array(PlacedBlockSchema),
  mesh: ChunkMeshSchema,
  chunkX: S.Number,
  chunkZ: S.Number,
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResultSchema>

export const ComputationTaskSchema = S.Struct({
  type: S.Literal('generateChunk'),
  payload: GenerationParamsSchema,
})
export type ComputationTask = S.Schema.Type<typeof ComputationTaskSchema>

// --- Command Schemas (for systems and renderers) ---

export const UpsertChunkRenderCommandSchema = S.Struct({
  type: S.Literal('UpsertChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
  mesh: ChunkMeshSchema,
})
export type UpsertChunkRenderCommand = S.Schema.Type<typeof UpsertChunkRenderCommandSchema>

export const RemoveChunkRenderCommandSchema = S.Struct({
  type: S.Literal('RemoveChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
})
export type RemoveChunkRenderCommand = S.Schema.Type<typeof RemoveChunkRenderCommandSchema>

export const RenderCommandSchema = S.Union(UpsertChunkRenderCommandSchema, RemoveChunkRenderCommandSchema)
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>

export const SystemCommandSchema = S.Struct({
  type: S.Literal('GenerateChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
})
export type SystemCommand = S.Schema.Type<typeof SystemCommandSchema>

// --- Queue Types ---

export type ChunkDataQueue = ChunkGenerationResult[]
export type RenderQueue = RenderCommand[]

// --- Infrastructure-related Schemas ---

export const BrowserInputStateSchema = S.Struct({
  keyboard: S.Set(S.String),
  mouse: S.Struct({ dx: S.Number, dy: S.Number }),
  isLocked: S.Boolean,
})
export type BrowserInputState = S.Schema.Type<typeof BrowserInputStateSchema>

// --- Error Types ---
export class WorkerError extends Data.TaggedError('WorkerError')<{
  readonly reason: unknown
}> {}
