/**
 * Chunk Domain Services
 *
 * チャンクドメインの全てのドメインサービスを統合し、
 * 一元的なレイヤー管理と依存性注入を提供します。
 */

import { Layer, Effect } from 'effect'
import {
  ChunkValidationService,
  ChunkValidationServiceLive
} from './chunk_validator'
import {
  ChunkSerializationService,
  ChunkSerializationServiceLive
} from './chunk_serializer'
import {
  ChunkOptimizationService,
  ChunkOptimizationServiceLive,
  type OptimizationResult
} from './chunk_optimizer'
import { ChunkData } from '../aggregate/chunk'
import { ChunkDataValidationError } from '../aggregate/chunk_data'

// 個別サービスの再エクスポート
export {
  ChunkValidationService,
  ChunkValidationServiceLive,
  type ChunkValidationService as ChunkValidationServiceType
} from './chunk_validator'

export {
  ChunkSerializationService,
  ChunkSerializationServiceLive,
  type ChunkSerializationService as ChunkSerializationServiceType,
  type SerializationFormat,
  SerializationFormat
} from './chunk_serializer'

export {
  ChunkOptimizationService,
  ChunkOptimizationServiceLive,
  type ChunkOptimizationService as ChunkOptimizationServiceType,
  type OptimizationStrategy,
  OptimizationStrategy,
  type OptimizationMetrics,
  type OptimizationResult
} from './chunk_optimizer'

/**
 * 全てのチャンクドメインサービスを統合したレイヤー
 */
export const ChunkDomainServices = Layer.mergeAll(
  ChunkValidationServiceLive,
  ChunkSerializationServiceLive,
  ChunkOptimizationServiceLive
)

/**
 * 高レベルドメインオペレーション
 * 複数のドメインサービスを組み合わせた複合操作を提供
 */

/**
 * チャンクの完全検証（位置、データ、メタデータ、整合性、チェックサム）
 */
export const performCompleteChunkValidation = (chunk: ChunkData) =>
  Effect.gen(function* () {
    const validation = yield* ChunkValidationService
    const serialization = yield* ChunkSerializationService

    // 段階的検証
    yield* validation.validatePosition(chunk.position)
    yield* validation.validateData(chunk.blocks)
    yield* validation.validateMetadata(chunk.metadata)

    // 整合性チェック
    const isIntegrityValid = yield* validation.validateIntegrity(chunk)
    if (!isIntegrityValid) {
      return yield* Effect.fail(
        new ChunkDataValidationError({
          message: 'チャンクの整合性検証に失敗しました',
          data: chunk
        })
      )
    }

    // チェックサム検証
    const checksum = yield* serialization.calculateChecksum(chunk.blocks)
    const isChecksumValid = yield* validation.validateChecksum(chunk.blocks, checksum)

    return {
      isValid: isChecksumValid,
      checksum,
      integrityValid: isIntegrityValid
    }
  })

/**
 * チャンクの最適化と検証（最適化後に検証を実行）
 */
export const optimizeAndValidateChunk = (chunk: ChunkData) =>
  Effect.gen(function* () {
    const optimization = yield* ChunkOptimizationService
    const validation = yield* ChunkValidationService

    const metrics = yield* optimization.analyzeEfficiency(chunk)
    const strategies = yield* optimization.suggestOptimizations(metrics)

    const { optimizedChunk, results } = yield* Effect.reduce(
      strategies,
      { optimizedChunk: chunk, results: [] as Array<typeof strategies[number]> },
      (state, strategy) =>
        pipe(
          optimization.applyOptimization(state.optimizedChunk, strategy),
          Effect.map((result) =>
            result.qualityLoss <= 0.1
              ? {
                  optimizedChunk: result.chunk,
                  results: [...state.results, result],
                }
              : state
          )
        )
    )

    const validationResult = yield* performCompleteChunkValidation(optimizedChunk)

    return {
      originalChunk: chunk,
      optimizedChunk,
      optimizationResults: results,
      validationResult,
      metrics,
    }
  })

/**
 * チャンクのシリアライゼーションと整合性保証
 */
export const serializeWithIntegrityCheck = (chunk: ChunkData, format: any) =>
  Effect.gen(function* () {
    const serialization = yield* ChunkSerializationService
    const validation = yield* ChunkValidationService

    // シリアライゼーション前の検証
    yield* validation.validateIntegrity(chunk)

    // シリアライゼーション実行
    const serialized = yield* serialization.serialize(chunk, format)

    // 整合性検証
    const isValid = yield* serialization.validateSerialization(chunk, serialized, format)

    if (!isValid) {
      return yield* Effect.fail(
        new ChunkDataValidationError({
          message: 'シリアライゼーション後の整合性検証に失敗しました',
          data: chunk
        })
      )
    }

    // チェックサム計算
    const checksum = yield* serialization.calculateChecksum(serialized)

    return {
      serializedData: serialized,
      checksum,
      format,
      size: serialized.byteLength,
      isValid
    }
  })

/**
 * チャンクの完全処理パイプライン
 * 検証 → 最適化 → シリアライゼーション → 最終検証
 */
export const processChunkCompletely = (chunk: ChunkData, serializationFormat: any) =>
  Effect.gen(function* () {
    const initialValidation = yield* performCompleteChunkValidation(chunk)
    const optimizationResult = yield* optimizeAndValidateChunk(chunk)
    const serializationResult = yield* serializeWithIntegrityCheck(
      optimizationResult.optimizedChunk,
      serializationFormat
    )
    const serialization = yield* ChunkSerializationService
    const finalChecksum = yield* serialization.calculateChecksum(
      serializationResult.serializedData
    )

    return {
      pipeline: {
        initialValidation,
        optimization: optimizationResult,
        serialization: serializationResult,
        finalChecksum
      },
      summary: {
        originalSize: chunk.blocks.byteLength,
        optimizedSize: optimizationResult.optimizedChunk.blocks.byteLength,
        serializedSize: serializationResult.serializedData.byteLength,
        totalCompressionRatio: serializationResult.serializedData.byteLength / chunk.blocks.byteLength,
        isValid: serializationResult.isValid && initialValidation.isValid
      }
    }
  })

/**
 * バッチチャンク処理（複数チャンクの並列処理）
 */
export const processBatchChunks = (chunks: ReadonlyArray<ChunkData>, serializationFormat: any) =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(
      chunks,
      (chunk) => processChunkCompletely(chunk, serializationFormat),
      { concurrency: 'unbounded' }
    )

    const { totalOriginalSize, totalSerializedSize, successCount } = results.reduce(
      (acc, result) => ({
        totalOriginalSize: acc.totalOriginalSize + result.summary.originalSize,
        totalSerializedSize: acc.totalSerializedSize + result.summary.serializedSize,
        successCount: acc.successCount + (result.summary.isValid ? 1 : 0),
      }),
      { totalOriginalSize: 0, totalSerializedSize: 0, successCount: 0 }
    )

    return {
      results,
      batchStatistics: {
        totalChunks: chunks.length,
        successfullyProcessed: successCount,
        failedProcessing: chunks.length - successCount,
        totalOriginalSize,
        totalSerializedSize,
        averageCompressionRatio: totalSerializedSize / Math.max(1, totalOriginalSize),
        successRate: successCount / Math.max(1, chunks.length),
      },
    }
  })
