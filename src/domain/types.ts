import * as S from 'effect/Schema'
import { BlockTypeSchema } from './block-types'
import { type ComponentName, ComponentSchemas } from './components'
import { ChunkX, ChunkZ } from './common'

const Float32ArraySchema = S.transform(
  S.Array(S.Number),
  S.instanceOf(Float32Array),
  {
    decode: (arr) => new Float32Array(arr),
    encode: (arr) => Array.from(arr),
  },
)
const Uint32ArraySchema = S.transform(
  S.Array(S.Number),
  S.instanceOf(Uint32Array),
  {
    decode: (arr) => new Uint32Array(arr),
    encode: (arr) => Array.from(arr),
  },
)

export const ChunkMeshSchema = S.Struct({
  positions: Float32ArraySchema,
  normals: Float32ArraySchema,
  uvs: Float32ArraySchema,
  indices: Uint32ArraySchema,
})
export type ChunkMesh = S.Schema.Type<typeof ChunkMeshSchema>

export const ChunkGenerationResultSchema = S.Struct({
  type: S.Literal('chunkGenerated'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  mesh: ChunkMeshSchema,
  blocks: S.Array(S.Union(BlockTypeSchema, S.Null)),
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResultSchema>

export const ComputationTaskSchema = S.Struct({
  type: S.Literal('generateChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
})
export type ComputationTask = S.Schema.Type<typeof ComputationTaskSchema>

export const UpsertChunkRenderCommandSchema = S.Struct({
  type: S.Literal('upsertChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  mesh: ChunkMeshSchema,
})
export type UpsertChunkRenderCommand = S.Schema.Type<typeof UpsertChunkRenderCommandSchema>

export const RemoveChunkRenderCommandSchema = S.Struct({
  type: S.Literal('removeChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
})
export type RemoveChunkRenderCommand = S.Schema.Type<typeof RemoveChunkRenderCommandSchema>

export const RenderCommandSchema = S.Union(UpsertChunkRenderCommandSchema, RemoveChunkRenderCommandSchema)
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>

export type ComponentOfName<T extends ComponentName> = S.Schema.Type<(typeof ComponentSchemas)[T]>