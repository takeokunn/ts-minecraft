import { Schema as S } from 'effect'

import { BlockTypeSchema, PlacedBlockSchema } from './block'
import { Position } from './components'

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
