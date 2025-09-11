import * as S from "/schema/Schema"
import { ChunkCoordinates } from '@/core/values/coordinates'
import { BlockTypeSchema } from '@/core/values/block-type'

/**
 * Shared message type definitions for all workers
 */

// ============================================
// Terrain Generation Messages
// ============================================

export const GenerateChunkMessage = S.Struct({
  type: S.Literal('generate-chunk'),
  seed: S.Number,
  coords: ChunkCoordinates.schema ?? S.Struct({
    x: S.Number,
    z: S.Number
  })
})
export type GenerateChunkMessage = S.Schema.Type<typeof GenerateChunkMessage>

export const ChunkGenerationResult = S.Struct({
  type: S.Literal('chunk-generated'),
  coords: ChunkCoordinates.schema ?? S.Struct({
    x: S.Number,
    z: S.Number
  }),
  blocks: S.Array(BlockTypeSchema),
  heightMap: S.Array(S.Number)
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResult>

// ============================================
// Mesh Generation Messages
// ============================================

export const GenerateMeshMessage = S.Struct({
  type: S.Literal('generate-mesh'),
  blocks: S.Array(BlockTypeSchema),
  chunkX: S.Number,
  chunkZ: S.Number
})
export type GenerateMeshMessage = S.Schema.Type<typeof GenerateMeshMessage>

export const MeshGenerationResult = S.Struct({
  type: S.Literal('mesh-generated'),
  chunkX: S.Number,
  chunkZ: S.Number,
  positions: S.Array(S.Number),
  normals: S.Array(S.Number),
  uvs: S.Array(S.Number),
  indices: S.Array(S.Number)
})
export type MeshGenerationResult = S.Schema.Type<typeof MeshGenerationResult>

// ============================================
// Combined Message Types
// ============================================

export const WorkerIncomingMessage = S.Union(
  GenerateChunkMessage,
  GenerateMeshMessage
)
export type WorkerIncomingMessage = S.Schema.Type<typeof WorkerIncomingMessage>

export const WorkerOutgoingMessage = S.Union(
  ChunkGenerationResult,
  MeshGenerationResult
)
export type WorkerOutgoingMessage = S.Schema.Type<typeof WorkerOutgoingMessage>