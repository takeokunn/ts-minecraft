/**
 * @fileoverview Generation State - 生成状態管理
 *
 * WorldGeneratorの内部状態を管理します。
 * - 生成進捗の追跡
 * - 並行制御のための状態管理
 * - パフォーマンス最適化のための統計情報
 */

import { Effect, Schema, Brand, HashMap, Option } from "effect"
import * as Coordinates from "../../value_object/coordinates/index.js"
import type * as WorldTypes from "../../types/core/world_types.js"
import type * as GenerationErrors from "../../types/errors/generation_errors.js"

// ================================
// Generation Status
// ================================

export const GenerationStatusSchema = Schema.Literal(
  "idle",        // 待機中
  "generating",  // 生成中
  "completed",   // 完了
  "failed",      // 失敗
  "cancelled"    // キャンセル
)

export type GenerationStatus = typeof GenerationStatusSchema.Type

// ================================
// Chunk Generation Info
// ================================

export const ChunkGenerationInfoSchema = Schema.Struct({
  coordinate: Coordinates.ChunkCoordinateSchema,
  status: GenerationStatusSchema,
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  startedAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  lastError: Schema.optional(Schema.String),
  estimatedDuration: Schema.optional(Schema.Number), // ミリ秒
  actualDuration: Schema.optional(Schema.Number), // ミリ秒
})

export type ChunkGenerationInfo = typeof ChunkGenerationInfoSchema.Type

// ================================
// Generation Statistics
// ================================

export const GenerationStatisticsSchema = Schema.Struct({
  totalChunksGenerated: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  totalGenerationTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  averageGenerationTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  successRate: Schema.Number.pipe(Schema.between(0, 1)), // 0.0 - 1.0
  concurrentGenerations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  peakConcurrentGenerations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  failureCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  retryCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})

export type GenerationStatistics = typeof GenerationStatisticsSchema.Type

// ================================
// Generation State
// ================================

export const GenerationStateSchema = Schema.Struct({
  status: GenerationStatusSchema,
  activeGenerations: Schema.Record({
    key: Schema.String, // ChunkCoordinate文字列表現
    value: ChunkGenerationInfoSchema
  }),
  completedChunks: Schema.Record({
    key: Schema.String, // ChunkCoordinate文字列表現
    value: Schema.Struct({
      info: ChunkGenerationInfoSchema,
      dataHash: Schema.String, // 生成されたデータのハッシュ
    })
  }),
  statistics: GenerationStatisticsSchema,
  lastActivity: Schema.DateTimeUtc,
})

export type GenerationState = typeof GenerationStateSchema.Type

// ================================
// State Operations
// ================================

/**
 * 初期状態作成
 */
export const createInitial = (): GenerationState => ({
  status: "idle",
  activeGenerations: {},
  completedChunks: {},
  statistics: {
    totalChunksGenerated: 0,
    totalGenerationTime: 0,
    averageGenerationTime: 0,
    successRate: 1.0,
    concurrentGenerations: 0,
    peakConcurrentGenerations: 0,
    failureCount: 0,
    retryCount: 0,
  },
  lastActivity: new Date(),
})

/**
 * チャンク生成開始
 */
export const startChunkGeneration = (
  state: GenerationState,
  coordinate: Coordinates.ChunkCoordinate,
  priority: number = 5
): Effect.Effect<GenerationState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const coordinateKey = coordinateToKey(coordinate)
    const now = yield* Effect.sync(() => new Date())

    // 既に生成中または完了済みかチェック
    if (coordinateKey in state.activeGenerations) {
      return yield* Effect.fail(
        GenerationErrors.createStateError(`Chunk ${coordinateKey} is already being generated`)
      )
    }

    if (coordinateKey in state.completedChunks) {
      return yield* Effect.fail(
        GenerationErrors.createStateError(`Chunk ${coordinateKey} is already completed`)
      )
    }

    const generationInfo: ChunkGenerationInfo = {
      coordinate,
      status: "generating",
      priority,
      startedAt: now,
      attempts: 1,
    }

    const newConcurrentCount = state.statistics.concurrentGenerations + 1

    const updatedState: GenerationState = {
      ...state,
      status: "generating",
      activeGenerations: {
        ...state.activeGenerations,
        [coordinateKey]: generationInfo,
      },
      statistics: {
        ...state.statistics,
        concurrentGenerations: newConcurrentCount,
        peakConcurrentGenerations: Math.max(
          state.statistics.peakConcurrentGenerations,
          newConcurrentCount
        ),
      },
      lastActivity: now,
    }

    return updatedState
  })

/**
 * チャンク生成完了
 */
export const completeChunkGeneration = (
  state: GenerationState,
  coordinate: Coordinates.ChunkCoordinate,
  chunkData: WorldTypes.ChunkData
): Effect.Effect<GenerationState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const coordinateKey = coordinateToKey(coordinate)
    const now = yield* Effect.sync(() => new Date())

    const activeGeneration = state.activeGenerations[coordinateKey]
    if (!activeGeneration) {
      return yield* Effect.fail(
        GenerationErrors.createStateError(`No active generation found for chunk ${coordinateKey}`)
      )
    }

    // 生成時間計算
    const duration = activeGeneration.startedAt
      ? now.getTime() - activeGeneration.startedAt.getTime()
      : 0

    // データハッシュ計算 (簡易実装)
    const dataHash = yield* Effect.sync(() =>
      calculateChunkDataHash(chunkData)
    )

    const completedInfo: ChunkGenerationInfo = {
      ...activeGeneration,
      status: "completed",
      completedAt: now,
      actualDuration: duration,
    }

    // 統計更新
    const newTotalGenerated = state.statistics.totalChunksGenerated + 1
    const newTotalTime = state.statistics.totalGenerationTime + duration
    const newAverageTime = newTotalTime / newTotalGenerated
    const totalAttempts = newTotalGenerated + state.statistics.failureCount
    const newSuccessRate = newTotalGenerated / totalAttempts

    const { [coordinateKey]: _, ...remainingActiveGenerations } = state.activeGenerations
    const newConcurrentCount = state.statistics.concurrentGenerations - 1

    const updatedState: GenerationState = {
      ...state,
      status: Object.keys(remainingActiveGenerations).length > 0 ? "generating" : "idle",
      activeGenerations: remainingActiveGenerations,
      completedChunks: {
        ...state.completedChunks,
        [coordinateKey]: {
          info: completedInfo,
          dataHash,
        },
      },
      statistics: {
        ...state.statistics,
        totalChunksGenerated: newTotalGenerated,
        totalGenerationTime: newTotalTime,
        averageGenerationTime: newAverageTime,
        successRate: newSuccessRate,
        concurrentGenerations: newConcurrentCount,
      },
      lastActivity: now,
    }

    return updatedState
  })

/**
 * チャンク生成失敗
 */
export const failChunkGeneration = (
  state: GenerationState,
  coordinate: Coordinates.ChunkCoordinate,
  error: string
): Effect.Effect<GenerationState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const coordinateKey = coordinateToKey(coordinate)
    const now = yield* Effect.sync(() => new Date())

    const activeGeneration = state.activeGenerations[coordinateKey]
    if (!activeGeneration) {
      return yield* Effect.fail(
        GenerationErrors.createStateError(`No active generation found for chunk ${coordinateKey}`)
      )
    }

    const failedInfo: ChunkGenerationInfo = {
      ...activeGeneration,
      status: "failed",
      completedAt: now,
      lastError: error,
    }

    // 統計更新
    const totalAttempts = state.statistics.totalChunksGenerated + state.statistics.failureCount + 1
    const newSuccessRate = state.statistics.totalChunksGenerated / totalAttempts

    const { [coordinateKey]: _, ...remainingActiveGenerations } = state.activeGenerations
    const newConcurrentCount = state.statistics.concurrentGenerations - 1

    const updatedState: GenerationState = {
      ...state,
      status: Object.keys(remainingActiveGenerations).length > 0 ? "generating" : "idle",
      activeGenerations: remainingActiveGenerations,
      statistics: {
        ...state.statistics,
        successRate: newSuccessRate,
        concurrentGenerations: newConcurrentCount,
        failureCount: state.statistics.failureCount + 1,
      },
      lastActivity: now,
    }

    return updatedState
  })

/**
 * 現在の生成負荷取得
 */
export const getCurrentGenerationLoad = (
  state: GenerationState
): Effect.Effect<number, never> =>
  Effect.succeed(state.statistics.concurrentGenerations)

/**
 * 生成状況の取得
 */
export const getGenerationProgress = (
  state: GenerationState
): Effect.Effect<{
  activeCount: number
  completedCount: number
  failedCount: number
  averageTime: number
  successRate: number
}, never> =>
  Effect.succeed({
    activeCount: Object.keys(state.activeGenerations).length,
    completedCount: state.statistics.totalChunksGenerated,
    failedCount: state.statistics.failureCount,
    averageTime: state.statistics.averageGenerationTime,
    successRate: state.statistics.successRate,
  })

/**
 * 特定チャンクの生成状況確認
 */
export const getChunkGenerationStatus = (
  state: GenerationState,
  coordinate: Coordinates.ChunkCoordinate
): Option.Option<{
  status: GenerationStatus
  info: ChunkGenerationInfo
  dataHash?: string
}> => {
  const coordinateKey = coordinateToKey(coordinate)

  // アクティブ生成をチェック
  const activeGeneration = state.activeGenerations[coordinateKey]
  if (activeGeneration) {
    return Option.some({
      status: activeGeneration.status,
      info: activeGeneration,
    })
  }

  // 完了済みをチェック
  const completed = state.completedChunks[coordinateKey]
  if (completed) {
    return Option.some({
      status: completed.info.status,
      info: completed.info,
      dataHash: completed.dataHash,
    })
  }

  return Option.none()
}

// ================================
// Helper Functions
// ================================

/**
 * 座標を文字列キーに変換
 */
const coordinateToKey = (coordinate: Coordinates.ChunkCoordinate): string =>
  `${coordinate.x},${coordinate.z}`

/**
 * チャンクデータのハッシュ計算 (簡易実装)
 */
const calculateChunkDataHash = (chunkData: WorldTypes.ChunkData): string => {
  const data = JSON.stringify({
    coordinate: chunkData.coordinate,
    heightMapChecksum: chunkData.heightMap.reduce((sum, height) => sum + height, 0),
    biomeChecksum: chunkData.biomes.reduce((sum, biome) => sum + biome, 0),
    structureCount: chunkData.structures.length,
  })

  // 簡易ハッシュ関数 (本番環境では暗号学的ハッシュ関数を使用)
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32bit整数に変換
  }
  return hash.toString(36)
}

// ================================
// Exports
// ================================

export {
  type GenerationStatus,
  type ChunkGenerationInfo,
  type GenerationStatistics,
}