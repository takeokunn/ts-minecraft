import type { ErrorCause } from '@shared/schema/error'
import { Clock, Context, Effect, Layer, Match, pipe, Ref, Schedule } from 'effect'

/**
 * Physics Performance Service
 * 物理演算のパフォーマンス最適化とモニタリング
 * - フレームレート維持 (60 FPS目標)
 * - 適応的品質調整
 * - パフォーマンスメトリクス収集
 * - 最適化推奨の提供
 */

// パフォーマンスメトリクス
export interface PhysicsPerformanceMetrics {
  readonly frameTime: number // フレーム時間 (ms)
  readonly physicsTime: number // 物理計算時間 (ms)
  readonly collisionChecks: number // 衝突判定回数
  readonly activeObjects: number // アクティブオブジェクト数
  readonly memoryUsage: number // メモリ使用量 (MB)
  readonly fps: number // フレームレート
  readonly timestamp: number
}

// パフォーマンス設定レベル
export type PerformanceLevel = 'Ultra' | 'High' | 'Medium' | 'Low' | 'Minimum'

// 最適化設定
export interface OptimizationSettings {
  readonly targetFPS: number
  readonly maxPhysicsTime: number // 物理計算の最大時間 (ms)
  readonly collisionBatchSize: number // 衝突判定のバッチサイズ
  readonly cullingDistance: number // カリング距離
  readonly updateFrequency: number // 更新頻度 (Hz)
  readonly enableSpatialHashing: boolean // 空間ハッシュの使用
  readonly enableLOD: boolean // Level of Detail の使用
}

// パフォーマンスレベル別設定
export const PERFORMANCE_SETTINGS: ReadonlyMap<PerformanceLevel, OptimizationSettings> = new Map([
  [
    'Ultra',
    {
      targetFPS: 60,
      maxPhysicsTime: 12.0, // 16ms中の75%
      collisionBatchSize: 100,
      cullingDistance: 64.0,
      updateFrequency: 60,
      enableSpatialHashing: true,
      enableLOD: true,
    },
  ],
  [
    'High',
    {
      targetFPS: 60,
      maxPhysicsTime: 10.0,
      collisionBatchSize: 80,
      cullingDistance: 48.0,
      updateFrequency: 60,
      enableSpatialHashing: true,
      enableLOD: true,
    },
  ],
  [
    'Medium',
    {
      targetFPS: 45,
      maxPhysicsTime: 15.0,
      collisionBatchSize: 60,
      cullingDistance: 32.0,
      updateFrequency: 45,
      enableSpatialHashing: true,
      enableLOD: true,
    },
  ],
  [
    'Low',
    {
      targetFPS: 30,
      maxPhysicsTime: 20.0,
      collisionBatchSize: 40,
      cullingDistance: 24.0,
      updateFrequency: 30,
      enableSpatialHashing: false,
      enableLOD: true,
    },
  ],
  [
    'Minimum',
    {
      targetFPS: 20,
      maxPhysicsTime: 30.0,
      collisionBatchSize: 20,
      cullingDistance: 16.0,
      updateFrequency: 20,
      enableSpatialHashing: false,
      enableLOD: false,
    },
  ],
])

// パフォーマンス状態
export interface PerformanceState {
  readonly currentLevel: PerformanceLevel
  readonly settings: OptimizationSettings
  readonly metrics: PhysicsPerformanceMetrics[]
  readonly averageMetrics: PhysicsPerformanceMetrics
  readonly adaptiveMode: boolean
  readonly lastOptimization: number
}

// パフォーマンスエラー
export interface PhysicsPerformanceError {
  readonly _tag: 'PhysicsPerformanceError'
  readonly message: string
  readonly reason: 'MetricsError' | 'OptimizationError' | 'ConfigurationError'
  readonly cause?: ErrorCause
}

// Physics Performance Service インターフェース
export interface PhysicsPerformanceService {
  /**
   * パフォーマンス監視の初期化
   */
  readonly initializePerformanceMonitoring: (
    initialLevel?: PerformanceLevel
  ) => Effect.Effect<void, PhysicsPerformanceError>

  /**
   * フレームメトリクスの記録
   */
  readonly recordFrameMetrics: (
    frameTime: number,
    physicsTime: number,
    collisionChecks: number,
    activeObjects: number
  ) => Effect.Effect<void, PhysicsPerformanceError>

  /**
   * 現在のパフォーマンス状態取得
   */
  readonly getPerformanceState: () => Effect.Effect<PerformanceState, PhysicsPerformanceError>

  /**
   * パフォーマンスレベルの手動設定
   */
  readonly setPerformanceLevel: (level: PerformanceLevel) => Effect.Effect<void, PhysicsPerformanceError>

  /**
   * 適応的品質調整の有効/無効
   */
  readonly setAdaptiveMode: (enabled: boolean) => Effect.Effect<void, PhysicsPerformanceError>

  /**
   * パフォーマンス分析と最適化推奨
   */
  readonly analyzeAndOptimize: () => Effect.Effect<
    { optimizationApplied: boolean; recommendations: string[] },
    PhysicsPerformanceError
  >

  /**
   * メモリ使用量の監視
   */
  readonly monitorMemoryUsage: () => Effect.Effect<number, PhysicsPerformanceError>

  /**
   * パフォーマンス統計のリセット
   */
  readonly resetStatistics: () => Effect.Effect<void, PhysicsPerformanceError>

  /**
   * 最適化設定の取得
   */
  readonly getCurrentSettings: () => Effect.Effect<OptimizationSettings, PhysicsPerformanceError>

  /**
   * 現在時刻の取得 (performance.now() equivalent)
   */
  readonly now: () => number
}

// Context Tag定義
export const PhysicsPerformanceService = Context.GenericTag<PhysicsPerformanceService>(
  '@minecraft/PhysicsPerformanceService'
)

// Physics Performance Service実装
const makePhysicsPerformanceService: Effect.Effect<PhysicsPerformanceService> = Effect.gen(function* () {
  // パフォーマンス状態管理
  const now = yield* Clock.currentTimeMillis
  const performanceStateRef = yield* Ref.make<PerformanceState>({
    currentLevel: 'High',
    settings: PERFORMANCE_SETTINGS.get('High')!,
    metrics: [],
    averageMetrics: {
      frameTime: 0,
      physicsTime: 0,
      collisionChecks: 0,
      activeObjects: 0,
      memoryUsage: 0,
      fps: 0,
      timestamp: now,
    },
    adaptiveMode: true,
    lastOptimization: now,
  })

  // メトリクス履歴の最大サイズ
  const MAX_METRICS_HISTORY = 60 // 1秒間 (60FPS)

  // パフォーマンス監視の初期化
  const initializePerformanceMonitoring = (initialLevel: PerformanceLevel = 'High') =>
    Effect.gen(function* () {
      const settingsOption = PERFORMANCE_SETTINGS.get(initialLevel)
      const settings = yield* Effect.filterOrFail(
        Effect.succeed(settingsOption),
        (s): s is OptimizationSettings => s !== undefined,
        () =>
          ({
            _tag: 'PhysicsPerformanceError',
            message: `Invalid performance level: ${initialLevel}`,
            reason: 'ConfigurationError',
          }) as PhysicsPerformanceError
      )

      const now = yield* Clock.currentTimeMillis
      yield* Ref.update(performanceStateRef, (state) => ({
        ...state,
        currentLevel: initialLevel,
        settings,
        lastOptimization: now,
      }))

      yield* Effect.logInfo('Physics performance monitoring initialized').pipe(
        Effect.annotateLogs({ level: initialLevel })
      )
    })

  // フレームメトリクスの記録
  const recordFrameMetrics = (frameTime: number, physicsTime: number, collisionChecks: number, activeObjects: number) =>
    Effect.gen(function* () {
      const currentTime = yield* Clock.currentTimeMillis

      // メモリ使用量を推定 (実際のメモリ使用量は環境によって異なる)
      const estimatedMemoryUsage = (activeObjects * 0.5 + collisionChecks * 0.01) / 1024 // MB

      const newMetric: PhysicsPerformanceMetrics = {
        frameTime,
        physicsTime,
        collisionChecks,
        activeObjects,
        memoryUsage: estimatedMemoryUsage,
        fps: frameTime > 0 ? 1000 / frameTime : 0,
        timestamp: currentTime,
      }

      const currentState = yield* Ref.get(performanceStateRef)
      const newMetrics = [...currentState.metrics, newMetric].slice(-MAX_METRICS_HISTORY)

      // 平均メトリクスを計算
      const averageMetrics = yield* pipe(
        Match.value(newMetrics.length > 0),
        Match.when(false, () => Effect.succeed(currentState.averageMetrics)),
        Match.orElse(() =>
          Effect.gen(function* () {
            const sum = newMetrics.reduce(
              (acc, metric) => ({
                frameTime: acc.frameTime + metric.frameTime,
                physicsTime: acc.physicsTime + metric.physicsTime,
                collisionChecks: acc.collisionChecks + metric.collisionChecks,
                activeObjects: acc.activeObjects + metric.activeObjects,
                memoryUsage: acc.memoryUsage + metric.memoryUsage,
                fps: acc.fps + metric.fps,
              }),
              { frameTime: 0, physicsTime: 0, collisionChecks: 0, activeObjects: 0, memoryUsage: 0, fps: 0 }
            )

            const count = newMetrics.length
            return {
              frameTime: sum.frameTime / count,
              physicsTime: sum.physicsTime / count,
              collisionChecks: sum.collisionChecks / count,
              activeObjects: sum.activeObjects / count,
              memoryUsage: sum.memoryUsage / count,
              fps: sum.fps / count,
              timestamp: currentTime,
            }
          })
        )
      )

      yield* Ref.set(performanceStateRef, {
        ...currentState,
        metrics: newMetrics,
        averageMetrics,
      })
    })

  // 現在のパフォーマンス状態取得
  const getPerformanceState = () =>
    Effect.gen(function* () {
      return yield* Ref.get(performanceStateRef)
    })

  // パフォーマンスレベルの手動設定
  const setPerformanceLevel = (level: PerformanceLevel) =>
    Effect.gen(function* () {
      const settingsOption = PERFORMANCE_SETTINGS.get(level)
      const settings = yield* Effect.filterOrFail(
        Effect.succeed(settingsOption),
        (s): s is OptimizationSettings => s !== undefined,
        () =>
          ({
            _tag: 'PhysicsPerformanceError',
            message: `Invalid performance level: ${level}`,
            reason: 'ConfigurationError',
          }) as PhysicsPerformanceError
      )

      const now = yield* Clock.currentTimeMillis
      yield* Ref.update(performanceStateRef, (state) => ({
        ...state,
        currentLevel: level,
        settings,
        adaptiveMode: false, // 手動設定時は適応モードを無効化
        lastOptimization: now,
      }))

      yield* Effect.logInfo('Performance level manually set').pipe(Effect.annotateLogs({ level }))
    })

  // 適応的品質調整の有効/無効
  const setAdaptiveMode = (enabled: boolean) =>
    Effect.gen(function* () {
      yield* Ref.update(performanceStateRef, (state) => ({
        ...state,
        adaptiveMode: enabled,
      }))

      yield* Effect.logInfo('Adaptive performance mode').pipe(Effect.annotateLogs({ enabled }))
    })

  // パフォーマンス分析と最適化推奨
  const analyzeAndOptimize = () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(performanceStateRef)
      const recommendations: string[] = []
      let optimizationApplied = false

      // 適応モードでない場合は推奨のみ
      const earlyReturn = yield* pipe(
        Match.value(state.adaptiveMode),
        Match.when(false, () =>
          Effect.succeed(
            Option.some({ optimizationApplied: false, recommendations: ['Adaptive mode is disabled'] })
          )
        ),
        Match.orElse(() => Effect.succeed(Option.none<{ optimizationApplied: boolean; recommendations: string[] }>()))
      )

      yield* pipe(
        earlyReturn,
        Option.match({
          onNone: () => Effect.unit,
          onSome: (value) => Effect.fail(value),
        }),
        Effect.catchTag('Fail', (value) => Effect.succeed(value))
      ).pipe(Effect.flatMap((value) => Effect.fail(value)))

      // 過去1秒間の平均パフォーマンスを分析
      const avgMetrics = state.averageMetrics
      const targetFPS = state.settings.targetFPS

      const analysis = yield* pipe(
        Match.value({
          lowFPS: avgMetrics.fps < targetFPS * 0.8, // 目標の80%未満
          highPhysicsTime: avgMetrics.physicsTime > state.settings.maxPhysicsTime,
          highMemoryUsage: avgMetrics.memoryUsage > 512, // 512MB以上
          manyCollisionChecks: avgMetrics.collisionChecks > state.settings.collisionBatchSize * 2,
        }),
        Match.when(
          ({ lowFPS, highPhysicsTime }) => lowFPS && highPhysicsTime,
          () =>
            Effect.gen(function* () {
              // パフォーマンスが悪い：レベルを下げる
              const currentLevels: PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Low', 'Minimum']
              const currentIndex = currentLevels.indexOf(state.currentLevel)

              return yield* Match.value(currentIndex)
                .pipe(
                  Match.when(
                    (index) => index < currentLevels.length - 1,
                    (index) =>
                      Effect.gen(function* () {
                        const newLevel = currentLevels[index + 1]!
                        yield* setPerformanceLevel(newLevel)
                        recommendations.push(
                          `Performance downgraded to ${newLevel} due to low FPS (${avgMetrics.fps.toFixed(1)})`
                        )
                        return { applied: true }
                      })
                  ),
                  Match.orElse(() =>
                    Effect.sync(() => {
                      recommendations.push('Already at minimum performance level')
                      return { applied: false }
                    })
                  )
                )
            })
        ),
        Match.when(
          ({ lowFPS }) => !lowFPS && avgMetrics.fps > targetFPS * 1.1,
          () =>
            Effect.gen(function* () {
              // パフォーマンスが良好：レベルを上げることを検討
              const currentLevels: PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Low', 'Minimum']
              const currentIndex = currentLevels.indexOf(state.currentLevel)
              const now = yield* Clock.currentTimeMillis
              const timeSinceLastOptimization = now - state.lastOptimization

              return yield* Match.value({ currentIndex, timeSinceLastOptimization }).pipe(
                Match.when(
                  ({ currentIndex, timeSinceLastOptimization }) =>
                    currentIndex > 0 && timeSinceLastOptimization > 5000,
                  ({ currentIndex }) =>
                    Effect.gen(function* () {
                      const newLevel = currentLevels[currentIndex - 1]!
                      yield* setPerformanceLevel(newLevel)
                      recommendations.push(`Performance upgraded to ${newLevel} - stable high FPS detected`)
                      return { applied: true }
                    })
                ),
                Match.orElse(() =>
                  Effect.sync(() => {
                    recommendations.push('Performance is stable - no changes needed')
                    return { applied: false }
                  })
                )
              )
            })
        ),
        Match.when(
          ({ manyCollisionChecks }) => manyCollisionChecks,
          () =>
            Effect.gen(function* () {
              recommendations.push(
                `High collision check count (${avgMetrics.collisionChecks.toFixed(0)}) - consider reducing collision batch size`
              )
              return { applied: false }
            })
        ),
        Match.when(
          ({ highMemoryUsage }) => highMemoryUsage,
          () =>
            Effect.gen(function* () {
              recommendations.push(
                `High memory usage (${avgMetrics.memoryUsage.toFixed(1)}MB) - consider reducing object count`
              )
              return { applied: false }
            })
        ),
        Match.orElse(() =>
          Effect.gen(function* () {
            recommendations.push('Performance is within acceptable ranges')
            return { applied: false }
          })
        )
      )

      optimizationApplied = analysis.applied

      // 追加の最適化推奨
      yield* Effect.when(avgMetrics.physicsTime > avgMetrics.frameTime * 0.5, () =>
        Effect.sync(() => {
          recommendations.push('Physics computation takes >50% of frame time - consider physics optimization')
        })
      )

      yield* Effect.when(avgMetrics.activeObjects > 1000, () =>
        Effect.sync(() => {
          recommendations.push('High active object count - consider LOD or culling optimizations')
        })
      )

      return { optimizationApplied, recommendations }
    })

  // メモリ使用量の監視
  const monitorMemoryUsage = () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(performanceStateRef)
      return state.averageMetrics.memoryUsage
    })

  // パフォーマンス統計のリセット
  const resetStatistics = () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      yield* Ref.update(performanceStateRef, (state) => ({
        ...state,
        metrics: [],
        averageMetrics: {
          frameTime: 0,
          physicsTime: 0,
          collisionChecks: 0,
          activeObjects: 0,
          memoryUsage: 0,
          fps: 0,
          timestamp: now,
        },
        lastOptimization: now,
      }))

      yield* Effect.logInfo('Performance statistics reset')
    })

  // 最適化設定の取得
  const getCurrentSettings = () =>
    Effect.gen(function* () {
      const state = yield* Ref.get(performanceStateRef)
      return state.settings
    })

  // 現在時刻の取得
  const getNow = () => performance.now()

  const service: PhysicsPerformanceService = {
    initializePerformanceMonitoring,
    recordFrameMetrics,
    getPerformanceState,
    setPerformanceLevel,
    setAdaptiveMode,
    analyzeAndOptimize,
    monitorMemoryUsage,
    resetStatistics,
    getCurrentSettings,
    now,
  }

  return service
})

// Live Layer実装
export const PhysicsPerformanceServiceLive = Layer.scoped(PhysicsPerformanceService, makePhysicsPerformanceService)

// パフォーマンス自動監視エフェクト（オプション）
export const startPerformanceMonitoring = (intervalMs: number = 1000) =>
  Effect.gen(function* () {
    const performanceService = yield* PhysicsPerformanceService

    // 定期的なパフォーマンス分析
    const monitoringEffect = Effect.gen(function* () {
      const result = yield* performanceService.analyzeAndOptimize()
      yield* Effect.when(result.optimizationApplied, () =>
        Effect.logInfo('Automatic performance optimization applied').pipe(
          Effect.annotateLogs({ recommendations: JSON.stringify(result.recommendations) })
        )
      )
    })

    // 指定間隔での実行をスケジュール
    return yield* pipe(
      monitoringEffect,
      Effect.repeat(Schedule.spaced(`${intervalMs} millis`)),
      Effect.catchAll((error) =>
        Effect.logWarning('Performance monitoring error').pipe(
          Effect.annotateLogs({ error: String(error) }),
          Effect.zipRight(Effect.succeed(undefined))
        )
      ),
      Effect.forkScoped // バックグラウンドで実行
    )
  })
