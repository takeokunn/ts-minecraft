/**
 * View Distance Management System
 * 描画距離の動的調整とパフォーマンス最適化（クラス使用禁止）
 */

import { Context, Effect, Ref, Layer, Schema } from 'effect'
import type { ChunkPosition } from './index.js'
import type { Vector3 } from '../world/index.js'

// =============================================================================
// Types & Schemas
// =============================================================================

export const PerformanceMetricsSchema = Schema.Struct({
  frameRate: Schema.Number.pipe(Schema.positive()),
  memoryUsageMB: Schema.Number.pipe(Schema.nonNegative()),
  averageChunkLoadTimeMs: Schema.Number.pipe(Schema.nonNegative()),
  totalLoadedChunks: Schema.Number.pipe(Schema.nonNegative()),
  timestamp: Schema.Number,
})

export type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetricsSchema>

export const ViewDistanceConfigSchema = Schema.Struct({
  minViewDistance: Schema.Number.pipe(Schema.positive()),
  maxViewDistance: Schema.Number.pipe(Schema.positive()),
  defaultViewDistance: Schema.Number.pipe(Schema.positive()),
  targetFrameRate: Schema.Number.pipe(Schema.positive()),
  maxMemoryUsageMB: Schema.Number.pipe(Schema.positive()),
  adaptiveEnabled: Schema.Boolean,
  adjustmentThreshold: Schema.Number.pipe(Schema.positive()),
  metricsHistorySize: Schema.Number.pipe(Schema.positive()),
})

export type ViewDistanceConfig = Schema.Schema.Type<typeof ViewDistanceConfigSchema>

export const defaultViewDistanceConfig: ViewDistanceConfig = {
  minViewDistance: 4,
  maxViewDistance: 32,
  defaultViewDistance: 16,
  targetFrameRate: 60,
  maxMemoryUsageMB: 2000, // 2GB
  adaptiveEnabled: true,
  adjustmentThreshold: 0.1, // 10%の変化で調整
  metricsHistorySize: 60, // 60サンプル（1秒分）
}

export const ViewDistanceAdjustmentReasonSchema = Schema.Literal(
  'performance_low',
  'memory_high',
  'load_time_high',
  'performance_good',
  'manual',
  'initialization'
)

export type ViewDistanceAdjustmentReason = Schema.Schema.Type<typeof ViewDistanceAdjustmentReasonSchema>

export const ViewDistanceEventSchema = Schema.Struct({
  timestamp: Schema.Number,
  oldDistance: Schema.Number,
  newDistance: Schema.Number,
  reason: ViewDistanceAdjustmentReasonSchema,
  metrics: Schema.optional(PerformanceMetricsSchema),
})

export type ViewDistanceEvent = Schema.Schema.Type<typeof ViewDistanceEventSchema>

// =============================================================================
// State Management
// =============================================================================

export interface ViewDistanceState {
  readonly currentViewDistance: number
  readonly targetViewDistance: number
  readonly metricsHistory: PerformanceMetrics[]
  readonly adjustmentHistory: ViewDistanceEvent[]
  readonly config: ViewDistanceConfig
  readonly lastAdjustmentTime: number
}

// =============================================================================
// Performance Analysis Functions (純粋関数実装)
// =============================================================================

export const calculateAverageMetrics = (
  metricsHistory: PerformanceMetrics[],
  sampleCount: number = 30
): PerformanceMetrics | null => {
  if (metricsHistory.length === 0) {
    return null
  }

  const recentMetrics = metricsHistory.slice(-sampleCount)
  const totalSamples = recentMetrics.length

  if (totalSamples === 0) {
    return null
  }

  const sum = recentMetrics.reduce(
    (acc, metrics) => ({
      frameRate: acc.frameRate + metrics.frameRate,
      memoryUsageMB: acc.memoryUsageMB + metrics.memoryUsageMB,
      averageChunkLoadTimeMs: acc.averageChunkLoadTimeMs + metrics.averageChunkLoadTimeMs,
      totalLoadedChunks: acc.totalLoadedChunks + metrics.totalLoadedChunks,
      timestamp: Math.max(acc.timestamp, metrics.timestamp),
    }),
    {
      frameRate: 0,
      memoryUsageMB: 0,
      averageChunkLoadTimeMs: 0,
      totalLoadedChunks: 0,
      timestamp: 0,
    }
  )

  return {
    frameRate: sum.frameRate / totalSamples,
    memoryUsageMB: sum.memoryUsageMB / totalSamples,
    averageChunkLoadTimeMs: sum.averageChunkLoadTimeMs / totalSamples,
    totalLoadedChunks: sum.totalLoadedChunks / totalSamples,
    timestamp: sum.timestamp,
  }
}

export const analyzePerformanceTrend = (
  metricsHistory: PerformanceMetrics[],
  config: ViewDistanceConfig
): {
  frameRateTrend: 'improving' | 'stable' | 'degrading'
  memoryTrend: 'improving' | 'stable' | 'degrading'
  loadTimeTrend: 'improving' | 'stable' | 'degrading'
} => {
  if (metricsHistory.length < 10) {
    return {
      frameRateTrend: 'stable',
      memoryTrend: 'stable',
      loadTimeTrend: 'stable',
    }
  }

  const recent = metricsHistory.slice(-5)
  const older = metricsHistory.slice(-15, -10)

  const recentAvg = calculateAverageMetrics(recent, 5)
  const olderAvg = calculateAverageMetrics(older, 5)

  if (!recentAvg || !olderAvg) {
    return {
      frameRateTrend: 'stable',
      memoryTrend: 'stable',
      loadTimeTrend: 'stable',
    }
  }

  const frameRateChange = (recentAvg.frameRate - olderAvg.frameRate) / olderAvg.frameRate
  const memoryChange = (recentAvg.memoryUsageMB - olderAvg.memoryUsageMB) / olderAvg.memoryUsageMB
  const loadTimeChange = (recentAvg.averageChunkLoadTimeMs - olderAvg.averageChunkLoadTimeMs) / olderAvg.averageChunkLoadTimeMs

  const threshold = config.adjustmentThreshold

  return {
    frameRateTrend:
      frameRateChange > threshold ? 'improving' :
      frameRateChange < -threshold ? 'degrading' : 'stable',
    memoryTrend:
      memoryChange > threshold ? 'degrading' : // メモリ使用量増加は悪化
      memoryChange < -threshold ? 'improving' : 'stable',
    loadTimeTrend:
      loadTimeChange > threshold ? 'degrading' : // ロード時間増加は悪化
      loadTimeChange < -threshold ? 'improving' : 'stable',
  }
}

export const calculateOptimalViewDistance = (
  currentDistance: number,
  metrics: PerformanceMetrics,
  config: ViewDistanceConfig
): {
  suggestedDistance: number
  reason: ViewDistanceAdjustmentReason
  confidence: number
} => {
  const {
    minViewDistance,
    maxViewDistance,
    targetFrameRate,
    maxMemoryUsageMB,
  } = config

  // パフォーマンス問題の判定
  const lowFrameRate = metrics.frameRate < targetFrameRate * 0.9 // 90%未満
  const highMemoryUsage = metrics.memoryUsageMB > maxMemoryUsageMB * 0.8 // 80%超過
  const highLoadTime = metrics.averageChunkLoadTimeMs > 200 // 200ms超過

  let suggestedDistance = currentDistance
  let reason: ViewDistanceAdjustmentReason = 'manual'
  let confidence = 0.5

  if (lowFrameRate) {
    // フレームレート低下 → 描画距離を減らす
    const reductionFactor = Math.max(0.7, metrics.frameRate / targetFrameRate)
    suggestedDistance = Math.max(
      minViewDistance,
      Math.floor(currentDistance * reductionFactor)
    )
    reason = 'performance_low'
    confidence = 0.8
  } else if (highMemoryUsage) {
    // メモリ使用量過多 → 描画距離を減らす
    const reductionFactor = Math.max(0.8, maxMemoryUsageMB / metrics.memoryUsageMB)
    suggestedDistance = Math.max(
      minViewDistance,
      Math.floor(currentDistance * reductionFactor)
    )
    reason = 'memory_high'
    confidence = 0.9
  } else if (highLoadTime) {
    // ロード時間過長 → 描画距離を減らす
    suggestedDistance = Math.max(
      minViewDistance,
      currentDistance - 2
    )
    reason = 'load_time_high'
    confidence = 0.7
  } else if (
    metrics.frameRate > targetFrameRate * 1.1 && // 110%以上
    metrics.memoryUsageMB < maxMemoryUsageMB * 0.6 && // 60%未満
    metrics.averageChunkLoadTimeMs < 100 // 100ms未満
  ) {
    // 余裕がある → 描画距離を増やす
    suggestedDistance = Math.min(
      maxViewDistance,
      currentDistance + 1
    )
    reason = 'performance_good'
    confidence = 0.6
  }

  return {
    suggestedDistance,
    reason,
    confidence,
  }
}

export const getVisibleChunkPositions = (
  centerPosition: Vector3,
  viewDistance: number
): ChunkPosition[] => {
  const centerChunk = {
    x: Math.floor(centerPosition.x / 16),
    z: Math.floor(centerPosition.z / 16),
  }

  const positions: ChunkPosition[] = []

  for (let x = centerChunk.x - viewDistance; x <= centerChunk.x + viewDistance; x++) {
    for (let z = centerChunk.z - viewDistance; z <= centerChunk.z + viewDistance; z++) {
      const distance = Math.max(Math.abs(x - centerChunk.x), Math.abs(z - centerChunk.z))
      if (distance <= viewDistance) {
        positions.push({ x, z })
      }
    }
  }

  return positions
}

export const calculateChunkPriority = (
  chunkPosition: ChunkPosition,
  playerPosition: Vector3,
  viewDistance: number
): number => {
  const playerChunk = {
    x: Math.floor(playerPosition.x / 16),
    z: Math.floor(playerPosition.z / 16),
  }

  const distance = Math.max(
    Math.abs(chunkPosition.x - playerChunk.x),
    Math.abs(chunkPosition.z - playerChunk.z)
  )

  // 距離に基づく優先度（近いほど高い）
  const distancePriority = (viewDistance - distance) / viewDistance

  // プレイヤーの向きに基づく優先度（簡易実装）
  const dx = chunkPosition.x - playerChunk.x
  const dz = chunkPosition.z - playerChunk.z
  const angle = Math.atan2(dz, dx)
  const directionPriority = (Math.cos(angle) + 1) / 2 // 前方を優先

  return distancePriority * 0.8 + directionPriority * 0.2
}

// =============================================================================
// ViewDistance Service Interface
// =============================================================================

export interface ViewDistance {
  /**
   * 現在の描画距離を取得
   */
  readonly getCurrentViewDistance: () => Effect.Effect<number, never>

  /**
   * 描画距離を設定
   */
  readonly setViewDistance: (
    distance: number,
    reason: ViewDistanceAdjustmentReason
  ) => Effect.Effect<void, never>

  /**
   * パフォーマンスメトリクスを更新
   */
  readonly updateMetrics: (metrics: PerformanceMetrics) => Effect.Effect<void, never>

  /**
   * 適応的描画距離調整を実行
   */
  readonly performAdaptiveAdjustment: () => Effect.Effect<ViewDistanceEvent | null, never>

  /**
   * 指定位置から見える全チャンク位置を取得
   */
  readonly getVisibleChunks: (centerPosition: Vector3) => Effect.Effect<ChunkPosition[], never>

  /**
   * 指定位置から見える全チャンク位置を優先度付きで取得
   */
  readonly getVisibleChunksWithPriority: (
    centerPosition: Vector3
  ) => Effect.Effect<Array<{ position: ChunkPosition; priority: number }>, never>

  /**
   * 現在のパフォーマンス統計を取得
   */
  readonly getPerformanceStats: () => Effect.Effect<{
    currentMetrics: PerformanceMetrics | null
    averageMetrics: PerformanceMetrics | null
    adjustmentHistory: ViewDistanceEvent[]
  }, never>

  /**
   * 設定を更新
   */
  readonly updateConfig: (newConfig: Partial<ViewDistanceConfig>) => Effect.Effect<void, never>
}

export const ViewDistance = Context.GenericTag<ViewDistance>('ViewDistance')

// =============================================================================
// Service Implementation
// =============================================================================

export const createViewDistance = (
  config: ViewDistanceConfig = defaultViewDistanceConfig
): Effect.Effect<ViewDistance, never> =>
  Effect.gen(function* () {
    // State管理
    const state = yield* Ref.make<ViewDistanceState>({
      currentViewDistance: config.defaultViewDistance,
      targetViewDistance: config.defaultViewDistance,
      metricsHistory: [],
      adjustmentHistory: [],
      config,
      lastAdjustmentTime: Date.now(),
    })

    const getCurrentViewDistance = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return currentState.currentViewDistance
      })

    const setViewDistance = (
      distance: number,
      reason: ViewDistanceAdjustmentReason
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const clampedDistance = Math.max(
          currentState.config.minViewDistance,
          Math.min(currentState.config.maxViewDistance, distance)
        )

        if (clampedDistance === currentState.currentViewDistance) {
          return
        }

        const event: ViewDistanceEvent = {
          timestamp: Date.now(),
          oldDistance: currentState.currentViewDistance,
          newDistance: clampedDistance,
          reason,
          metrics: currentState.metricsHistory.length > 0
            ? currentState.metricsHistory[currentState.metricsHistory.length - 1]
            : undefined,
        }

        yield* Ref.update(state, currentState => ({
          ...currentState,
          currentViewDistance: clampedDistance,
          targetViewDistance: clampedDistance,
          adjustmentHistory: [
            ...currentState.adjustmentHistory.slice(-(currentState.config.metricsHistorySize - 1)),
            event,
          ],
          lastAdjustmentTime: Date.now(),
        }))
      })

    const updateMetrics = (metrics: PerformanceMetrics): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(state, currentState => ({
          ...currentState,
          metricsHistory: [
            ...currentState.metricsHistory.slice(-(currentState.config.metricsHistorySize - 1)),
            metrics,
          ],
        }))
      })

    const performAdaptiveAdjustment = (): Effect.Effect<ViewDistanceEvent | null, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        if (!currentState.config.adaptiveEnabled) {
          return null
        }

        // 最低限のメトリクス履歴が必要
        if (currentState.metricsHistory.length < 10) {
          return null
        }

        // 最後の調整から一定時間経過を確認（過度な調整を防ぐ）
        const timeSinceLastAdjustment = Date.now() - currentState.lastAdjustmentTime
        if (timeSinceLastAdjustment < 5000) { // 5秒間隔
          return null
        }

        const latestMetrics = currentState.metricsHistory[currentState.metricsHistory.length - 1]
        if (!latestMetrics) {
          return null
        }

        const optimization = calculateOptimalViewDistance(
          currentState.currentViewDistance,
          latestMetrics,
          currentState.config
        )

        // 変更が必要でない場合
        if (optimization.suggestedDistance === currentState.currentViewDistance) {
          return null
        }

        // 信頼度が低い場合は調整しない
        if (optimization.confidence < 0.6) {
          return null
        }

        yield* setViewDistance(optimization.suggestedDistance, optimization.reason)

        // 調整後の状態を取得してイベントを返す
        const updatedState = yield* Ref.get(state)
        return updatedState.adjustmentHistory[updatedState.adjustmentHistory.length - 1] ?? null
      })

    const getVisibleChunks = (centerPosition: Vector3): Effect.Effect<ChunkPosition[], never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return getVisibleChunkPositions(centerPosition, currentState.currentViewDistance)
      })

    const getVisibleChunksWithPriority = (
      centerPosition: Vector3
    ): Effect.Effect<Array<{ position: ChunkPosition; priority: number }>, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const positions = getVisibleChunkPositions(centerPosition, currentState.currentViewDistance)

        return positions.map(position => ({
          position,
          priority: calculateChunkPriority(
            position,
            centerPosition,
            currentState.currentViewDistance
          ),
        })).sort((a, b) => b.priority - a.priority)
      })

    const getPerformanceStats = (): Effect.Effect<{
      currentMetrics: PerformanceMetrics | null
      averageMetrics: PerformanceMetrics | null
      adjustmentHistory: ViewDistanceEvent[]
    }, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        const currentMetrics = currentState.metricsHistory.length > 0
          ? currentState.metricsHistory[currentState.metricsHistory.length - 1]
          : null

        const averageMetrics = calculateAverageMetrics(currentState.metricsHistory)

        return {
          currentMetrics,
          averageMetrics,
          adjustmentHistory: currentState.adjustmentHistory,
        }
      })

    const updateConfig = (newConfig: Partial<ViewDistanceConfig>): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(state, currentState => ({
          ...currentState,
          config: { ...currentState.config, ...newConfig },
        }))
      })

    return {
      getCurrentViewDistance,
      setViewDistance,
      updateMetrics,
      performAdaptiveAdjustment,
      getVisibleChunks,
      getVisibleChunksWithPriority,
      getPerformanceStats,
      updateConfig,
    }
  })

// =============================================================================
// Layer Implementation
// =============================================================================

export const ViewDistanceLive = (
  config: ViewDistanceConfig = defaultViewDistanceConfig
): Layer.Layer<ViewDistance, never, never> =>
  Layer.effect(ViewDistance, createViewDistance(config))