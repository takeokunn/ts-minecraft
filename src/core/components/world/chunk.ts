import * as S from "@effect/schema/Schema"
import { ChunkX, ChunkZ } from '@/core/common'
import { BlockTypeSchema } from '@/core/values/block-type'

/**
 * Chunk Component - Represents a chunk of terrain blocks
 */

export const ChunkComponent = S.Struct({
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  blocks: S.Array(BlockTypeSchema),
})

export type ChunkComponent = S.Schema.Type<typeof ChunkComponent>

/**
 * ChunkLoaderState Component - Tracks loaded chunks
 */
export const ChunkLoaderStateComponent = S.Struct({
  loadedChunks: S.ReadonlySet(S.String),
})

export type ChunkLoaderStateComponent = S.Schema.Type<typeof ChunkLoaderStateComponent>