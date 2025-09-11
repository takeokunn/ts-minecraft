import { Effect, Ref, Layer, Schedule, Duration, pipe } from 'effect'
import { 
  optimizedGameLoop, 
  PrioritizedSystem, 
  GameLoopConfig,
  defaultGameLoopConfig 
} from './loop'
import { 
  createMemoryPoolManager, 
  MemoryPoolService,
  monitorPoolPerformance 
} from './memory-pools'
import { 
  createResourceManager, 
  ResourceManagerService,
  defaultResourceConfig,
  predictivePreloader 
} from './resource-manager'
import {
  OptimizedMemoryPool,
  OptimizedResourceManager,
  PerformanceMonitor,
  QualityController,
  WorkerCoordinator,
  Clock,
  Stats
} from './services'
import {
  FPSCounter,
  MemoryDetector,
  Profile,
  Metrics,
  PerformanceDashboard,
  PerformanceHealthCheck,
  startPerformanceMonitoring
} from '@/core/performance'

/**
 * Optimized Runtime Configuration
 */
export interface OptimizedRuntimeConfig {
  readonly gameLoop: GameLoopConfig
  readonly resourceManager: typeof defaultResourceConfig
  readonly monitoring: {
    readonly enableFPSCounter: boolean
    readonly enableMemoryDetection: boolean
    readonly enableProfiling: boolean
    readonly reportInterval: number
    readonly autoQualityAdjustment: boolean
  }
  readonly quality: {
    readonly initial: 'low' | 'medium' | 'high' | 'ultra'
    readonly adaptive: boolean
    readonly targetFPS: number
  }
  readonly workers: {
    readonly maxWorkers: number
    readonly taskTimeout: number
    readonly enableAutoScaling: boolean
  }
}

export const defaultOptimizedConfig: OptimizedRuntimeConfig = {
  gameLoop: defaultGameLoopConfig,
  resourceManager: defaultResourceConfig,
  monitoring: {
    enableFPSCounter: true,
    enableMemoryDetection: true,
    enableProfiling: true,
    reportInterval: 30000, // 30 seconds
    autoQualityAdjustment: true
  },
  quality: {
    initial: 'medium',
    adaptive: true,
    targetFPS: 60
  },
  workers: {
    maxWorkers: navigator.hardwareConcurrency || 4,
    taskTimeout: 10000,
    enableAutoScaling: true
  }
}

/**
 * Performance Monitor Implementation
 */
const createPerformanceMonitor = (config: OptimizedRuntimeConfig) =>
  Effect.gen(function* () {
    const isMonitoring = yield* Ref.make(false)
    const metrics = yield* Ref.make({
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      poolUtilization: {} as Record<string, number>,
      resourceCacheHitRate: 0
    })

    const updateMetrics = Effect.gen(function* () {
      const poolManager = yield* OptimizedMemoryPool
      const resourceManager = yield* OptimizedResourceManager

      const fps = yield* FPSCounter.getCurrentFPS()
      const fpsStats = yield* FPSCounter.getStats()
      const memorySnapshot = yield* MemoryDetector.getCurrentUsage()
      const poolStats = yield* poolManager.getPoolStats()
      const resourceStats = yield* resourceManager.getStats()

      const poolUtilization: Record<string, number> = {
        entities: poolStats.entities.inUse / Math.max(poolStats.entities.total, 1),
        particles: poolStats.particles.inUse / Math.max(poolStats.particles.total, 1),
        chunkData: poolStats.chunkData.inUse / Math.max(poolStats.chunkData.total, 1)
      }

      // Add component pool utilization
      for (const [name, stats] of poolStats.components) {
        poolUtilization[`component_${name}`] = stats.inUse / Math.max(stats.total, 1)
      }

      yield* Ref.set(metrics, {
        fps,
        frameTime: fpsStats.averageFrameTime,
        memoryUsage: memorySnapshot?.usedJSHeapSize || 0,
        poolUtilization,
        resourceCacheHitRate: resourceStats.cacheStats.hitRate
      })

      // Record metrics for analysis
      yield* Metrics.recordGauge('runtime.fps', fps, 'fps')
      yield* Metrics.recordGauge('runtime.frame_time', fpsStats.averageFrameTime, 'ms')
      yield* Metrics.recordGauge('runtime.memory_usage', memorySnapshot?.usedJSHeapSize || 0, 'bytes')
      yield* Metrics.recordGauge('runtime.resource_cache_hit_rate', resourceStats.cacheStats.hitRate, 'ratio')

      // Record pool utilization metrics
      for (const [poolName, utilization] of Object.entries(poolUtilization)) {
        yield* Metrics.recordGauge(`runtime.pool_utilization.${poolName}`, utilization, 'ratio')
      }
    })

    const monitoringLoop = updateMetrics.pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(1))),
      Effect.fork
    )

    return {
      startMonitoring: () =>
        Effect.gen(function* () {
          const running = yield* Ref.get(isMonitoring)
          if (running) return

          yield* Ref.set(isMonitoring, true)
          yield* monitoringLoop
          yield* Effect.log('Performance monitoring started')
        }),

      stopMonitoring: () =>
        Effect.gen(function* () {
          yield* Ref.set(isMonitoring, false)
          yield* Effect.log('Performance monitoring stopped')
        }),

      getMetrics: () => Ref.get(metrics),

      generateReport: () =>
        Effect.gen(function* () {
          const currentMetrics = yield* Ref.get(metrics)
          const healthCheck = yield* PerformanceHealthCheck.runHealthCheck()
          const dashboardReport = yield* PerformanceDashboard.generateReport()

          let report = '🚀 Optimized Runtime Performance Report\n'
          report += '═'.repeat(70) + '\n\n'

          // Current metrics
          report += '📊 Current Performance Metrics\n'
          report += '─'.repeat(35) + '\n'
          report += `FPS: ${currentMetrics.fps}\n`
          report += `Frame Time: ${currentMetrics.frameTime.toFixed(2)}ms\n`
          report += `Memory Usage: ${(currentMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`
          report += `Resource Cache Hit Rate: ${(currentMetrics.resourceCacheHitRate * 100).toFixed(1)}%\n\n`

          // Pool utilization
          report += '🎱 Memory Pool Utilization\n'
          report += '─'.repeat(30) + '\n'
          for (const [pool, utilization] of Object.entries(currentMetrics.poolUtilization)) {
            const percentage = (utilization * 100).toFixed(1)
            const status = utilization > 0.8 ? '🔴' : utilization > 0.6 ? '🟡' : '🟢'
            report += `${status} ${pool}: ${percentage}%\n`
          }
          report += '\n'

          // Health check
          report += '🏥 System Health\n'
          report += '─'.repeat(20) + '\n'
          const healthEmoji = healthCheck.overall === 'healthy' ? '✅' :
                             healthCheck.overall === 'warning' ? '⚠️' : '🔥'
          report += `Overall Status: ${healthEmoji} ${healthCheck.overall.toUpperCase()}\n`
          
          if (healthCheck.issues.length > 0) {
            report += '\nIssues:\n'
            for (const issue of healthCheck.issues) {
              report += `  ❌ ${issue}\n`
            }
          }
          
          if (healthCheck.recommendations.length > 0) {
            report += '\nRecommendations:\n'
            for (const rec of healthCheck.recommendations) {
              report += `  💡 ${rec}\n`
            }
          }
          report += '\n'

          // Detailed dashboard
          report += dashboardReport

          return report
        })
    }
  })

/**
 * Quality Controller Implementation
 */
const createQualityController = (config: OptimizedRuntimeConfig) =>
  Effect.gen(function* () {
    const currentQuality = yield* Ref.make({
      renderDistance: 8,
      particleDensity: 1.0,
      shadowQuality: 'medium' as const,
      textureQuality: 'medium' as const
    })

    const qualityPresets = {
      low: {
        renderDistance: 4,
        particleDensity: 0.5,
        shadowQuality: 'low' as const,
        textureQuality: 'low' as const
      },
      medium: {
        renderDistance: 8,
        particleDensity: 1.0,
        shadowQuality: 'medium' as const,
        textureQuality: 'medium' as const
      },
      high: {
        renderDistance: 12,
        particleDensity: 1.5,
        shadowQuality: 'high' as const,
        textureQuality: 'high' as const
      },
      ultra: {
        renderDistance: 16,
        particleDensity: 2.0,
        shadowQuality: 'ultra' as const,
        textureQuality: 'ultra' as const
      }
    }

    return {
      adjustQuality: (targetFPS: number) =>
        Effect.gen(function* () {
          const currentFPS = yield* FPSCounter.getCurrentFPS()
          const quality = yield* Ref.get(currentQuality)
          
          if (currentFPS < targetFPS * 0.8) {
            // Reduce quality
            const newQuality = {
              ...quality,
              renderDistance: Math.max(quality.renderDistance - 2, 4),
              particleDensity: Math.max(quality.particleDensity - 0.25, 0.25)
            }
            
            yield* Ref.set(currentQuality, newQuality)
            yield* Effect.logInfo('Quality reduced to improve performance')
          } else if (currentFPS > targetFPS * 1.1) {
            // Increase quality
            const newQuality = {
              ...quality,
              renderDistance: Math.min(quality.renderDistance + 2, 16),
              particleDensity: Math.min(quality.particleDensity + 0.25, 2.0)
            }
            
            yield* Ref.set(currentQuality, newQuality)
            yield* Effect.logInfo('Quality increased due to good performance')
          }
        }),

      getCurrentQuality: () => Ref.get(currentQuality),

      setQualityPreset: (preset: 'low' | 'medium' | 'high' | 'ultra') =>
        Effect.gen(function* () {
          const newQuality = qualityPresets[preset]
          yield* Ref.set(currentQuality, newQuality)
          yield* Effect.logInfo(`Quality preset set to: ${preset}`)
        })
    }
  })

/**
 * Worker Coordinator Implementation (simplified)
 */
const createWorkerCoordinator = (config: OptimizedRuntimeConfig) =>
  Effect.gen(function* () {
    const workerStats = yield* Ref.make({
      activeWorkers: 0,
      queuedTasks: 0,
      averageTaskTime: 0
    })

    return {
      distributeTask: <T>(task: { type: string; data: any }, priority: 'high' | 'normal' | 'low') =>
        Effect.gen(function* () {
          // Simplified implementation - in real world would use actual workers
          yield* Effect.logInfo(`Distributing ${priority} priority task: ${task.type}`)
          return {} as T
        }),

      getWorkerStats: () => Ref.get(workerStats),

      terminateIdleWorkers: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('Terminating idle workers')
        })
    }
  })

/**
 * Main Optimized Runtime Layer
 */
export const OptimizedRuntimeLayer = (config: OptimizedRuntimeConfig = defaultOptimizedConfig) =>
  Layer.mergeAll(
    // Memory Pool Layer
    Layer.effect(OptimizedMemoryPool, createMemoryPoolManager()),
    
    // Resource Manager Layer
    Layer.effect(OptimizedResourceManager, createResourceManager(config.resourceManager)),
    
    // Performance Monitor Layer
    Layer.effect(PerformanceMonitor, createPerformanceMonitor(config)),
    
    // Quality Controller Layer
    Layer.effect(QualityController, createQualityController(config)),
    
    // Worker Coordinator Layer
    Layer.effect(WorkerCoordinator, createWorkerCoordinator(config))
  )

/**
 * Optimized Runtime Startup
 */
export const startOptimizedRuntime = <E, R>(
  systems: ReadonlyArray<PrioritizedSystem<E, R>>,
  config: OptimizedRuntimeConfig = defaultOptimizedConfig
): Effect.Effect<void, E, R | OptimizedMemoryPool | OptimizedResourceManager | PerformanceMonitor | QualityController | Clock | Stats> =>
  Effect.gen(function* () {
    yield* Effect.log('🚀 Starting Optimized TypeScript Minecraft Runtime...')

    // Initialize performance monitoring
    if (config.monitoring.enableProfiling) {
      yield* startPerformanceMonitoring()
    }

    // Start memory pool monitoring
    const poolManager = yield* OptimizedMemoryPool
    yield* poolManager.prewarm()
    
    const poolMonitoring = monitorPoolPerformance().pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(10))),
      Effect.fork
    )
    yield* poolMonitoring

    // Start performance monitoring
    const monitor = yield* PerformanceMonitor
    yield* monitor.startMonitoring()

    // Set initial quality
    const qualityController = yield* QualityController
    yield* qualityController.setQualityPreset(config.quality.initial)

    // Start adaptive quality adjustment
    if (config.quality.adaptive) {
      const adaptiveQuality = qualityController.adjustQuality(config.quality.targetFPS).pipe(
        Effect.repeat(Schedule.fixed(Duration.seconds(5))),
        Effect.fork
      )
      yield* adaptiveQuality
    }

    // Start predictive preloading
    const resourceManager = yield* OptimizedResourceManager
    const preloader = predictivePreloader(
      { x: 0, z: 0 }, // Initial position
      config.resourceManager
    ).pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(2))),
      Effect.fork
    )
    yield* preloader

    // Generate periodic reports
    const reportGenerator = monitor.generateReport().pipe(
      Effect.tap(report => Effect.log(report)),
      Effect.repeat(Schedule.fixed(Duration.millis(config.monitoring.reportInterval))),
      Effect.fork
    )
    yield* reportGenerator

    // Start the optimized game loop
    yield* optimizedGameLoop(systems, config.gameLoop)

    yield* Effect.log('✅ Optimized Runtime fully initialized and running!')
  })

/**
 * Runtime Performance Benchmark
 */
export const benchmarkOptimizedRuntime = (): Effect.Effect<{
  fps: number
  memoryEfficiency: number
  resourceCachePerformance: number
  poolEfficiency: number
  overallScore: number
}, never, OptimizedMemoryPool | OptimizedResourceManager | PerformanceMonitor> =>
  Effect.gen(function* () {
    yield* Effect.log('🔬 Starting Runtime Performance Benchmark...')

    const monitor = yield* PerformanceMonitor

    // Run benchmark for 30 seconds
    const benchmarkDuration = 30000
    const startTime = Date.now()

    // Collect metrics during benchmark
    const metricsCollection: Array<any> = []
    
    const collectMetrics = Effect.gen(function* () {
      const metrics = yield* monitor.getMetrics()
      metricsCollection.push({
        timestamp: Date.now(),
        ...metrics
      })
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(1))),
      Effect.timeout(Duration.millis(benchmarkDuration))
    )

    yield* collectMetrics

    // Calculate scores
    const avgFPS = metricsCollection.reduce((sum, m) => sum + m.fps, 0) / metricsCollection.length
    const avgMemoryUsage = metricsCollection.reduce((sum, m) => sum + m.memoryUsage, 0) / metricsCollection.length
    const avgCacheHitRate = metricsCollection.reduce((sum, m) => sum + m.resourceCacheHitRate, 0) / metricsCollection.length
    
    // Calculate pool efficiency
    const poolEfficiencyScores = Object.values(metricsCollection[0]?.poolUtilization || {}).map((util: any) => 
      util > 0.9 ? 0.5 : util > 0.7 ? 0.8 : util < 0.1 ? 0.3 : 1.0
    )
    const avgPoolEfficiency = poolEfficiencyScores.reduce((sum, score) => sum + score, 0) / Math.max(poolEfficiencyScores.length, 1)

    const benchmark = {
      fps: avgFPS,
      memoryEfficiency: Math.min(1.0, (256 * 1024 * 1024) / avgMemoryUsage), // Efficiency relative to 256MB
      resourceCachePerformance: avgCacheHitRate,
      poolEfficiency: avgPoolEfficiency,
      overallScore: 0
    }

    // Calculate overall score (0-1 scale)
    benchmark.overallScore = (
      (Math.min(benchmark.fps, 60) / 60) * 0.4 + // FPS weight: 40%
      benchmark.memoryEfficiency * 0.25 +         // Memory weight: 25%
      benchmark.resourceCachePerformance * 0.2 +  // Cache weight: 20%
      benchmark.poolEfficiency * 0.15             // Pool weight: 15%
    )

    yield* Effect.log(`🎯 Benchmark Results:`)
    yield* Effect.log(`  FPS: ${benchmark.fps.toFixed(1)}`)
    yield* Effect.log(`  Memory Efficiency: ${(benchmark.memoryEfficiency * 100).toFixed(1)}%`)
    yield* Effect.log(`  Cache Hit Rate: ${(benchmark.resourceCachePerformance * 100).toFixed(1)}%`)
    yield* Effect.log(`  Pool Efficiency: ${(benchmark.poolEfficiency * 100).toFixed(1)}%`)
    yield* Effect.log(`  Overall Score: ${(benchmark.overallScore * 100).toFixed(1)}/100`)

    return benchmark
  })

/**
 * Export utility functions
 */
export { monitorPoolPerformance } from './memory-pools'
export { withResourceManager, predictivePreloader } from './resource-manager'
export { 
  PrioritizedSystem,
  GameLoopConfig,
  optimizedGameLoop,
  createOptimizedTick 
} from './loop'