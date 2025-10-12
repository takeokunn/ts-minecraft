import type { ErrorCause } from '@shared/schema/error'
import { Brand, Data, Effect, Schema } from 'effect'
import type { ChunkMetadata } from '../../value_object/chunk_metadata'
import { ChunkMetadataSchema } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import { ChunkPositionSchema } from '../../value_object/chunk_position'

/**
 * ブランド型
 * ChunkIdは専用value_objectから再エクスポート
 */
export { ChunkIdSchema } from '../../value_object/chunk_id'
export type { ChunkId } from '../../value_object/chunk_id'

export type BlockId = number & Brand.Brand<'BlockId'>
export const BlockId = Brand.refined<BlockId>(
  (value): value is BlockId => Number.isInteger(value) && value >= 0 && value <= 65_535,
  (value) => Brand.error(`ブロックIDは0〜65535の整数である必要があります: ${value}`)
)

/**
 * ローカル座標（チャンク内座標）
 * チャンク内の相対位置を表す（0-15の範囲）
 */
export type LocalCoordinate = number & Brand.Brand<'LocalCoordinate'>
export const LocalCoordinate = Brand.refined<LocalCoordinate>(
  (value): value is LocalCoordinate => Number.isInteger(value) && value >= 0 && value < 16,
  (value) => Brand.error(`ローカル座標は0〜15の整数である必要があります: ${value}`)
)

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
export interface ChunkBoundsError {
  readonly _tag: 'ChunkBoundsError'
  readonly message: string
  readonly coordinates?: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
}

export const ChunkBoundsError = Data.tagged<ChunkBoundsError>('ChunkBoundsError')

export interface ChunkSerializationError {
  readonly _tag: 'ChunkSerializationError'
  readonly message: string
  readonly originalError?: ErrorCause
}

export const ChunkSerializationError = Data.tagged<ChunkSerializationError>('ChunkSerializationError')

/**
 * チャンク集約インターフェース
 */
export interface ChunkAggregate {
  readonly id: ChunkId
  readonly position: ChunkPosition
  readonly data: ChunkData
  readonly getBlock: (
    x: LocalCoordinate,
    y: LocalCoordinate,
    z: LocalCoordinate
  ) => Effect.Effect<BlockId, ChunkBoundsError>
  readonly setBlock: (
    x: LocalCoordinate,
    y: LocalCoordinate,
    z: LocalCoordinate,
    blockId: BlockId
  ) => Effect.Effect<ChunkAggregate, ChunkBoundsError>
  readonly fillRegion: (
    startX: LocalCoordinate,
    startY: LocalCoordinate,
    startZ: LocalCoordinate,
    endX: LocalCoordinate,
    endY: LocalCoordinate,
    endZ: LocalCoordinate,
    blockId: BlockId
  ) => Effect.Effect<ChunkAggregate, ChunkBoundsError>
  readonly markDirty: () => Effect.Effect<ChunkAggregate>
  readonly markClean: () => Effect.Effect<ChunkAggregate>
  readonly updateMetadata: (metadata: Partial<ChunkMetadata>) => Effect.Effect<ChunkAggregate>
  readonly isEmpty: () => boolean
  readonly getMemoryUsage: () => number
  readonly clone: () => Effect.Effect<ChunkAggregate>
}
