import * as S from 'effect/Schema'
import { ChunkX, ChunkZ } from '@/domain/common'
import { BlockTypeSchema } from '@/domain/block-types'

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