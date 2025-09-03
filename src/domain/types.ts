import { Brand, Option as EffectOption, Either as EffectEither, Data } from 'effect'
import * as S from 'effect/Schema'
import * as fc from 'fast-check'
import { PlacedBlockSchema } from './block'
import { BlockTypeSchema } from './block-types'
import { Position, type Components, ComponentName } from './components'
import { EntityId } from './entity'
import { Query } from './query'

// ... (re-exports and branded types)

const float32ArrayArbitrary = () => fc.float32Array().map((arr) => new Float32Array(arr))
const uint32ArrayArbitrary = () => fc.uint32Array().map((arr) => new Uint32Array(arr))

const ChunkMeshSchema = S.Struct({
  positions: S.instanceOf(Float32Array).pipe(S.annotations({ arbitrary: float32ArrayArbitrary })),
  normals: S.instanceOf(Float32Array).pipe(S.annotations({ arbitrary: float32ArrayArbitrary })),
  uvs: S.instanceOf(Float32Array).pipe(S.annotations({ arbitrary: float32ArrayArbitrary })),
  indices: S.instanceOf(Uint32Array).pipe(S.annotations({ arbitrary: uint32ArrayArbitrary })),
})
export type ChunkMesh = S.Schema.Type<typeof ChunkMeshSchema>

export const ChunkGenerationResultSchema = S.Struct({
  type: S.Literal('chunkGenerated'),
  chunkX: S.Number,
  chunkZ: S.Number,
  mesh: ChunkMeshSchema,
  blocks: S.Array(S.Union(BlockTypeSchema, S.Null)),
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResultSchema>

export const ComputationTaskSchema = S.Struct({
  type: S.Literal('generateChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
})
export type ComputationTask = S.Schema.Type<typeof ComputationTaskSchema>

export const UpsertChunkRenderCommandSchema = S.Struct({
  type: S.Literal('upsertChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
  mesh: ChunkMeshSchema,
})
export type UpsertChunkRenderCommand = S.Schema.Type<typeof UpsertChunkRenderCommandSchema>

export const RemoveChunkRenderCommandSchema = S.Struct({
  type: S.Literal('removeChunk'),
  chunkX: S.Number,
  chunkZ: S.Number,
})
export type RemoveChunkRenderCommand = S.Schema.Type<typeof RemoveChunkRenderCommandSchema>

export const RenderCommandSchema = S.Union(UpsertChunkRenderCommandSchema, RemoveChunkRenderCommandSchema)
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>

export type ComponentOfName<T extends ComponentName> = Components[T]

