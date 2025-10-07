/**
 * Progressive Loading Application Service
 *
 * プレイヤーの位置と移動予測に基づいた段階的読み込みシステム。
 * パフォーマンス監視、メモリ管理、適応的品質調整を統合して提供します。
 */

// === Loading Scheduler ===
export {
  DEFAULT_SCHEDULER_CONFIG,
  LoadingBatch,
  LoadingQueueState,
  LoadingRequest,
  LoadingSchedulerError,
  LoadingSchedulerService,
  LoadingSchedulerServiceLive,
  MovementVector,
  PlayerMovementState,
  SchedulerConfiguration,
} from './adaptive_quality'

export type {
  LoadingBatchType,
  LoadingQueueStateType,
  LoadingRequestType,
  LoadingSchedulerErrorType,
  MovementVectorType,
  PlayerMovementStateType,
  SchedulerConfigurationType,
} from './adaptive_quality'

// === Priority Calculator ===
export {
  DEFAULT_PRIORITY_CONFIG,
  MLModelPrediction,
  PriorityCalculationResult,
  PriorityCalculatorError,
  PriorityCalculatorService,
  PriorityCalculatorServiceLive,
  PriorityConfiguration,
  PriorityContext,
  PriorityFactor,
} from './adaptive_quality'

export type {
  MLModelPredictionType,
  PriorityCalculationResultType,
  PriorityCalculatorErrorType,
  PriorityConfigurationType,
  PriorityContextType,
  PriorityFactorType,
} from './adaptive_quality'

// === Memory Monitor ===
export {
  AllocationRequest,
  DEFAULT_MEMORY_CONFIG,
  MemoryAlert,
  MemoryConfiguration,
  MemoryMetrics,
  MemoryMonitorError,
  MemoryMonitorService,
  MemoryMonitorServiceLive,
  MemoryPool,
  MemoryStatistics,
} from './adaptive_quality'

export type {
  AllocationRequestType,
  MemoryAlertType,
  MemoryConfigurationType,
  MemoryMetricsType,
  MemoryMonitorErrorType,
  MemoryPoolType,
  MemoryStatisticsType,
} from './adaptive_quality'

// === Adaptive Quality ===
export {
  AdaptationConfiguration,
  AdaptiveQualityError,
  AdaptiveQualityService,
  AdaptiveQualityServiceLive,
  DEFAULT_ADAPTATION_CONFIG,
  DEFAULT_QUALITY_PROFILES,
  PerformanceSnapshot,
  PerformanceTrend,
  QualityAdjustment,
  QualityProfile,
} from './adaptive_quality'

export type {
  AdaptationConfigurationType,
  AdaptiveQualityErrorType,
  PerformanceSnapshotType,
  PerformanceTrendType,
  QualityAdjustmentType,
  QualityProfileType,
} from './adaptive_quality'

// === Integrated Progressive Loading Service ===

import { Clock, Context, Effect, Option, pipe, ReadonlyArray, Schema } from 'effect'
import {
  AdaptiveQualityService,
  LoadingSchedulerService,
  MemoryMonitorService,
  PriorityCalculatorService,
} from './service'

/**
 * Progressive Loading Application Service
 *
 * 段階的読み込みの統合サービスインターフェース
 */

export const ProgressiveLoadingError = Schema.TaggedError<ProgressiveLoadingErrorType>()('ProgressiveLoadingError', {
  message: Schema.String,
  serviceId: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export interface ProgressiveLoadingErrorType extends Schema.Schema.Type<typeof ProgressiveLoadingError> {}

export interface ProgressiveLoadingService {
  /**
   * 統合システムを初期化します
   */
  readonly initialize: () => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * システムを開始します
   */
  readonly start: () => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * システムを停止します
   */
  readonly stop: () => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * プレイヤーの位置・移動情報を更新します
   */
  readonly updatePlayerState: (
    playerId: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; z: number },
    viewDistance: number
  ) => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * パフォーマンス情報を更新します
   */
  readonly updatePerformanceMetrics: (
    fps: number,
    memoryUsage: number,
    cpuUsage: number
  ) => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * 統合システム状態を取得します
   */
  readonly getSystemStatus: () => Effect.Effect<
    {
      scheduler: {
        pendingRequests: number
        inProgressRequests: number
        totalProcessed: number
      }
      memory: {
        usagePercentage: number
        pressureLevel: string
        totalAllocations: number
      }
      quality: {
        currentLevel: string
        lastAdjustment: string
        adaptationActive: boolean
      }
      overall: {
        healthy: boolean
        warnings: string[]
        errors: string[]
      }
    },
    ProgressiveLoadingErrorType
  >

  /**
   * 優先度付きでチャンク読み込みをリクエストします
   */
  readonly requestChunkLoad: (
    chunkX: number,
    chunkZ: number,
    playerId: string,
    priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
  ) => Effect.Effect<string, ProgressiveLoadingErrorType> // リクエストID

  /**
   * 読み込み完了を報告します
   */
  readonly reportLoadComplete: (
    requestId: string,
    success: boolean,
    loadTimeMs: number
  ) => Effect.Effect<void, ProgressiveLoadingErrorType>

  /**
   * システム設定を更新します
   */
  readonly updateSettings: (settings: {
    maxConcurrentLoads?: number
    adaptiveQuality?: boolean
    memoryManagement?: 'conservative' | 'balanced' | 'aggressive'
    qualityStrategy?: 'performance_first' | 'quality_first' | 'balanced'
  }) => Effect.Effect<void, ProgressiveLoadingErrorType>
}

// === Live Implementation ===

export const makeProgressiveLoadingService = Effect.gen(function* () {
  const scheduler = yield* LoadingSchedulerService
  const priorityCalculator = yield* PriorityCalculatorService
  const memoryMonitor = yield* MemoryMonitorService
  const adaptiveQuality = yield* AdaptiveQualityService

  const initialize = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム初期化開始')

      // 各サービスの初期化
      // スケジューラは初期化不要（状態管理はリアクティブ）
      // 優先度計算器は初期化不要
      // メモリモニタとアダプティブ品質は初期化

      yield* Effect.logInfo('Progressive Loading システム初期化完了')
    })

  const start = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム開始')

      // 各サービスを開始
      yield* memoryMonitor.startMonitoring()
      yield* adaptiveQuality.startAdaptation()

      yield* Effect.logInfo('Progressive Loading システム開始完了')
    })

  const stop = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム停止')

      // 各サービスを停止
      yield* memoryMonitor.stopMonitoring()
      yield* adaptiveQuality.stopAdaptation()

      yield* Effect.logInfo('Progressive Loading システム停止完了')
    })

  const updatePlayerState = (
    playerId: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; z: number },
    viewDistance: number
  ) =>
    Effect.gen(function* () {
      const movementState = {
        _tag: 'PlayerMovementState' as const,
        playerId,
        currentPosition: position,
        movementVector: {
          _tag: 'MovementVector' as const,
          velocity,
          acceleration: { x: 0, z: 0 }, // 簡略化
          direction: (Math.atan2(velocity.z, velocity.x) * 180) / Math.PI,
          confidence: velocity.x !== 0 || velocity.z !== 0 ? 0.8 : 0.5,
        },
        viewDistance,
        lastUpdate: yield* Clock.currentTimeMillis,
        history: [], // 簡略化
      }

      yield* scheduler.updatePlayerMovement(movementState)
      yield* Effect.logDebug(`プレイヤー状態更新: ${playerId}`)
    })

  const updatePerformanceMetrics = (fps: number, memoryUsage: number, cpuUsage: number) =>
    Effect.gen(function* () {
      const snapshot = {
        _tag: 'PerformanceSnapshot' as const,
        timestamp: yield* Clock.currentTimeMillis,
        fps,
        frameTime: 1000 / fps,
        cpuUsage,
        gpuUsage: 0.5, // プレースホルダー
        memoryUsage,
        networkLatency: 50, // プレースホルダー
        diskIOLoad: 0.3, // プレースホルダー
        thermalState: 'normal' as const,
      }

      yield* adaptiveQuality.recordPerformance(snapshot)
      yield* Effect.logDebug(`パフォーマンス更新: FPS=${fps}, CPU=${(cpuUsage * 100).toFixed(1)}%`)
    })

  const getSystemStatus = () =>
    Effect.gen(function* () {
      const queueState = yield* scheduler.getQueueState()
      const memoryMetrics = yield* memoryMonitor.getCurrentMetrics()
      const memoryPressure = yield* memoryMonitor.getPressureLevel()
      const currentProfile = yield* adaptiveQuality.getCurrentProfile()

      const status = {
        scheduler: {
          pendingRequests: queueState.pending.length,
          inProgressRequests: queueState.inProgress.length,
          totalProcessed: queueState.totalProcessed,
        },
        memory: {
          usagePercentage: (memoryMetrics.usedMemory / memoryMetrics.totalMemory) * 100,
          pressureLevel: memoryPressure,
          totalAllocations: 0, // 実装に応じて取得
        },
        quality: {
          currentLevel: currentProfile.overallLevel,
          lastAdjustment: 'なし', // 調整履歴から取得
          adaptationActive: true, // 実際の状態を確認
        },
        overall: {
          healthy: memoryPressure !== 'critical' && queueState.failed.length < 5,
          warnings: [],
          errors: queueState.failed.map((f) => f.error),
        },
      }

      return status
    })

  const requestChunkLoad = (
    chunkX: number,
    chunkZ: number,
    playerId: string,
    priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
  ) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const requestId = `chunk_${chunkX}_${chunkZ}_${now}`

      const loadRequest = {
        _tag: 'LoadingRequest' as const,
        id: requestId,
        chunkPosition: { x: chunkX, z: chunkZ },
        priority,
        distance: 0, // プレイヤー位置から計算
        estimatedSize: 1024, // 1KB推定
        requester: playerId,
        timestamp: now,
        dependencies: [],
        metadata: {},
      }

      yield* scheduler.scheduleLoad(loadRequest)
      yield* Effect.logInfo(`チャンク読み込みリクエスト: (${chunkX}, ${chunkZ}) 優先度: ${priority}`)

      return requestId
    })

  const reportLoadComplete = (requestId: string, success: boolean, loadTimeMs: number) =>
    Effect.gen(function* () {
      const metrics = { loadTime: loadTimeMs }
      yield* scheduler.reportCompletion(requestId, success, metrics)
      yield* Effect.logInfo(`読み込み完了報告: ${requestId} (${success ? '成功' : '失敗'}, ${loadTimeMs}ms)`)
    })

  const updateSettings = (settings: {
    maxConcurrentLoads?: number
    adaptiveQuality?: boolean
    memoryManagement?: 'conservative' | 'balanced' | 'aggressive'
    qualityStrategy?: 'performance_first' | 'quality_first' | 'balanced'
  }) =>
    Effect.gen(function* () {
      yield* pipe(
        Option.fromNullable(settings.maxConcurrentLoads),
        Option.match({
          onNone: () => Effect.void,
          onSome: (maxConcurrentLoads) =>
            scheduler.updateConfiguration({
              maxConcurrentLoads,
            }),
        })
      )

      yield* pipe(
        Option.fromNullable(settings.memoryManagement),
        Option.match({
          onNone: () => Effect.void,
          onSome: (strategy) =>
            memoryMonitor.updateConfiguration({
              strategy,
            }),
        })
      )

      yield* pipe(
        Option.fromNullable(settings.qualityStrategy),
        Option.match({
          onNone: () => Effect.void,
          onSome: (strategy) =>
            adaptiveQuality.updateConfiguration({
              strategy,
            }),
        })
      )

      yield* Effect.logInfo('Progressive Loading 設定更新完了')
    })

  return ProgressiveLoadingService.of({
    initialize,
    start,
    stop,
    updatePlayerState,
    updatePerformanceMetrics,
    getSystemStatus,
    requestChunkLoad,
    reportLoadComplete,
    updateSettings,
  })
})

// === Context Tag ===

export const ProgressiveLoadingService = Context.GenericTag<ProgressiveLoadingService>(
  '@minecraft/domain/world/ProgressiveLoadingService'
)

// === Layer Exports ===
export * from './layer'

// === Helper Functions ===

export const ProgressiveLoadingUtils = {
  /**
   * プレイヤー周辺のチャンクを一括リクエスト
   */
  requestChunksAroundPlayer: (
    playerId: string,
    centerX: number,
    centerZ: number,
    radius: number,
    priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
  ) =>
    Effect.gen(function* () {
      const service = yield* ProgressiveLoadingService

      // 円形範囲内の全座標を事前計算
      const positions = pipe(
        ReadonlyArray.range(centerX - radius, centerX + radius + 1),
        ReadonlyArray.flatMap((x) =>
          pipe(
            ReadonlyArray.range(centerZ - radius, centerZ + radius + 1),
            ReadonlyArray.map((z) => ({
              x,
              z,
              distance: Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2),
            }))
          )
        ),
        ReadonlyArray.filter(({ distance }) => distance <= radius)
      )

      // チャンクロードを完全並行実行
      const requests = yield* pipe(
        positions,
        Effect.forEach(({ x, z }) => service.requestChunkLoad(x, z, playerId, priority), { concurrency: 'unbounded' })
      )

      return requests
    }),

  /**
   * パフォーマンス監視付きシステム実行
   */
  runWithPerformanceMonitoring: <A, E>(
    task: Effect.Effect<A, E>,
    onMetrics?: (fps: number, memory: number, cpu: number) => Effect.Effect<void>
  ) =>
    Effect.gen(function* () {
      const service = yield* ProgressiveLoadingService

      // パフォーマンス監視開始
      const monitoringFiber = yield* Effect.fork(
        Effect.repeat(
          Effect.gen(function* () {
            // 実際の環境では適切なメトリクス取得APIを使用
            const fps = 60 + Math.random() * 10 - 5 // 55-65 FPS
            const memory = 0.6 + Math.random() * 0.2 // 60-80%
            const cpu = 0.3 + Math.random() * 0.3 // 30-60%

            yield* service.updatePerformanceMetrics(fps, memory, cpu)

            yield* pipe(
              Option.fromNullable(onMetrics),
              Option.match({
                onNone: () => Effect.void,
                onSome: (fn) => fn(fps, memory, cpu),
              })
            )
          }),
          { schedule: Effect.Schedule.spaced('1 seconds') }
        )
      )

      // Effect.ensuring を使用して、成功・失敗に関わらず fiber を中断
      return yield* task.pipe(Effect.ensuring(Effect.interrupt(monitoringFiber)))
    }),

  /**
   * システム健全性チェック
   */
  performHealthCheck: () =>
    Effect.gen(function* () {
      const service = yield* ProgressiveLoadingService
      const status = yield* service.getSystemStatus()

      const issues = []

      if (!status.overall.healthy) {
        issues.push('システム全体の健全性に問題があります')
      }

      if (status.memory.usagePercentage > 90) {
        issues.push(`メモリ使用率が高すぎます: ${status.memory.usagePercentage.toFixed(1)}%`)
      }

      if (status.scheduler.pendingRequests > 100) {
        issues.push(`保留中のリクエストが多すぎます: ${status.scheduler.pendingRequests}`)
      }

      if (status.overall.errors.length > 0) {
        issues.push(`エラーが発生しています: ${status.overall.errors.join(', ')}`)
      }

      return {
        healthy: issues.length === 0,
        issues,
        status,
      }
    }),
}

export type { ProgressiveLoadingErrorType } from './adaptive_quality'
