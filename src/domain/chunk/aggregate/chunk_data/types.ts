import { Schema } from '@effect/schema'
import { Brand, Data, Effect } from 'effect'
import type { ChunkMetadata, HeightValue } from '../../value_object/chunk_metadata'
import { ChunkMetadataSchema } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import { ChunkPositionSchema } from '../../value_object/chunk_position'

/**
 * ブランド型
 */
export type ChunkDataId = string & Brand.Brand<'ChunkDataId'>
export const ChunkDataId = Brand.nominal<ChunkDataId>()

/**
 * チャンクデータスキーマ
 */
export const ChunkDataSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  position: ChunkPositionSchema,
  blocks: Schema.instanceOf(Uint16Array),
  metadata: ChunkMetadataSchema,
  isDirty: Schema.Boolean,
}).pipe(Schema.brand('ChunkData'))

export type ChunkData = Schema.Schema.Type<typeof ChunkDataSchema>

/**
 * エラーADT
 */
export interface ChunkDataValidationError {
  readonly _tag: 'ChunkDataValidationError'
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}

export const ChunkDataValidationError = Data.tagged<ChunkDataValidationError>('ChunkDataValidationError')

export interface ChunkDataCorruptionError {
  readonly _tag: 'ChunkDataCorruptionError'
  readonly message: string
  readonly chunkId: ChunkDataId
  readonly details?: unknown
}

export const ChunkDataCorruptionError = Data.tagged<ChunkDataCorruptionError>('ChunkDataCorruptionError')

/**
 * チャンクデータ集約インターフェース
 */
export interface ChunkDataAggregate {
  readonly id: ChunkDataId
  readonly position: ChunkPosition
  readonly blocks: Uint16Array
  readonly metadata: ChunkMetadata
  readonly isDirty: boolean
  readonly getBlock: (index: number) => number
  readonly setBlock: (index: number, blockId: number) => Effect.Effect<ChunkDataAggregate, ChunkDataValidationError>
  readonly fillBlocks: (blockId: number) => Effect.Effect<ChunkDataAggregate, ChunkDataValidationError>
  readonly updateMetadata: (
    metadata: Partial<ChunkMetadata>
  ) => Effect.Effect<ChunkDataAggregate, ChunkDataValidationError>
  readonly updateHeightMap: (
    index: number,
    height: HeightValue
  ) => Effect.Effect<ChunkDataAggregate, ChunkDataValidationError>
  readonly getHeightAt: (index: number) => HeightValue
  readonly markDirty: () => Effect.Effect<ChunkDataAggregate>
  readonly markClean: () => Effect.Effect<ChunkDataAggregate>
  readonly updateTimestamp: () => Effect.Effect<ChunkDataAggregate>
  readonly isEmpty: () => boolean
  readonly getMemoryUsage: () => number
  readonly clone: () => Effect.Effect<ChunkDataAggregate>
  readonly reset: (newPosition: ChunkPosition) => Effect.Effect<ChunkDataAggregate, ChunkDataValidationError>
}
