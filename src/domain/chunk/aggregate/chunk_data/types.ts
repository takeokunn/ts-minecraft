import type { JsonSerializable, JsonValue } from '@shared/schema/json'
import { toJsonValue } from '@shared/schema/json'
import { Brand, Data, Effect, Schema } from 'effect'
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
  readonly value?: JsonValue
  readonly issues?: ReadonlyArray<string>
  readonly originalError?: unknown
}

type ChunkDataValidationErrorInput = {
  readonly message: string
  readonly field?: string
  readonly value?: JsonSerializable
  readonly issues?: ReadonlyArray<string>
  readonly originalError?: unknown
}

const ChunkDataValidationErrorBase = Data.tagged<ChunkDataValidationError>('ChunkDataValidationError')

const createChunkDataValidationError = ({
  message,
  field,
  value,
  issues,
  originalError,
}: ChunkDataValidationErrorInput): ChunkDataValidationError =>
  ChunkDataValidationErrorBase({
    message,
    field,
    value: value === undefined ? undefined : toJsonValue(value),
    issues,
    originalError,
  })

export const ChunkDataValidationError = Object.assign(createChunkDataValidationError, {
  is: ChunkDataValidationErrorBase.is,
  tag: ChunkDataValidationErrorBase.tag,
}) as {
  (input: ChunkDataValidationErrorInput): ChunkDataValidationError
  readonly is: typeof ChunkDataValidationErrorBase.is
  readonly tag: typeof ChunkDataValidationErrorBase.tag
}

export interface ChunkDataCorruptionError {
  readonly _tag: 'ChunkDataCorruptionError'
  readonly message: string
  readonly chunkId: ChunkDataId
  readonly details?: JsonValue
}

type ChunkDataCorruptionErrorInput = {
  readonly message: string
  readonly chunkId: ChunkDataId
  readonly details?: JsonSerializable
}

const ChunkDataCorruptionErrorBase = Data.tagged<ChunkDataCorruptionError>('ChunkDataCorruptionError')

const createChunkDataCorruptionError = ({
  message,
  chunkId,
  details,
}: ChunkDataCorruptionErrorInput): ChunkDataCorruptionError =>
  ChunkDataCorruptionErrorBase({
    message,
    chunkId,
    details: details === undefined ? undefined : toJsonValue(details),
  })

export const ChunkDataCorruptionError = Object.assign(createChunkDataCorruptionError, {
  is: ChunkDataCorruptionErrorBase.is,
  tag: ChunkDataCorruptionErrorBase.tag,
}) as {
  (input: ChunkDataCorruptionErrorInput): ChunkDataCorruptionError
  readonly is: typeof ChunkDataCorruptionErrorBase.is
  readonly tag: typeof ChunkDataCorruptionErrorBase.tag
}

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
