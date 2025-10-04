/**
 * Progressive Loading Application Service
 *
 * プレイヤーの位置と移動予測に基づいた段階的読み込みシステム。
 * パフォーマンス監視、メモリ管理、適応的品質調整を統合して提供します。
 */

// === Loading Scheduler ===
export {
  LoadingSchedulerService,
  LoadingSchedulerServiceLive,
  LoadingSchedulerError,
  LoadingRequest,
  LoadingBatch,
  SchedulerConfiguration,
  PlayerMovementState,
  LoadingQueueState,
  MovementVector,
  DEFAULT_SCHEDULER_CONFIG,
} from './loading-scheduler.js'

export type {
  LoadingSchedulerErrorType,
  LoadingRequestType,
  LoadingBatchType,
  SchedulerConfigurationType,
  PlayerMovementStateType,
  LoadingQueueStateType,
  MovementVectorType,
} from './loading-scheduler.js'

// === Priority Calculator ===
export {
  PriorityCalculatorService,
  PriorityCalculatorServiceLive,
  PriorityCalculatorError,
  PriorityFactor,
  PriorityContext,
  PriorityCalculationResult,
  PriorityConfiguration,
  MLModelPrediction,
  DEFAULT_PRIORITY_CONFIG,
} from './priority-calculator.js'

export type {
  PriorityCalculatorErrorType,
  PriorityFactorType,
  PriorityContextType,
  PriorityCalculationResultType,
  PriorityConfigurationType,
  MLModelPredictionType,
} from './priority-calculator.js'

// === Memory Monitor ===
export {
  MemoryMonitorService,
  MemoryMonitorServiceLive,
  MemoryMonitorError,
  MemoryMetrics,
  MemoryAlert,
  MemoryConfiguration,
  MemoryPool,
  AllocationRequest,
  MemoryStatistics,
  DEFAULT_MEMORY_CONFIG,
} from './memory-monitor.js'

export type {
  MemoryMonitorErrorType,
  MemoryMetricsType,
  MemoryAlertType,
  MemoryConfigurationType,
  MemoryPoolType,
  AllocationRequestType,
  MemoryStatisticsType,
} from './memory-monitor.js'

// === Adaptive Quality ===
export {
  AdaptiveQualityService,
  AdaptiveQualityServiceLive,
  AdaptiveQualityError,
  QualityProfile,
  PerformanceSnapshot,
  PerformanceTrend,
  AdaptationConfiguration,
  QualityAdjustment,
  DEFAULT_ADAPTATION_CONFIG,
  DEFAULT_QUALITY_PROFILES,
} from './adaptive-quality.js'

export type {
  AdaptiveQualityErrorType,
  QualityProfileType,
  PerformanceSnapshotType,
  PerformanceTrendType,
  AdaptationConfigurationType,
  QualityAdjustmentType,
} from './adaptive-quality.js'

// === Integrated Progressive Loading Service ===

import { Context, Effect, Layer, Schema } from 'effect'
import { LoadingSchedulerService } from './loading-scheduler.js'
import { PriorityCalculatorService } from './priority-calculator.js'
import { MemoryMonitorService } from './memory-monitor.js'
import { AdaptiveQualityService } from './adaptive-quality.js'

/**
 * Progressive Loading Application Service
 *
 * 段階的読み込みの統合サービスインターフェース
 */

export const ProgressiveLoadingError = Schema.TaggedError<ProgressiveLoadingErrorType>()(
  'ProgressiveLoadingError',
  {
    message: Schema.String,
    serviceId: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
)

export interface ProgressiveLoadingErrorType
  extends Schema.Schema.Type<typeof ProgressiveLoadingError> {}

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
  readonly getSystemStatus: () => Effect.Effect<{
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
  }, ProgressiveLoadingErrorType>

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
  readonly updateSettings: (
    settings: {
      maxConcurrentLoads?: number
      adaptiveQuality?: boolean
      memoryManagement?: 'conservative' | 'balanced' | 'aggressive'
      qualityStrategy?: 'performance_first' | 'quality_first' | 'balanced'
    }
  ) => Effect.Effect<void, ProgressiveLoadingErrorType>
}

// === Live Implementation ===

const makeProgressiveLoadingService = Effect.gen(function* () {
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
          direction: Math.atan2(velocity.z, velocity.x) * 180 / Math.PI,
          confidence: velocity.x !== 0 || velocity.z !== 0 ? 0.8 : 0.5,
        },
        viewDistance,
        lastUpdate: Date.now(),
        history: [], // 簡略化
      }

      yield* scheduler.updatePlayerMovement(movementState)
      yield* Effect.logDebug(`プレイヤー状態更新: ${playerId}`)
    })

  const updatePerformanceMetrics = (fps: number, memoryUsage: number, cpuUsage: number) =>
    Effect.gen(function* () {
      const snapshot = {
        _tag: 'PerformanceSnapshot' as const,
        timestamp: Date.now(),
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
          errors: queueState.failed.map(f => f.error),
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
      const requestId = `chunk_${chunkX}_${chunkZ}_${Date.now()}`

      const loadRequest = {
        _tag: 'LoadingRequest' as const,
        id: requestId,
        chunkPosition: { x: chunkX, z: chunkZ },
        priority,
        distance: 0, // プレイヤー位置から計算
        estimatedSize: 1024, // 1KB推定
        requester: playerId,
        timestamp: Date.now(),
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
      if (settings.maxConcurrentLoads !== undefined) {
        yield* scheduler.updateConfiguration({
          maxConcurrentLoads: settings.maxConcurrentLoads,
        })
      }

      if (settings.memoryManagement !== undefined) {
        yield* memoryMonitor.updateConfiguration({
          strategy: settings.memoryManagement,
        })
      }

      if (settings.qualityStrategy !== undefined) {
        yield* adaptiveQuality.updateConfiguration({
          strategy: settings.qualityStrategy,
        })
      }

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

// === Integrated Layer ===

export const ProgressiveLoadingServiceLive = Layer.effect(
  ProgressiveLoadingService,
  makeProgressiveLoadingService
).pipe(
  Layer.provide(LoadingSchedulerService),
  Layer.provide(PriorityCalculatorService),
  Layer.provide(MemoryMonitorService),
  Layer.provide(AdaptiveQualityService)
)

// === Complete Service Layer ===

export const ProgressiveLoadingServicesLayer = Layer.mergeAll(
  LoadingSchedulerServiceLive,
  PriorityCalculatorServiceLive,
  MemoryMonitorServiceLive,
  AdaptiveQualityServiceLive,
  ProgressiveLoadingServiceLive
)

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
      const requests: string[] = []

      for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let z = centerZ - radius; z <= centerZ + radius; z++) {
          const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2)
          if (distance <= radius) {
            const requestId = yield* service.requestChunkLoad(x, z, playerId, priority)
            requests.push(requestId)
          }
        }
      }

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

            if (onMetrics) {
              yield* onMetrics(fps, memory, cpu)
            }
          }),
          { schedule: Effect.Schedule.spaced('1 seconds') }
        )
      )

      try {
        const result = yield* task
        return result
      } finally {
        yield* Effect.interrupt(monitoringFiber)
      }
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

export type {
  ProgressiveLoadingErrorType,
} from './index.js'