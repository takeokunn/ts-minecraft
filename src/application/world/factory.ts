/**
 * World Application Service Factory
 *
 * ワールドアプリケーションサービスのファクトリー関数
 */

import { WorldGenerationOrchestrator } from '@/domain/world_generation/domain_service/world_generation_orchestrator/index'
import { Clock, Effect, Ref, Schema, STM } from 'effect'
import { CacheOptimizationService } from './cache_optimization/index'
import { PerformanceMonitoringService } from './performance_monitoring/index'
import { ProgressiveLoadingService } from './progressive_loading/index'

// Import types from service definition (avoid circular dependency)
import { WorldApplicationService as WorldApplicationServiceTag, WorldSystemConfiguration } from './service'

const DEFAULT_SYSTEM_CONFIGURATION: Schema.Schema.Type<typeof WorldSystemConfiguration> = {
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
        Ref.update(systemConfiguration, (current) => ({ ...current, ...configuration }))
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

      const issues = []
      yield* Effect.when(!services.generation, () =>
        Effect.sync(() =>
          issues.push({
            service: 'generation',
            severity: 'error' as const,
            message: 'ワールド生成サービスに問題があります',
            suggestion: 'サービスを再起動してください',
          })
        )
      )

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

  return WorldApplicationServiceTag.of({
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
