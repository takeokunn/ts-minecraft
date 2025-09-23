/**
 * View Distance Management System
 * 描画距離の動的調整とパフォーマンス最適化（クラス使用禁止）
 */

import { Context, Effect, Ref, Layer, Schema, pipe, Match, Option, Clock } from 'effect'
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
  return pipe(
    metricsHistory.length === 0,
    Match.value,
    Match.when(true, () => null),
    Match.orElse(() => {
      const recentMetrics = metricsHistory.slice(-sampleCount)
      const totalSamples = recentMetrics.length

      return pipe(
        totalSamples === 0,
        Match.value,
        Match.when(true, () => null),
        Match.orElse(() => {
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
        })
      )
    })
  )
}

export const analyzePerformanceTrend = (
  metricsHistory: PerformanceMetrics[],
  config: ViewDistanceConfig
): {
  frameRateTrend: 'improving' | 'stable' | 'degrading'
  memoryTrend: 'improving' | 'stable' | 'degrading'
  loadTimeTrend: 'improving' | 'stable' | 'degrading'
} => {
  return pipe(
    metricsHistory.length < 10,
    Match.value,
    Match.when(true, () => ({
      frameRateTrend: 'stable' as const,
      memoryTrend: 'stable' as const,
      loadTimeTrend: 'stable' as const,
    })),
    Match.orElse(() => {
      const recent = metricsHistory.slice(-5)
      const older = metricsHistory.slice(-10, -5)

      const recentAvg = calculateAverageMetrics(recent, 5)
      const olderAvg = calculateAverageMetrics(older, 5)

      // 明示的なnullチェックと早期リターン
      return pipe(
        [recentAvg, olderAvg] as const,
        Option.liftPredicate(([recent, older]) => recent !== null && older !== null),
        Option.match({
          onNone: () => ({
            frameRateTrend: 'stable' as const,
            memoryTrend: 'stable' as const,
            loadTimeTrend: 'stable' as const,
          }),
          onSome: ([recentAvg, olderAvg]) => {
            // この時点でrecentAvgとolderAvgは確実に非null
            const frameRateChange = (recentAvg!.frameRate - olderAvg!.frameRate) / olderAvg!.frameRate
            const memoryChange = (recentAvg!.memoryUsageMB - olderAvg!.memoryUsageMB) / olderAvg!.memoryUsageMB
            const loadTimeChange =
              (recentAvg!.averageChunkLoadTimeMs - olderAvg!.averageChunkLoadTimeMs) / olderAvg!.averageChunkLoadTimeMs

            const threshold = config.adjustmentThreshold

            return {
              frameRateTrend: pipe(
                frameRateChange > threshold,
                Match.value,
                Match.when(true, () => 'improving' as const),
                Match.when(false, () =>
                  pipe(
                    frameRateChange < -threshold,
                    Match.value,
                    Match.when(true, () => 'degrading' as const),
                    Match.orElse(() => 'stable' as const)
                  )
                ),
                Match.exhaustive
              ),
              memoryTrend: pipe(
                memoryChange > threshold,
                Match.value,
                Match.when(true, () => 'degrading' as const), // メモリ使用量増加は悪化
                Match.when(false, () =>
                  pipe(
                    memoryChange < -threshold,
                    Match.value,
                    Match.when(true, () => 'improving' as const),
                    Match.orElse(() => 'stable' as const)
                  )
                ),
                Match.exhaustive
              ),
              loadTimeTrend: pipe(
                loadTimeChange > threshold,
                Match.value,
                Match.when(true, () => 'degrading' as const), // ロード時間増加は悪化
                Match.when(false, () =>
                  pipe(
                    loadTimeChange < -threshold,
                    Match.value,
                    Match.when(true, () => 'improving' as const),
                    Match.orElse(() => 'stable' as const)
                  )
                ),
                Match.exhaustive
              ),
            }
          },
        })
      )
    })
  )
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
  const { minViewDistance, maxViewDistance, targetFrameRate, maxMemoryUsageMB } = config

  // パフォーマンス問題の判定
  const lowFrameRate = metrics.frameRate < targetFrameRate * 0.9 // 90%未満
  const highMemoryUsage = metrics.memoryUsageMB > maxMemoryUsageMB * 0.8 // 80%超過
  const highLoadTime = metrics.averageChunkLoadTimeMs > 200 // 200ms超過
  const goodPerformance =
    metrics.frameRate > targetFrameRate * 1.1 && // 110%以上
    metrics.memoryUsageMB < maxMemoryUsageMB * 0.6 && // 60%未満
    metrics.averageChunkLoadTimeMs < 100 // 100ms未満

  return pipe(
    lowFrameRate,
    Match.value,
    Match.when(true, () => {
      // フレームレート低下 → 描画距離を減らす
      const reductionFactor = Math.max(0.7, metrics.frameRate / targetFrameRate)
      const suggestedDistance = Math.max(minViewDistance, Math.floor(currentDistance * reductionFactor))
      return {
        suggestedDistance,
        reason: 'performance_low' as ViewDistanceAdjustmentReason,
        confidence: 0.8,
      }
    }),
    Match.when(false, () =>
      pipe(
        highMemoryUsage,
        Match.value,
        Match.when(true, () => {
          // メモリ使用量過多 → 描画距離を減らす
          const memoryRatio = metrics.memoryUsageMB / maxMemoryUsageMB
          const reductionFactor = Math.max(0.6, 1.0 - (memoryRatio - 0.8) * 2) // 80%超過時に段階的に減少
          const suggestedDistance = Math.max(minViewDistance, Math.floor(currentDistance * reductionFactor))
          return {
            suggestedDistance,
            reason: 'memory_high' as ViewDistanceAdjustmentReason,
            confidence: 0.9,
          }
        }),
        Match.when(false, () =>
          pipe(
            highLoadTime,
            Match.value,
            Match.when(true, () => {
              // ロード時間過長 → 描画距離を減らす
              const suggestedDistance = Math.max(minViewDistance, currentDistance - 2)
              return {
                suggestedDistance,
                reason: 'load_time_high' as ViewDistanceAdjustmentReason,
                confidence: 0.7,
              }
            }),
            Match.when(false, () =>
              pipe(
                goodPerformance,
                Match.value,
                Match.when(true, () => {
                  // 余裕がある → 描画距離を増やす
                  const suggestedDistance = Math.min(maxViewDistance, currentDistance + 1)
                  return {
                    suggestedDistance,
                    reason: 'performance_good' as ViewDistanceAdjustmentReason,
                    confidence: 0.6,
                  }
                }),
                Match.orElse(() => ({
                  suggestedDistance: currentDistance,
                  reason: 'manual' as ViewDistanceAdjustmentReason,
                  confidence: 0.5,
                }))
              )
            ),
            Match.exhaustive
          )
        ),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )
}

export const getVisibleChunkPositions = (centerPosition: Vector3, viewDistance: number): ChunkPosition[] => {
  const centerChunk = {
    x: Math.floor(centerPosition.x / 16),
    z: Math.floor(centerPosition.z / 16),
  }

  const positions: ChunkPosition[] = []

  for (let x = centerChunk.x - viewDistance; x <= centerChunk.x + viewDistance; x++) {
    for (let z = centerChunk.z - viewDistance; z <= centerChunk.z + viewDistance; z++) {
      const distance = Math.max(Math.abs(x - centerChunk.x), Math.abs(z - centerChunk.z))
      pipe(
        distance,
        Match.value,
        Match.when(
          (d) => d <= viewDistance,
          () => positions.push({ x, z })
        ),
        Match.orElse(() => undefined)
      )
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

  const distance = Math.max(Math.abs(chunkPosition.x - playerChunk.x), Math.abs(chunkPosition.z - playerChunk.z))

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
  readonly setViewDistance: (distance: number, reason: ViewDistanceAdjustmentReason) => Effect.Effect<void, never>

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
  readonly getPerformanceStats: () => Effect.Effect<
    {
      currentMetrics: PerformanceMetrics | null
      averageMetrics: PerformanceMetrics | null
      adjustmentHistory: ViewDistanceEvent[]
    },
    never
  >

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
    const currentTime = yield* Clock.currentTimeMillis
    const state = yield* Ref.make<ViewDistanceState>({
      currentViewDistance: config.defaultViewDistance,
      targetViewDistance: config.defaultViewDistance,
      metricsHistory: [],
      adjustmentHistory: [],
      config,
      lastAdjustmentTime: currentTime,
    })

    const getCurrentViewDistance = (): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        return currentState.currentViewDistance
      })

    const setViewDistance = (distance: number, reason: ViewDistanceAdjustmentReason): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const clampedDistance = Math.max(
          currentState.config.minViewDistance,
          Math.min(currentState.config.maxViewDistance, distance)
        )

        yield* pipe(
          clampedDistance === currentState.currentViewDistance,
          Match.value,
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Effect.gen(function* () {
              const latestMetrics = pipe(
                currentState.metricsHistory.length > 0,
                Option.liftPredicate(Boolean),
                Option.match({
                  onNone: () => undefined,
                  onSome: () => currentState.metricsHistory[currentState.metricsHistory.length - 1],
                })
              )

              const currentTime = yield* Clock.currentTimeMillis
              const event: ViewDistanceEvent = {
                timestamp: currentTime,
                oldDistance: currentState.currentViewDistance,
                newDistance: clampedDistance,
                reason,
                metrics: latestMetrics,
              }

              yield* Ref.update(state, (currentState) => ({
                ...currentState,
                currentViewDistance: clampedDistance,
                targetViewDistance: clampedDistance,
                adjustmentHistory: [
                  ...currentState.adjustmentHistory.slice(-(currentState.config.metricsHistorySize - 1)),
                  event,
                ],
                lastAdjustmentTime: currentTime,
              }))

              return event
            })
          )
        )
      })

    const updateMetrics = (metrics: PerformanceMetrics): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(state, (currentState) => ({
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

        // 早期リターンの条件チェック
        const result = yield* pipe(
          currentState.config.adaptiveEnabled,
          Match.value,
          Match.when(false, () => Effect.succeed(null)),
          Match.orElse(() =>
            pipe(
              currentState.metricsHistory.length < 10,
              Match.value,
              Match.when(true, () => Effect.succeed(null)),
              Match.orElse(() =>
                Effect.gen(function* () {
                  const currentTime = yield* Clock.currentTimeMillis
                  const timeSinceLastAdjustment = currentTime - currentState.lastAdjustmentTime

                  return yield* pipe(
                    timeSinceLastAdjustment < 5000,
                    Match.value,
                    Match.when(true, () => Effect.succeed(null)), // 5秒間隔
                    Match.orElse(() =>
                      pipe(
                        Option.fromNullable(currentState.metricsHistory[currentState.metricsHistory.length - 1]),
                        Option.match({
                          onNone: () => Effect.succeed(null),
                          onSome: (latestMetrics) =>
                            Effect.gen(function* () {
                              const optimization = calculateOptimalViewDistance(
                                currentState.currentViewDistance,
                                latestMetrics,
                                currentState.config
                              )

                              // 変更が必要でない場合
                              return yield* pipe(
                                optimization.suggestedDistance === currentState.currentViewDistance,
                                Match.value,
                                Match.when(true, () => Effect.succeed(null)),
                                Match.orElse(() =>
                                  pipe(
                                    optimization.confidence < 0.6,
                                    Match.value,
                                    Match.when(true, () => Effect.succeed(null)),
                                    Match.orElse(() =>
                                      Effect.gen(function* () {
                                        yield* setViewDistance(optimization.suggestedDistance, optimization.reason)

                                        // 調整後の状態を取得してイベントを返す
                                        const updatedState = yield* Ref.get(state)
                                        return (
                                          updatedState.adjustmentHistory[updatedState.adjustmentHistory.length - 1] ??
                                          null
                                        )
                                      })
                                    )
                                  )
                                )
                              )
                            }),
                        })
                      )
                    )
                  )
                })
              )
            )
          )
        )

        return result
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

        return positions
          .map((position) => ({
            position,
            priority: calculateChunkPriority(position, centerPosition, currentState.currentViewDistance),
          }))
          .sort((a, b) => b.priority - a.priority)
      })

    const getPerformanceStats = (): Effect.Effect<
      {
        currentMetrics: PerformanceMetrics | null
        averageMetrics: PerformanceMetrics | null
        adjustmentHistory: ViewDistanceEvent[]
      },
      never
    > =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)

        // undefinedを明示的にnullに変換
        const currentMetrics: PerformanceMetrics | null = pipe(
          currentState.metricsHistory.length > 0,
          Option.liftPredicate(Boolean),
          Option.match({
            onNone: () => null,
            onSome: () => currentState.metricsHistory[currentState.metricsHistory.length - 1] ?? null,
          })
        )

        const averageMetrics = calculateAverageMetrics(currentState.metricsHistory)

        return {
          currentMetrics,
          averageMetrics,
          adjustmentHistory: currentState.adjustmentHistory,
        }
      })

    const updateConfig = (newConfig: Partial<ViewDistanceConfig>): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(state, (currentState) => ({
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
): Layer.Layer<ViewDistance, never, never> => Layer.effect(ViewDistance, createViewDistance(config))
