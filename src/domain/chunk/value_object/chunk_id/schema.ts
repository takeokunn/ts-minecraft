import { Schema } from 'effect'

/**
 * ChunkId Schema
 *
 * チャンクを一意に識別するID。
 * 座標ベースの形式 (chunk_{x}_{z})
 *
 * 例:
 * - chunk_0_0 (原点チャンク)
 * - chunk_-5_10 (X=-5, Z=10のチャンク)
 * - chunk_100_-50 (X=100, Z=-50のチャンク)
 */
export const ChunkIdSchema = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+$/),
  Schema.brand('ChunkId'),
  Schema.annotations({
    title: 'Chunk ID',
    description: 'Chunk identifier based on coordinates (chunk_x_z)',
    examples: ['chunk_0_0', 'chunk_-5_10', 'chunk_100_-50'],
  })
)

export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>
