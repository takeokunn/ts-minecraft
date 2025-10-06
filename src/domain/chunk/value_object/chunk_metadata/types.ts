import { Schema } from '@effect/schema'
import { Data, Effect, Option, pipe } from 'effect'

const nonEmptyString = Schema.String.pipe(Schema.nonEmptyString())

export const BiomeTypeSchema = nonEmptyString.pipe(Schema.brand('BiomeType'))
export type BiomeType = Schema.Schema.Type<typeof BiomeTypeSchema>

export const LightLevelSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 15), Schema.brand('LightLevel'))
export type LightLevel = Schema.Schema.Type<typeof LightLevelSchema>

export const TimestampSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('Timestamp'))
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

export const HeightValueSchema = Schema.Number.pipe(Schema.int(), Schema.between(-64, 319), Schema.brand('HeightValue'))
export type HeightValue = Schema.Schema.Type<typeof HeightValueSchema>

export const BlockIdSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>

export const BlockCountSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('BlockCount'))
export type BlockCount = Schema.Schema.Type<typeof BlockCountSchema>

export const PercentageSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('Percentage')
)
export type Percentage = Schema.Schema.Type<typeof PercentageSchema>

const OptimizationStrategySchema = Schema.Literal('memory', 'compression', 'access', 'redundancy', 'defragmentation')
export type OptimizationStrategyKind = Schema.Schema.Type<typeof OptimizationStrategySchema>

const OptimizationDetailsSchema = Schema.Struct({
  originalBlockCount: Schema.optional(BlockCountSchema),
  optimizedBlockCount: Schema.optional(BlockCountSchema),
  compressionRatio: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  algorithm: Schema.optional(Schema.Literal('rle', 'delta', 'palette')),
  paletteSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  cacheSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  redundancyBefore: Schema.optional(PercentageSchema),
  redundancyAfter: Schema.optional(PercentageSchema),
  threshold: Schema.optional(PercentageSchema),
  mappingSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
}).pipe(Schema.brand('ChunkOptimizationDetails'))
export type ChunkOptimizationDetails = Schema.Schema.Type<typeof OptimizationDetailsSchema>

export const OptimizationRecordSchema = Schema.Struct({
  strategy: OptimizationStrategySchema,
  executedAt: TimestampSchema,
  details: Schema.optional(OptimizationDetailsSchema),
}).pipe(Schema.brand('ChunkOptimizationRecord'))
export type ChunkOptimizationRecord = Schema.Schema.Type<typeof OptimizationRecordSchema>

const StructureReferenceSchema = Schema.Record({
  key: nonEmptyString,
  value: Schema.Array(nonEmptyString),
})

export const ChunkMetadataSchema = Schema.Struct({
  biome: BiomeTypeSchema,
  lightLevel: LightLevelSchema,
  isModified: Schema.Boolean,
  lastUpdate: TimestampSchema,
  heightMap: Schema.Array(HeightValueSchema),
  generationVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  features: Schema.optional(Schema.Array(nonEmptyString)),
  structureReferences: Schema.optional(StructureReferenceSchema),
  optimizations: Schema.optional(Schema.Array(OptimizationRecordSchema)),
}).pipe(Schema.brand('ChunkMetadata'))

export type ChunkMetadata = Schema.Schema.Type<typeof ChunkMetadataSchema>

export interface ChunkMetadataIssue {
  readonly field: string
  readonly explanation: string
}

export interface ChunkMetadataError {
  readonly _tag: 'ChunkMetadataError'
  readonly message: string
  readonly issues: ReadonlyArray<ChunkMetadataIssue>
}

export const ChunkMetadataError = Data.tagged<ChunkMetadataError>('ChunkMetadataError')

export const makeHeightValue = (value: number): HeightValue => Schema.decodeSync(HeightValueSchema)(value)
export const HeightValue = makeHeightValue

export const withOptimizationRecord = (
  metadata: ChunkMetadata,
  record: ChunkOptimizationRecord
): Effect.Effect<ChunkMetadata, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(ChunkMetadataSchema)({
      ...metadata,
      isModified: true,
      lastUpdate: record.executedAt,
      optimizations: pipe(
        Option.fromNullable(metadata.optimizations),
        Option.match({
          onSome: (log) => [...log, record],
          onNone: () => [record],
        })
      ),
    }),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: 'チャンクメタデータの更新に失敗しました',
        issues: [
          {
            field: 'optimizations',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const touchMetadata = (
  metadata: ChunkMetadata,
  timestamp: Timestamp
): Effect.Effect<ChunkMetadata, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(ChunkMetadataSchema)({
      ...metadata,
      isModified: true,
      lastUpdate: timestamp,
    }),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: 'チャンクメタデータのタイムスタンプ更新に失敗しました',
        issues: [
          {
            field: 'lastUpdate',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const createOptimizationRecord = (
  strategy: OptimizationStrategyKind,
  timestamp: Timestamp,
  details?: ChunkOptimizationDetails
): Effect.Effect<ChunkOptimizationRecord, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(OptimizationRecordSchema)(
      pipe(
        details,
        Option.fromNullable,
        Option.match({
          onSome: (payload) => ({ strategy, executedAt: timestamp, details: payload }),
          onNone: () => ({ strategy, executedAt: timestamp }),
        })
      )
    ),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: '最適化レコードの構築に失敗しました',
        issues: [
          {
            field: strategy,
            explanation: String(error),
          },
        ],
      })
    )
  )

export const createOptimizationDetails = (
  details: Schema.Schema.Input<typeof OptimizationDetailsSchema>
): Effect.Effect<ChunkOptimizationDetails, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(OptimizationDetailsSchema)(details),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: '最適化詳細の構築に失敗しました',
        issues: [
          {
            field: 'details',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const makeTimestamp = (value: number): Effect.Effect<Timestamp, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(TimestampSchema)(value),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: 'タイムスタンプの構築に失敗しました',
        issues: [
          {
            field: 'timestamp',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const makeBlockCount = (value: number): Effect.Effect<BlockCount, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(BlockCountSchema)(value),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: 'ブロック数の構築に失敗しました',
        issues: [
          {
            field: 'blockCount',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const makePercentage = (value: number): Effect.Effect<Percentage, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(PercentageSchema)(value),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: '割合値の構築に失敗しました',
        issues: [
          {
            field: 'percentage',
            explanation: String(error),
          },
        ],
      })
    )
  )

export const makeBlockId = (value: number): Effect.Effect<BlockId, ChunkMetadataError> =>
  pipe(
    Schema.decodeEffect(BlockIdSchema)(value),
    Effect.mapError((error) =>
      ChunkMetadataError({
        message: 'ブロックIDの構築に失敗しました',
        issues: [
          {
            field: 'blockId',
            explanation: String(error),
          },
        ],
      })
    )
  )
