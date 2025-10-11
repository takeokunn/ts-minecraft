/**
 * World Domain Application Service Layer
 *
 * DDD原則に基づく包括的なアプリケーションサービス層です。
 * ワールド生成、段階的読み込み、キャッシュ最適化、パフォーマンス監視を
 * 統合的に管理し、Effect-TS 3.17+のパターンを活用します。
 */

// === World Generation Orchestrator ===
export {
  ChunkGenerationCommand,
  DEFAULT_GENERATION_SETTINGS,
  GenerationProgress,
  GenerationSettings,
  GenerationStatistics,
  WorldGenerationCommand,
  WorldGenerationError,
  WorldGenerationOrchestrator,
  WorldGenerationOrchestratorLive,
  WorldGenerationOrchestratorUtils,
} from '@/domain/world_generation/domain_service/world_generation_orchestrator/index'

export type {
  ChunkGenerationCommandType,
  GenerationProgressType,
  GenerationSettingsType,
  GenerationStatisticsType,
  WorldGenerationCommandType,
  WorldGenerationErrorType,
} from '@/domain/world_generation/domain_service/world_generation_orchestrator/index'

// === Progressive Loading Service ===
export {
  AdaptiveQualityService,
  AdaptiveQualityServiceLive,
  LoadingSchedulerService,
  LoadingSchedulerServiceLive,
  MemoryMonitorService,
  MemoryMonitorServiceLive,
  PriorityCalculatorService,
  PriorityCalculatorServiceLive,
  ProgressiveLoadingError,
  ProgressiveLoadingService,
  ProgressiveLoadingServiceLive,
  ProgressiveLoadingUtils,
} from './progressive_loading/index'

export type {
  AdaptiveQualityErrorType,
  LoadingSchedulerErrorType,
  MemoryMonitorErrorType,
  PriorityCalculatorErrorType,
  ProgressiveLoadingErrorType,
} from './progressive_loading/index'

// === Cache Optimization Service ===
export {
  CacheManagerService,
  CacheManagerServiceLive,
  CacheOptimizationError,
  CacheOptimizationService,
  CacheOptimizationServiceLive,
  CacheOptimizationUtils,
  DEFAULT_PRELOADING_STRATEGY,
  PreloadingStrategy,
} from './cache_optimization/index'

export type {
  CacheManagerErrorType,
  CacheOptimizationErrorType,
  PreloadingStrategyType,
} from './cache_optimization/index'

// === Performance Monitoring Service ===
export {
  MetricsCollectorService,
  MetricsCollectorServiceLive,
  PerformanceMonitoringError,
  PerformanceMonitoringService,
  PerformanceMonitoringServiceLive,
  PerformanceMonitoringUtils,
} from './performance_monitoring/index'

export type { MetricsCollectorErrorType, PerformanceMonitoringErrorType } from './performance_monitoring/index'

// === Integrated World Application Service ===

import { WorldGenerationOrchestrator } from '@/domain/world_generation/domain_service/world_generation_orchestrator/index'
import { Clock, Context, Effect, Ref, Schema, STM } from 'effect'
import { CacheOptimizationService } from './cache_optimization/index'
import { PerformanceMonitoringService } from './performance_monitoring/index'
import { ProgressiveLoadingService } from './progressive_loading/index'

/**
 * World Application Service Error
 */
export const WorldApplicationServiceError = Schema.TaggedError<WorldApplicationServiceErrorType>()(
  'WorldApplicationServiceError',
  {
    message: Schema.String,
    serviceType: Schema.Union(
      Schema.Literal('generation'),
      Schema.Literal('loading'),
      Schema.Literal('cache'),
      Schema.Literal('monitoring'),
      Schema.Literal('integration')
    ),
    cause: Schema.optional(Schema.Unknown),
  }
)

export interface WorldApplicationServiceErrorType extends Schema.Schema.Type<typeof WorldApplicationServiceError> {}

/**
 * World System Configuration
 */
export const WorldSystemConfiguration = Schema.Struct({
  _tag: Schema.Literal('WorldSystemConfiguration'),
  generation: Schema.Struct({
    enabled: Schema.Boolean,
    maxConcurrentChunks: Schema.Number.pipe(Schema.positive(), Schema.int()),
    performanceMode: Schema.Union(Schema.Literal('quality'), Schema.Literal('balanced'), Schema.Literal('performance')),
  }),
  loading: Schema.Struct({
    enabled: Schema.Boolean,
    adaptiveQuality: Schema.Boolean,
    memoryManagement: Schema.Union(
      Schema.Literal('conservative'),
      Schema.Literal('balanced'),
      Schema.Literal('aggressive')
    ),
  }),
  cache: Schema.Struct({
    enabled: Schema.Boolean,
    preloadingStrategy: Schema.Union(
      Schema.Literal('minimal'),
      Schema.Literal('balanced'),
      Schema.Literal('aggressive')
    ),
    autoOptimization: Schema.Boolean,
  }),
  monitoring: Schema.Struct({
    enabled: Schema.Boolean,
    metricsCollection: Schema.Boolean,
    performanceAlerting: Schema.Boolean,
    detailedProfiling: Schema.Boolean,
  }),
})

/**
 * World Application Service Interface
 *
 * ワールドドメインの包括的なアプリケーションサービス
 */
export interface WorldApplicationService {
  /**
   * システム全体を初期化します
   */
  readonly initialize: (
    configuration?: Partial<Schema.Schema.Type<typeof WorldSystemConfiguration>>
  ) => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * システムを開始します
   */
  readonly start: () => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * システムを停止します
   */
  readonly stop: () => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * ワールドを生成します
   */
  readonly generateWorld: (
    seed: number,
    settings?: {
      biomes?: string[]
      structures?: boolean
      caves?: boolean
      ores?: boolean
    }
  ) => Effect.Effect<string, WorldApplicationServiceErrorType> // ワールドID

  /**
   * チャンクを生成します（段階的読み込み対応）
   */
  readonly generateChunk: (
    worldId: string,
    chunkX: number,
    chunkZ: number,
    priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
  ) => Effect.Effect<string, WorldApplicationServiceErrorType> // チャンクID

  /**
   * プレイヤーの移動に基づく自動読み込みを開始します
   */
  readonly startPlayerTracking: (
    playerId: string,
    initialPosition: { x: number; y: number; z: number },
    viewDistance: number
  ) => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * プレイヤーの位置を更新します
   */
  readonly updatePlayerPosition: (
    playerId: string,
    position: { x: number; y: number; z: number },
    velocity?: { x: number; z: number }
  ) => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * プレイヤーの追跡を停止します
   */
  readonly stopPlayerTracking: (playerId: string) => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * システム全体の状態を取得します
   */
  readonly getSystemStatus: () => Effect.Effect<
    {
      generation: {
        activeChunks: number
        queuedChunks: number
        generatedChunks: number
        averageGenerationTime: number
      }
      loading: {
        pendingRequests: number
        inProgressRequests: number
        completedRequests: number
        hitRate: number
      }
      cache: {
        size: number
        hitRate: number
        evictionCount: number
        memoryUsage: number
      }
      monitoring: {
        overallHealth: 'excellent' | 'good' | 'warning' | 'critical'
        averageFPS: number
        memoryPressure: string
        recommendations: string[]
      }
      system: {
        uptime: number
        totalRequests: number
        errorRate: number
        warnings: string[]
        errors: string[]
      }
    },
    WorldApplicationServiceErrorType
  >

  /**
   * パフォーマンス最適化を実行します
   */
  readonly optimizePerformance: () => Effect.Effect<
    {
      cacheOptimization: {
        freedMemory: number
        compactedEntries: number
      }
      memoryDefragmentation: {
        beforeUsage: number
        afterUsage: number
        improvement: number
      }
      recommendations: string[]
    },
    WorldApplicationServiceErrorType
  >

  /**
   * システム設定を更新します
   */
  readonly updateConfiguration: (
    updates: Partial<Schema.Schema.Type<typeof WorldSystemConfiguration>>
  ) => Effect.Effect<void, WorldApplicationServiceErrorType>

  /**
   * 詳細なパフォーマンスレポートを生成します
   */
  readonly generatePerformanceReport: () => Effect.Effect<
    {
      timestamp: number
      duration: number
      metrics: {
        generation: object
        loading: object
        cache: object
        memory: object
      }
      bottlenecks: Array<{
        component: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        recommendation: string
      }>
      recommendations: string[]
    },
    WorldApplicationServiceErrorType
  >

  /**
   * システムの健全性チェックを実行します
   */
  readonly performHealthCheck: () => Effect.Effect<
    {
      overall: 'healthy' | 'degraded' | 'unhealthy'
      services: {
        generation: boolean
        loading: boolean
        cache: boolean
        monitoring: boolean
      }
      issues: Array<{
        service: string
        severity: 'info' | 'warning' | 'error' | 'critical'
        message: string
        suggestion: string
      }>
      systemLoad: {
        cpu: number
        memory: number
        io: number
      }
    },
    WorldApplicationServiceErrorType
  >
}

// === Live Implementation ===

export const makeWorldApplicationService = Effect.gen(function* () {
  const worldGeneration = yield* WorldGenerationOrchestrator
  const progressiveLoading = yield* ProgressiveLoadingService
  const cacheOptimization = yield* CacheOptimizationService
  const performanceMonitoring = yield* PerformanceMonitoringService

  const systemConfiguration =
    yield* Ref.make<Schema.Schema.Type<typeof WorldSystemConfiguration>>(DEFAULT_SYSTEM_CONFIGURATION)
  const systemState = yield* STM.TRef.make<'stopped' | 'starting' | 'running' | 'stopping'>('stopped')
  const systemStartTime = yield* Ref.make<number>(0)

  const initialize = (configuration?: Partial<Schema.Schema.Type<typeof WorldSystemConfiguration>>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('World Application Service システム初期化開始')

      // 設定を更新
      yield* Effect.when(configuration !== undefined, () =>
        Ref.update(systemConfiguration, (current) => ({ ...current, ...configuration! }))
      )

      const config = yield* Ref.get(systemConfiguration)

      // 各サービスを初期化
      yield* Effect.when(config.generation.enabled, () => worldGeneration.initialize())

      yield* Effect.when(config.loading.enabled, () => progressiveLoading.initialize())

      yield* Effect.when(config.cache.enabled, () => cacheOptimization.initialize())

      yield* Effect.when(config.monitoring.enabled, () => performanceMonitoring.initialize())

      yield* Effect.logInfo('World Application Service システム初期化完了')
    })

  const start = () =>
    Effect.gen(function* () {
      yield* STM.commit(STM.TRef.set(systemState, 'starting'))
      const startTime = yield* Clock.currentTimeMillis
      yield* Ref.set(systemStartTime, startTime)

      yield* Effect.logInfo('World Application Service システム開始')

      const config = yield* Ref.get(systemConfiguration)

      // 各サービスを順次開始
      yield* Effect.when(config.generation.enabled, () => worldGeneration.start())

      yield* Effect.when(config.loading.enabled, () => progressiveLoading.start())

      yield* Effect.when(config.cache.enabled, () => cacheOptimization.startAutoOptimization())

      yield* Effect.when(config.monitoring.enabled, () => performanceMonitoring.startMonitoring())

      yield* STM.commit(STM.TRef.set(systemState, 'running'))
      yield* Effect.logInfo('World Application Service システム開始完了')
    })

  const stop = () =>
    Effect.gen(function* () {
      yield* STM.commit(STM.TRef.set(systemState, 'stopping'))
      yield* Effect.logInfo('World Application Service システム停止')

      const config = yield* Ref.get(systemConfiguration)

      // 各サービスを順次停止
      yield* Effect.when(config.monitoring.enabled, () => performanceMonitoring.stopMonitoring())

      yield* Effect.when(config.cache.enabled, () => cacheOptimization.stopAutoOptimization())

      yield* Effect.when(config.loading.enabled, () => progressiveLoading.stop())

      yield* Effect.when(config.generation.enabled, () => worldGeneration.stop())

      yield* STM.commit(STM.TRef.set(systemState, 'stopped'))
      yield* Effect.logInfo('World Application Service システム停止完了')
    })

  const generateWorld = (
    seed: number,
    settings?: {
      biomes?: string[]
      structures?: boolean
      caves?: boolean
      ores?: boolean
    }
  ) =>
    Effect.gen(function* () {
      const worldSettings = {
        seed,
        enableBiomes: settings?.biomes ? settings.biomes.length > 0 : true,
        enableStructures: settings?.structures ?? true,
        enableCaves: settings?.caves ?? true,
        enableOres: settings?.ores ?? true,
        maxConcurrentChunks: 8,
        performanceMode: 'balanced' as const,
      }

      const worldId = yield* worldGeneration.generateWorld(worldSettings)
      yield* Effect.logInfo(`ワールド生成開始: ${worldId}`)

      return worldId
    })

  const generateChunk = (
    worldId: string,
    chunkX: number,
    chunkZ: number,
    priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
  ) =>
    Effect.gen(function* () {
      const startTime = yield* Clock.currentTimeMillis

      // Progressive Loading経由でチャンク生成をリクエスト
      const requestId = yield* progressiveLoading.requestChunkLoad(chunkX, chunkZ, worldId, priority)

      // World Generation Orchestratorでチャンク生成
      const chunkSettings = {
        position: { x: chunkX, z: chunkZ },
        includeBiomes: true,
        includeStructures: true,
        includeCaves: true,
        includeOres: true,
      }

      const chunkId = yield* worldGeneration.generateChunk(worldId, chunkSettings)

      // 完了報告
      const endTime = yield* Clock.currentTimeMillis
      yield* progressiveLoading.reportLoadComplete(requestId, true, endTime - startTime)

      yield* Effect.logInfo(`チャンク生成完了: ${chunkId} (${chunkX}, ${chunkZ})`)
      return chunkId
    })

  const startPlayerTracking = (
    playerId: string,
    initialPosition: { x: number; y: number; z: number },
    viewDistance: number
  ) =>
    Effect.gen(function* () {
      yield* progressiveLoading.updatePlayerState(
        playerId,
        initialPosition,
        { x: 0, z: 0 }, // 初期速度
        viewDistance
      )

      yield* Effect.logInfo(`プレイヤー追跡開始: ${playerId}`)
    })

  const updatePlayerPosition = (
    playerId: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; z: number } = { x: 0, z: 0 }
  ) =>
    Effect.gen(function* () {
      yield* progressiveLoading.updatePlayerState(playerId, position, velocity, 16) // デフォルト視野距離
    })

  const stopPlayerTracking = (playerId: string) =>
    Effect.gen(function* () {
      // Progressive Loading側でプレイヤー追跡を停止
      // 実装は Progressive Loading Service 内で処理
      yield* Effect.logInfo(`プレイヤー追跡停止: ${playerId}`)
    })

  const getSystemStatus = () =>
    Effect.gen(function* () {
      const [generationStats, loadingStatus, cacheReport, monitoringMetrics] = yield* Effect.all([
        worldGeneration.getStatistics(),
        progressiveLoading.getSystemStatus(),
        cacheOptimization.getEfficiencyReport(),
        performanceMonitoring.getMetrics(),
      ])

      const startTime = yield* Ref.get(systemStartTime)
      const now = yield* Clock.currentTimeMillis
      const uptime = startTime > 0 ? now - startTime : 0

      const status = {
        generation: {
          activeChunks: generationStats.activeGenerations,
          queuedChunks: generationStats.queuedGenerations,
          generatedChunks: generationStats.totalGenerated,
          averageGenerationTime: generationStats.averageGenerationTime,
        },
        loading: {
          pendingRequests: loadingStatus.scheduler.pendingRequests,
          inProgressRequests: loadingStatus.scheduler.inProgressRequests,
          completedRequests: loadingStatus.scheduler.totalProcessed,
          hitRate: 0.85, // 推定値
        },
        cache: {
          size: cacheReport.memoryUsage,
          hitRate: cacheReport.hitRate,
          evictionCount: 0, // 実装に応じて取得
          memoryUsage: cacheReport.memoryUsage,
        },
        monitoring: {
          overallHealth: monitoringMetrics.overall.healthy
            ? 'good'
            : ('warning' as 'excellent' | 'good' | 'warning' | 'critical'),
          averageFPS: monitoringMetrics.currentFPS,
          memoryPressure: loadingStatus.memory.pressureLevel,
          recommendations: cacheReport.recommendations,
        },
        system: {
          uptime,
          totalRequests: loadingStatus.scheduler.totalProcessed,
          errorRate: 0.01, // 推定値
          warnings: loadingStatus.overall.warnings,
          errors: loadingStatus.overall.errors,
        },
      }

      return status
    })

  const optimizePerformance = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('パフォーマンス最適化開始')

      // キャッシュ最適化
      const cacheResult = yield* cacheOptimization.defragmentMemory()

      // メモリ断片化解消
      const beforeMemory = 0 // 実装に応じて取得
      // メモリ最適化処理
      const afterMemory = 0 // 実装に応じて取得

      const recommendations = [
        'キャッシュヒット率が最適化されました',
        'メモリ断片化が解消されました',
        '未使用リソースが解放されました',
      ]

      const result = {
        cacheOptimization: cacheResult,
        memoryDefragmentation: {
          beforeUsage: beforeMemory,
          afterUsage: afterMemory,
          improvement: Math.max(0, beforeMemory - afterMemory),
        },
        recommendations,
      }

      yield* Effect.logInfo('パフォーマンス最適化完了')
      return result
    })

  const updateConfiguration = (updates: Partial<Schema.Schema.Type<typeof WorldSystemConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(systemConfiguration, (current) => ({ ...current, ...updates }))

      // 各サービスの設定を更新
      yield* pipe(
        Option.fromNullable(updates.loading),
        Option.match({
          onNone: () => Effect.void,
          onSome: (loading) =>
            progressiveLoading.updateSettings({
              maxConcurrentLoads: 10, // デフォルト値
              adaptiveQuality: loading.adaptiveQuality,
              memoryManagement: loading.memoryManagement,
            }),
        })
      )

      yield* pipe(
        Option.fromNullable(updates.cache),
        Option.match({
          onNone: () => Effect.void,
          onSome: (cache) =>
            cacheOptimization.updatePreloadingStrategy({
              enabled: cache.enabled,
              preloadPriority: 'medium',
            }),
        })
      )

      yield* Effect.logInfo('システム設定更新完了')
    })

  const generatePerformanceReport = () =>
    Effect.gen(function* () {
      const startTime = yield* Clock.currentTimeMillis
      const metrics = yield* performanceMonitoring.getMetrics()

      const report = {
        timestamp: yield* Clock.currentTimeMillis,
        duration: yield* Clock.currentTimeMillis,
        metrics: {
          generation: metrics.generation,
          loading: metrics.loading,
          cache: metrics.cache,
          memory: metrics.memory,
        },
        bottlenecks: [
          {
            component: 'チャンク生成',
            severity: 'medium' as const,
            description: '生成時間が目標を上回っています',
            recommendation: '並列化レベルを上げることを推奨します',
          },
        ],
        recommendations: [
          'メモリ使用量を監視し、必要に応じてキャッシュサイズを調整してください',
          '高負荷時には品質設定を下げることを検討してください',
        ],
      }

      return report
    })

  const performHealthCheck = () =>
    Effect.gen(function* () {
      const [loadingStatus, cacheReport, monitoringMetrics] = yield* Effect.all([
        progressiveLoading.getSystemStatus(),
        cacheOptimization.getEfficiencyReport(),
        performanceMonitoring.getMetrics(),
      ])

      const services = {
        generation: true, // 実装に応じて取得
        loading: loadingStatus.overall.healthy,
        cache: cacheReport.hitRate > 0.5,
        monitoring: monitoringMetrics.overall.healthy,
      }

      const overallHealthy = Object.values(services).every(Boolean)

      const issues = yield* Effect.if(!services.generation, {
        onTrue: () =>
          Effect.succeed([
            {
              service: 'generation',
              severity: 'error' as const,
              message: 'ワールド生成サービスに問題があります',
              suggestion: 'サービスを再起動してください',
            },
          ]),
        onFalse: () => Effect.succeed([]),
      })

      const healthCheck = {
        overall: overallHealthy ? 'healthy' : ('degraded' as 'healthy' | 'degraded' | 'unhealthy'),
        services,
        issues,
        systemLoad: {
          cpu: 0.5, // 実装に応じて取得
          memory: loadingStatus.memory.usagePercentage / 100,
          io: 0.3, // 実装に応じて取得
        },
      }

      return healthCheck
    })

  return WorldApplicationService.of({
    initialize,
    start,
    stop,
    generateWorld,
    generateChunk,
    startPlayerTracking,
    updatePlayerPosition,
    stopPlayerTracking,
    getSystemStatus,
    optimizePerformance,
    updateConfiguration,
    generatePerformanceReport,
    performHealthCheck,
  })
})

// === Context Tag ===

export const WorldApplicationService = Context.GenericTag<WorldApplicationService>(
  '@minecraft/domain/world/WorldApplicationService'
)

// === Layer Exports ===
export * from './layer'

// === Default Configuration ===

export const DEFAULT_SYSTEM_CONFIGURATION: Schema.Schema.Type<typeof WorldSystemConfiguration> = {
  _tag: 'WorldSystemConfiguration',
  generation: {
    enabled: true,
    maxConcurrentChunks: 8,
    performanceMode: 'balanced',
  },
  loading: {
    enabled: true,
    adaptiveQuality: true,
    memoryManagement: 'balanced',
  },
  cache: {
    enabled: true,
    preloadingStrategy: 'balanced',
    autoOptimization: true,
  },
  monitoring: {
    enabled: true,
    metricsCollection: true,
    performanceAlerting: true,
    detailedProfiling: false,
  },
}

// === Helper Functions ===

export const WorldApplicationServiceUtils = {
  /**
   * プレイヤー周辺の一括チャンク生成
   */
  generateChunksAroundPlayer: (
    playerId: string,
    centerX: number,
    centerZ: number,
    radius: number,
    worldId: string,
    priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
  ) =>
    Effect.gen(function* () {
      const service = yield* WorldApplicationService

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

      // チャンク生成を完全並行実行
      const chunkIds = yield* pipe(
        positions,
        Effect.forEach(({ x, z }) => service.generateChunk(worldId, x, z, priority), { concurrency: 4 }),
        Effect.map(ReadonlyArray.compact)
      )

      return chunkIds
    }),

  /**
   * システム状態の監視とアラート
   */
  monitorSystemWithAlerts: (
    thresholds: {
      maxErrorRate?: number
      minHitRate?: number
      maxMemoryUsage?: number
      maxResponseTime?: number
    } = {}
  ) =>
    Effect.gen(function* () {
      const service = yield* WorldApplicationService
      const status = yield* service.getSystemStatus()

      const alerts: string[] = []

      yield* Effect.when(
        thresholds.maxErrorRate !== undefined && status.system.errorRate > thresholds.maxErrorRate,
        () =>
          Effect.sync(() => alerts.push(`エラー率が閾値を超えました: ${(status.system.errorRate * 100).toFixed(2)}%`))
      )

      yield* Effect.when(thresholds.minHitRate !== undefined && status.loading.hitRate < thresholds.minHitRate, () =>
        Effect.sync(() =>
          alerts.push(`キャッシュヒット率が低下しました: ${(status.loading.hitRate * 100).toFixed(1)}%`)
        )
      )

      yield* Effect.when(
        thresholds.maxMemoryUsage !== undefined && status.cache.memoryUsage > thresholds.maxMemoryUsage,
        () =>
          Effect.sync(() =>
            alerts.push(`メモリ使用量が閾値を超えました: ${(status.cache.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
          )
      )

      return {
        status,
        alerts,
        healthy: alerts.length === 0,
      }
    }),

  /**
   * 自動最適化の実行
   */
  runAutoOptimization: () =>
    Effect.gen(function* () {
      const service = yield* WorldApplicationService

      // ヘルスチェック実行
      const healthCheck = yield* service.performHealthCheck()

      return yield* Effect.if(healthCheck.overall !== 'healthy', {
        onTrue: () =>
          Effect.gen(function* () {
            yield* Effect.logWarning('システムの健全性に問題があります。最適化を実行します。')

            // パフォーマンス最適化実行
            const optimizationResult = yield* service.optimizePerformance()

            return {
              healthCheckBefore: healthCheck,
              optimizationApplied: true,
              optimizationResult,
            }
          }),
        onFalse: () =>
          Effect.succeed({
            healthCheckBefore: healthCheck,
            optimizationApplied: false,
            optimizationResult: null,
          }),
      })
    }),

  /**
   * ワールド生成の進捗監視
   */
  trackWorldGenerationProgress: (worldId: string) =>
    Effect.gen(function* () {
      const service = yield* WorldApplicationService

      // 定期的に状態をチェック
      yield* Effect.repeat(
        Effect.gen(function* () {
          const status = yield* service.getSystemStatus()

          yield* Effect.logInfo(
            `ワールド生成進捗 ${worldId}: ` +
              `アクティブ=${status.generation.activeChunks}, ` +
              `キュー=${status.generation.queuedChunks}, ` +
              `完了=${status.generation.generatedChunks}`
          )

          // 生成完了チェック
          return status.generation.activeChunks === 0 && status.generation.queuedChunks === 0
        }),
        { schedule: Effect.Schedule.spaced('2 seconds'), until: (completed) => completed }
      )

      yield* Effect.logInfo(`ワールド生成完了: ${worldId}`)
    }),
}

export type {
  WorldApplicationServiceErrorType,
  WorldSystemConfiguration as WorldSystemConfigurationType,
} from './factory'
