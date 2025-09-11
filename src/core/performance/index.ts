/**
 * Comprehensive performance monitoring and measurement system
 * 
 * This module provides a complete suite of tools for monitoring and analyzing
 * performance in TypeScript Minecraft applications:
 * 
 * - Profile API: Automatic measurement with decorators
 * - Metrics Collection: Real-time metrics gathering and reporting
 * - Memory Leak Detection: Advanced memory usage analysis
 * - FPS Counter: Frame rate monitoring and stability analysis
 * - Object Pooling: Memory-efficient object reuse patterns
 */

// Core performance utilities
export {
  ObjectPool,
  EffectObjectPool,
  createEffectPool,
  PoolableObject,
  ObjectPoolConfig,
  PooledVector3,
  PooledMatrix4,
  PooledAABB,
  vector3Pool,
  matrix4Pool,
  aabbPool,
  withPooled,
  withPooledEffect
} from './object-pool'

// Profiling and measurement
export {
  Profile,
  ProfileMeasurement,
  ProfilerConfig,
  ProfilerState,
  initializeProfiler,
  measure,
  withProfiling,
  measureBatch
} from './profiler'

// Metrics collection and reporting
export {
  Metrics,
  MetricValue,
  MetricSeries,
  MetricType,
  MetricsConfig,
  MetricsSnapshot,
  SystemMetrics,
  initializeMetrics,
  timed,
  counted,
  withMetrics
} from './metrics'

// Memory leak detection
export {
  MemoryDetector,
  MemorySnapshot,
  MemoryLeak,
  MemoryLeakType,
  MemoryDetectorConfig,
  ObjectTracker,
  initializeMemoryDetector
} from './memory-detector'

// FPS monitoring and frame analysis
export {
  FPSCounter,
  FrameData,
  FrameDropEvent,
  FPSStats,
  FPSCounterConfig,
  initializeFPSCounter,
  withFPSTracking,
  requestAnimationFrameWithFPS,
  createFrameLoop
} from './fps-counter'

import { Effect } from 'effect'
import { initializeProfiler } from './profiler'
import { initializeMetrics } from './metrics'
import { initializeMemoryDetector } from './memory-detector'
import { initializeFPSCounter } from './fps-counter'

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  readonly profiler?: {
    readonly enableMemoryTracking?: boolean
    readonly enableConsoleOutput?: boolean
    readonly slowThreshold?: number
    readonly maxMeasurements?: number
  }
  readonly metrics?: {
    readonly maxSeriesLength?: number
    readonly retentionPeriod?: number
    readonly collectInterval?: number
    readonly enableAutoCollection?: boolean
  }
  readonly memoryDetector?: {
    readonly sampleInterval?: number
    readonly retentionPeriod?: number
    readonly growthThreshold?: number
    readonly spikeThreshold?: number
    readonly maxMemoryPercentage?: number
    readonly enableAutoDetection?: boolean
    readonly enableGCMonitoring?: boolean
  }
  readonly fpsCounter?: {
    readonly targetFPS?: number
    readonly sampleSize?: number
    readonly frameDropThreshold?: number
    readonly enableFrameDropDetection?: boolean
    readonly enableMetricsReporting?: boolean
    readonly unstableThreshold?: number
  }
}

/**
 * Initialize the complete performance monitoring system
 */
export const initializePerformanceMonitoring = (
  config?: PerformanceConfig
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* Effect.log('🚀 Initializing performance monitoring system...')
    
    // Initialize all subsystems
    yield* initializeProfiler(config?.profiler)
    yield* initializeMetrics(config?.metrics)
    yield* initializeMemoryDetector(config?.memoryDetector)
    yield* initializeFPSCounter(config?.fpsCounter)
    
    yield* Effect.log('✅ Performance monitoring system initialized')
  })

/**
 * Performance monitoring dashboard
 */
export const PerformanceDashboard = {
  /**
   * Generate a comprehensive performance report
   */
  generateReport: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const { Profile } = yield* Effect.succeed(require('./profiler'))
      const { Metrics } = yield* Effect.succeed(require('./metrics'))
      const { MemoryDetector } = yield* Effect.succeed(require('./memory-detector'))
      const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
      
      let report = '🎮 TypeScript Minecraft Performance Report\n'
      report += '═'.repeat(60) + '\n\n'
      
      // Profiling report
      const profileReport = yield* Profile.generateReport()
      report += profileReport + '\n'
      
      // Metrics dashboard
      const metricsReport = yield* Metrics.generateDashboard()
      report += metricsReport + '\n'
      
      // Memory analysis
      const memoryReport = yield* MemoryDetector.generateReport()
      report += memoryReport + '\n'
      
      // FPS analysis
      const fpsReport = yield* FPSCounter.generateReport()
      report += fpsReport
      
      return report
    }),
  
  /**
   * Get real-time performance metrics
   */
  getRealTimeMetrics: (): Effect.Effect<{
    fps: number
    memoryUsage: number
    memoryPercentage: number
    activeLeaks: number
    profiledOperations: number
  }, never, never> =>
    Effect.gen(function* () {
      const { Profile } = yield* Effect.succeed(require('./profiler'))
      const { MemoryDetector } = yield* Effect.succeed(require('./memory-detector'))
      const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
      
      const fps = yield* FPSCounter.getCurrentFPS()
      const memorySnapshot = yield* MemoryDetector.getCurrentUsage()
      const leaks = yield* MemoryDetector.getLeaks()
      const measurements = yield* Profile.getMeasurements()
      
      return {
        fps,
        memoryUsage: memorySnapshot?.usedJSHeapSize || 0,
        memoryPercentage: memorySnapshot?.percentage || 0,
        activeLeaks: leaks.length,
        profiledOperations: measurements.length
      }
    }),
  
  /**
   * Export performance data for external analysis
   */
  exportData: (): Effect.Effect<{
    profiling: any
    metrics: any
    memory: any
    fps: any
  }, never, never> =>
    Effect.gen(function* () {
      const { Profile } = yield* Effect.succeed(require('./profiler'))
      const { Metrics } = yield* Effect.succeed(require('./metrics'))
      const { MemoryDetector } = yield* Effect.succeed(require('./memory-detector'))
      const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
      
      const profiling = yield* Profile.getMeasurements()
      const metrics = yield* Metrics.getSnapshot()
      const memory = {
        usage: yield* MemoryDetector.getCurrentUsage(),
        history: yield* MemoryDetector.getHistory(),
        leaks: yield* MemoryDetector.getLeaks()
      }
      const fps = {
        stats: yield* FPSCounter.getStats(),
        frameData: yield* FPSCounter.getFrameData(100), // Last 100 frames
        frameDrops: yield* FPSCounter.getFrameDrops()
      }
      
      return {
        profiling,
        metrics,
        memory,
        fps
      }
    }),
  
  /**
   * Clear all performance data
   */
  clearAll: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      const { Profile } = yield* Effect.succeed(require('./profiler'))
      const { Metrics } = yield* Effect.succeed(require('./metrics'))
      const { MemoryDetector } = yield* Effect.succeed(require('./memory-detector'))
      const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
      
      yield* Profile.clear()
      yield* Metrics.clear()
      yield* MemoryDetector.clearLeaks()
      yield* FPSCounter.clear()
      
      yield* Effect.log('All performance data cleared')
    })
}

/**
 * Performance health check utilities
 */
export const PerformanceHealthCheck = {
  /**
   * Run a comprehensive health check
   */
  runHealthCheck: (): Effect.Effect<{
    overall: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  }, never, never> =>
    Effect.gen(function* () {
      const { MemoryDetector } = yield* Effect.succeed(require('./memory-detector'))
      const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
      
      const issues: string[] = []
      const recommendations: string[] = []
      
      // Memory health
      const memorySnapshot = yield* MemoryDetector.getCurrentUsage()
      const leaks = yield* MemoryDetector.getLeaks()
      
      if (memorySnapshot && memorySnapshot.percentage > 80) {
        issues.push(`High memory usage: ${memorySnapshot.percentage.toFixed(1)}%`)
        recommendations.push('Consider clearing caches or optimizing memory usage')
      }
      
      if (leaks.length > 0) {
        const criticalLeaks = leaks.filter(leak => leak.severity === 'critical')
        if (criticalLeaks.length > 0) {
          issues.push(`${criticalLeaks.length} critical memory leaks detected`)
          recommendations.push('Address critical memory leaks immediately')
        }
      }
      
      // FPS health
      const fpsStats = yield* FPSCounter.getStats()
      const isStable = yield* FPSCounter.isPerformanceStable()
      
      if (fpsStats.averageFPS < 30) {
        issues.push(`Low FPS: ${fpsStats.averageFPS} (target: 60)`)
        recommendations.push('Optimize rendering pipeline and reduce computational load')
      }
      
      if (!isStable) {
        issues.push('Unstable frame rate detected')
        recommendations.push('Investigate frame drops and optimize frame timing')
      }
      
      // Overall health assessment
      const overall: 'healthy' | 'warning' | 'critical' =
        issues.filter(issue => issue.includes('critical')).length > 0 ? 'critical' :
        issues.length > 2 ? 'warning' : 'healthy'
      
      return {
        overall,
        issues,
        recommendations
      }
    }),
  
  /**
   * Monitor performance continuously
   */
  startContinuousMonitoring: (
    onHealthChange?: (health: 'healthy' | 'warning' | 'critical') => void
  ): Effect.Effect<() => void, never, never> =>
    Effect.gen(function* () {
      let isMonitoring = true
      let lastHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
      
      const monitor = () => {
        if (!isMonitoring) return
        
        Effect.runSync(
          Effect.gen(function* () {
            const healthCheck = yield* PerformanceHealthCheck.runHealthCheck()
            
            if (healthCheck.overall !== lastHealth) {
              lastHealth = healthCheck.overall
              yield* Effect.log(`Performance health changed to: ${healthCheck.overall}`)
              
              if (onHealthChange) {
                onHealthChange(healthCheck.overall)
              }
            }
            
            // Schedule next check
            setTimeout(monitor, 10000) // Every 10 seconds
          })
        )
      }
      
      // Start monitoring
      monitor()
      
      // Return stop function
      return () => {
        isMonitoring = false
      }
    })
}

/**
 * Default performance configuration for TypeScript Minecraft
 */
export const defaultPerformanceConfig: PerformanceConfig = {
  profiler: {
    enableMemoryTracking: true,
    enableConsoleOutput: false,
    slowThreshold: 16, // 60fps threshold
    maxMeasurements: 1000
  },
  metrics: {
    maxSeriesLength: 1000,
    retentionPeriod: 5 * 60 * 1000, // 5 minutes
    collectInterval: 1000, // 1 second
    enableAutoCollection: true
  },
  memoryDetector: {
    sampleInterval: 5000, // 5 seconds
    retentionPeriod: 30 * 60 * 1000, // 30 minutes
    growthThreshold: 1024 * 1024, // 1MB per minute
    spikeThreshold: 25, // 25% increase
    maxMemoryPercentage: 80,
    enableAutoDetection: true,
    enableGCMonitoring: true
  },
  fpsCounter: {
    targetFPS: 60,
    sampleSize: 300, // 5 seconds at 60fps
    frameDropThreshold: 5, // 5ms over target
    enableFrameDropDetection: true,
    enableMetricsReporting: true,
    unstableThreshold: 10 // ±10 FPS variance
  }
}

/**
 * Quick start function for easy initialization
 */
export const startPerformanceMonitoring = (
  config: PerformanceConfig = defaultPerformanceConfig
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* initializePerformanceMonitoring(config)
    
    // Start FPS monitoring
    const { FPSCounter } = yield* Effect.succeed(require('./fps-counter'))
    yield* FPSCounter.start()
    
    yield* Effect.log('🎯 Performance monitoring is now active')
  })