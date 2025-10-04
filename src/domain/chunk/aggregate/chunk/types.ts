import { Schema } from '@effect/schema'
import { Array as RA, Brand, Data, Effect, Match, Option, pipe } from 'effect'
import type { ChunkPosition } from '../../value_object/chunk-position'
import type { ChunkMetadata } from '../../value_object/chunk-metadata'
import { ChunkPositionSchema } from '../../value_object/chunk-position'
import { ChunkMetadataSchema } from '../../value_object/chunk-metadata'

/**
 * ブランド型
 */
export type ChunkId = string & Brand.Brand<'ChunkId'>
export const ChunkId = Brand.nominal<ChunkId>()

export type BlockId = number & Brand.Brand<'BlockId'>
export const BlockId = Brand.refined<BlockId>(
  (value): value is BlockId => Number.isInteger(value) && value >= 0 && value <= 65_535,
  (value) => Brand.error(`ブロックIDは0〜65535の整数である必要があります: ${value}`)
)

export type WorldCoordinate = number & Brand.Brand<'WorldCoordinate'>
export const WorldCoordinate = Brand.refined<WorldCoordinate>(
  (value): value is WorldCoordinate => Number.isInteger(value),
  (value) => Brand.error(`ワールド座標は整数である必要があります: ${value}`)
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
  readonly originalError?: unknown
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
    x: WorldCoordinate,
    y: WorldCoordinate,
    z: WorldCoordinate
  ) => Effect.Effect<BlockId, ChunkBoundsError>
  readonly setBlock: (
    x: WorldCoordinate,
    y: WorldCoordinate,
    z: WorldCoordinate,
    blockId: BlockId
  ) => Effect.Effect<ChunkAggregate, ChunkBoundsError>
  readonly fillRegion: (
    startX: WorldCoordinate,
    startY: WorldCoordinate,
    startZ: WorldCoordinate,
    endX: WorldCoordinate,
    endY: WorldCoordinate,
    endZ: WorldCoordinate,
    blockId: BlockId
  ) => Effect.Effect<ChunkAggregate, ChunkBoundsError>
  readonly markDirty: () => Effect.Effect<ChunkAggregate>
  readonly markClean: () => Effect.Effect<ChunkAggregate>
  readonly updateMetadata: (
    metadata: Partial<ChunkMetadata>
  ) => Effect.Effect<ChunkAggregate>
  readonly isEmpty: () => boolean
  readonly getMemoryUsage: () => number
  readonly clone: () => Effect.Effect<ChunkAggregate>
}
