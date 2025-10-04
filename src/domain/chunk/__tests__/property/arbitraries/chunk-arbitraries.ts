/**
 * 世界最高峰レベル Chunk Domain Property-Based Testing Arbitraries
 *
 * Fast-check統合によるEffect-TS Property-Based Testing用
 * 高度なSchema統合・ADT対応・型安全Arbitrary生成器
 */

import { Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import type {
  ChangeSet,
  ChangeSetId,
  ChunkDataBytes,
  ChunkError,
  ChunkOperation,
  ChunkState,
  ChunkTimestamp,
  LoadProgress,
  OptimizationStrategy,
  RetryCount,
  SerializationFormat,
} from '../../../types/core'
import { ChunkErrors, ChunkOperations, ChunkStates } from '../../../types/core'
import type { ChunkMetadata } from '../../../value_object/chunk_metadata/types'
import type { ChunkDistance, ChunkHash, ChunkPosition } from '../../../value_object/chunk_position/types'

// ===== Primitive Branded Type Arbitraries ===== //

/**
 * ChunkDataBytes Arbitrary
 * 仕様に準拠したチャンクデータバイト配列
 */
export const chunkDataBytesArb: fc.Arbitrary<ChunkDataBytes> = fc
  .uint8Array({
    minLength: 16 * 16 * 384, // CHUNK_VOLUME
    maxLength: 16 * 16 * 384,
  })
  .map((arr) => arr as ChunkDataBytes)

/**
 * LoadProgress Arbitrary (0-100)
 * 進行度の型安全生成
 */
export const loadProgressArb: fc.Arbitrary<LoadProgress> = fc
  .integer({
    min: 0,
    max: 100,
  })
  .map((n) => n as LoadProgress)

/**
 * RetryCount Arbitrary
 * 非負整数のリトライ回数
 */
export const retryCountArb: fc.Arbitrary<RetryCount> = fc
  .integer({
    min: 0,
    max: 10,
  })
  .map((n) => n as RetryCount)

/**
 * ChunkTimestamp Arbitrary
 * 現実的なタイムスタンプ範囲
 */
export const chunkTimestampArb: fc.Arbitrary<ChunkTimestamp> = fc
  .integer({
    min: 1000000000000, // 2001年頃
    max: 2000000000000, // 2033年頃
  })
  .map((n) => n as ChunkTimestamp)

/**
 * ChangeSetId Arbitrary
 * UUIDライクな文字列ID
 */
export const changeSetIdArb: fc.Arbitrary<ChangeSetId> = fc.uuid().map((uuid) => uuid as ChangeSetId)

/**
 * ChunkDistance Arbitrary
 * 非負有限数の距離値
 */
export const chunkDistanceArb: fc.Arbitrary<ChunkDistance> = fc
  .double({
    min: 0,
    max: 1000000,
    noNaN: true,
  })
  .map((n) => n as ChunkDistance)

/**
 * ChunkHash Arbitrary
 * SHA-256ライクなハッシュ文字列
 */
export const chunkHashArb: fc.Arbitrary<ChunkHash> = fc
  .string({
    unit: fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    minLength: 64,
    maxLength: 64,
  })
  .map((hash) => hash as ChunkHash)

// ===== Value Object Arbitraries ===== //

/**
 * ChunkPosition Arbitrary
 * 現実的なチャンク座標範囲
 */
export const chunkPositionArb: fc.Arbitrary<ChunkPosition> = fc.record({
  x: fc.integer({ min: -30000000, max: 30000000 }),
  z: fc.integer({ min: -30000000, max: 30000000 }),
})

/**
 * ChunkMetadata Arbitrary
 * チャンクメタデータの生成
 */
export const chunkMetadataArb: fc.Arbitrary<ChunkMetadata> = fc.record({
  biome: fc.constantFrom('plains', 'forest', 'desert', 'mountains', 'ocean'),
  generationTime: chunkTimestampArb,
  lastModified: chunkTimestampArb,
  version: fc.integer({ min: 1, max: 10 }),
  checksum: chunkHashArb,
})

/**
 * ChangeSet Arbitrary
 * チャンク変更セットの生成
 */
export const changeSetArb: fc.Arbitrary<ChangeSet> = fc.record({
  id: changeSetIdArb,
  blocks: fc.array(
    fc.record({
      x: fc.integer({ min: 0, max: 15 }),
      y: fc.integer({ min: -64, max: 319 }),
      z: fc.integer({ min: 0, max: 15 }),
      blockId: fc.constantFrom('air', 'stone', 'dirt', 'grass', 'sand', 'water'),
      metadata: fc.option(fc.object()),
    }),
    { minLength: 0, maxLength: 100 }
  ),
  timestamp: chunkTimestampArb,
})

// ===== ADT Arbitraries ===== //

/**
 * OptimizationStrategy Arbitrary
 * 最適化戦略のADT生成
 */
export const optimizationStrategyArb: fc.Arbitrary<OptimizationStrategy> = fc.oneof(
  fc.constant('Memory' as const).map(() => ({ _tag: 'Memory' as const })),
  fc.constant('Compression' as const).map(() => ({ _tag: 'Compression' as const })),
  fc.constant('Speed' as const).map(() => ({ _tag: 'Speed' as const }))
) as fc.Arbitrary<OptimizationStrategy>

/**
 * SerializationFormat Arbitrary
 * シリアライゼーション形式のADT生成
 */
export const serializationFormatArb: fc.Arbitrary<SerializationFormat> = fc.oneof(
  fc.constant('Binary' as const).map(() => ({ _tag: 'Binary' as const })),
  fc.constant('JSON' as const).map(() => ({ _tag: 'JSON' as const })),
  fc.string().map((algorithm) => ({
    _tag: 'Compressed' as const,
    algorithm,
  }))
) as fc.Arbitrary<SerializationFormat>

/**
 * ChunkState Arbitrary
 * 全チャンク状態のADT生成
 */
export const chunkStateArb: fc.Arbitrary<ChunkState> = fc.oneof(
  // Unloaded
  fc.constant(ChunkStates.unloaded()),

  // Loading
  loadProgressArb.map((progress) => ChunkStates.loading(progress)),

  // Loaded
  fc.tuple(chunkDataBytesArb, chunkMetadataArb).map(([data, metadata]) => ChunkStates.loaded(data, metadata)),

  // Failed
  fc.tuple(fc.string(), retryCountArb).map(([error, retryCount]) => ChunkStates.failed(error, retryCount)),

  // Dirty
  fc
    .tuple(chunkDataBytesArb, changeSetArb, chunkMetadataArb)
    .map(([data, changes, metadata]) => ChunkStates.dirty(data, changes, metadata)),

  // Saving
  fc
    .tuple(chunkDataBytesArb, loadProgressArb, chunkMetadataArb)
    .map(([data, progress, metadata]) => ChunkStates.saving(data, progress, metadata)),

  // Cached
  fc.tuple(chunkDataBytesArb, chunkMetadataArb).map(([data, metadata]) => ChunkStates.cached(data, metadata))
)

/**
 * ChunkOperation Arbitrary
 * 全チャンク操作のADT生成
 */
export const chunkOperationArb: fc.Arbitrary<ChunkOperation> = fc.oneof(
  // Read
  chunkPositionArb.map((position) => ChunkOperations.read(position)),

  // Write
  fc
    .tuple(chunkPositionArb, chunkDataBytesArb, chunkMetadataArb)
    .map(([position, data, metadata]) => ChunkOperations.write(position, data, metadata)),

  // Delete
  chunkPositionArb.map((position) => ChunkOperations.delete(position)),

  // Validate
  fc
    .tuple(chunkPositionArb, fc.option(fc.string()))
    .map(([position, checksum]) => ChunkOperations.validate(position, checksum)),

  // Optimize
  fc
    .tuple(chunkPositionArb, optimizationStrategyArb)
    .map(([position, strategy]) => ChunkOperations.optimize(position, strategy)),

  // Serialize
  fc
    .tuple(chunkDataBytesArb, serializationFormatArb, chunkMetadataArb)
    .map(([data, format, metadata]) => ChunkOperations.serialize(data, format, metadata))
)

/**
 * ChunkError Arbitrary
 * 全チャンクエラーのADT生成
 */
export const chunkErrorArb: fc.Arbitrary<ChunkError> = fc.oneof(
  // ValidationError
  fc
    .tuple(fc.string(), fc.anything(), fc.string())
    .map(([field, value, constraint]) => ChunkErrors.validation(field, value, constraint)),

  // BoundsError
  fc
    .tuple(
      fc.record({
        x: fc.integer(),
        y: fc.integer(),
        z: fc.integer(),
      }),
      fc.record({
        min: fc.integer(),
        max: fc.integer(),
      })
    )
    .map(([coordinates, bounds]) => ChunkErrors.bounds(coordinates, bounds)),

  // SerializationError
  fc
    .tuple(fc.string(), fc.anything())
    .map(([format, originalError]) => ChunkErrors.serialization(format, originalError)),

  // CorruptionError
  fc.tuple(fc.string(), fc.string()).map(([checksum, expected]) => ChunkErrors.corruption(checksum, expected)),

  // TimeoutError
  fc
    .tuple(fc.string(), fc.integer({ min: 0 }))
    .map(([operation, duration]) => ChunkErrors.timeout(operation, duration)),

  // NetworkError
  fc.tuple(fc.webUrl(), fc.integer({ min: 100, max: 599 })).map(([url, status]) => ChunkErrors.network(url, status))
)

// ===== Complex Scenario Arbitraries ===== //

/**
 * ChunkWorldState Arbitrary
 * 複数チャンクの世界状態シミュレーション
 */
export const chunkWorldStateArb = fc.record({
  loadedChunks: fc.dictionary(fc.string(), chunkStateArb),
  activeOperations: fc.array(chunkOperationArb, { maxLength: 50 }),
  errorHistory: fc.array(chunkErrorArb, { maxLength: 20 }),
  cacheSize: fc.integer({ min: 0, max: 1000 }),
  memoryUsage: fc.integer({ min: 0, max: 1024 * 1024 * 1024 }), // 1GB
})

/**
 * ChunkStressTestScenario Arbitrary
 * 高負荷テストシナリオ生成
 */
export const chunkStressTestScenarioArb = fc.record({
  concurrentOperations: fc.integer({ min: 1, max: 1000 }),
  operationTypes: fc.array(chunkOperationArb, { minLength: 1, maxLength: 100 }),
  memoryConstraints: fc.record({
    maxMemory: fc.integer({ min: 1024 * 1024, max: 1024 * 1024 * 1024 }),
    gcThreshold: fc.float({ min: 0.1, max: 0.9 }),
  }),
  timeConstraints: fc.record({
    maxExecutionTime: fc.integer({ min: 100, max: 30000 }),
    timeoutThreshold: fc.integer({ min: 50, max: 5000 }),
  }),
  errorInjection: fc.record({
    errorRate: fc.float({ min: 0, max: 0.5 }),
    errorTypes: fc.array(chunkErrorArb, { maxLength: 10 }),
  }),
})

/**
 * ChunkPerformanceProfile Arbitrary
 * パフォーマンステスト用プロファイル
 */
export const chunkPerformanceProfileArb = fc.record({
  operationCounts: fc.record({
    reads: fc.integer({ min: 0, max: 10000 }),
    writes: fc.integer({ min: 0, max: 1000 }),
    optimizations: fc.integer({ min: 0, max: 100 }),
  }),
  cacheStrategy: fc.constantFrom('LRU', 'LFU', 'FIFO', 'Random'),
  compressionLevel: fc.integer({ min: 0, max: 9 }),
  batchSize: fc.integer({ min: 1, max: 100 }),
  threadCount: fc.integer({ min: 1, max: 16 }),
})

// ===== Effect-TS Integration Arbitraries ===== //

/**
 * ChunkEffectScenario Arbitrary
 * Effect型システム統合テストシナリオ
 */
export const chunkEffectScenarioArb = fc.record({
  operations: fc.array(chunkOperationArb, { minLength: 1, maxLength: 20 }),
  expectedStates: fc.array(chunkStateArb, { minLength: 1, maxLength: 20 }),
  sideEffects: fc.array(
    fc.oneof(fc.constant('log'), fc.constant('metric'), fc.constant('cache'), fc.constant('persist')),
    { maxLength: 10 }
  ),
  contextValues: fc.record({
    userId: fc.uuid(),
    sessionId: fc.uuid(),
    timestamp: chunkTimestampArb,
  }),
})

/**
 * Schema統合Property生成器
 * Effect Schemaと組み合わせたArbitrary
 */
export const createSchemaArbitrary = <A, I, R>(schema: Schema.Schema<A, I, R>) => {
  return fc.anything().filter((value) => {
    const result = Schema.decodeUnknownEither(schema)(value)
    return result._tag === 'Right'
  })
}

// ===== Export All Arbitraries ===== //
export const ChunkArbitraries = {
  // Primitives
  chunkDataBytes: chunkDataBytesArb,
  loadProgress: loadProgressArb,
  retryCount: retryCountArb,
  chunkTimestamp: chunkTimestampArb,
  changeSetId: changeSetIdArb,
  chunkDistance: chunkDistanceArb,
  chunkHash: chunkHashArb,

  // Value Objects
  chunkPosition: chunkPositionArb,
  chunkMetadata: chunkMetadataArb,
  changeSet: changeSetArb,

  // ADTs
  optimizationStrategy: optimizationStrategyArb,
  serializationFormat: serializationFormatArb,
  chunkState: chunkStateArb,
  chunkOperation: chunkOperationArb,
  chunkError: chunkErrorArb,

  // Complex Scenarios
  chunkWorldState: chunkWorldStateArb,
  chunkStressTestScenario: chunkStressTestScenarioArb,
  chunkPerformanceProfile: chunkPerformanceProfileArb,
  chunkEffectScenario: chunkEffectScenarioArb,

  // Schema Integration
  createSchemaArbitrary,
} as const
