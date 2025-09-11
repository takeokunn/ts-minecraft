import * as S from '@effect/schema/Schema'
import { ChunkX, ChunkZ } from '../../common'
import { BlockTypeSchema } from '@/domain/value-objects/block-type.vo'
import { RegisterComponent } from '../registry'

/**
 * Chunk Component - Represents a chunk of terrain blocks
 */

export const ChunkComponent = RegisterComponent({
  id: 'chunk',
  category: 'world',
  priority: 2,
})(
  S.Struct({
    chunkX: ChunkX,
    chunkZ: ChunkZ,
    blocks: S.Array(BlockTypeSchema),
  })
)

export type ChunkComponent = S.Schema.Type<typeof ChunkComponent>

/**
 * ChunkLoaderState Component - Tracks loaded chunks
 */
export const ChunkLoaderStateComponent = RegisterComponent({
  id: 'chunkLoaderState',
  category: 'world',
  priority: 1,
})(
  S.Struct({
    loadedChunks: S.ReadonlySet(S.String),
  })
)

export type ChunkLoaderStateComponent = S.Schema.Type<typeof ChunkLoaderStateComponent>

// Aliases for backward compatibility
export { ChunkComponent as Chunk }