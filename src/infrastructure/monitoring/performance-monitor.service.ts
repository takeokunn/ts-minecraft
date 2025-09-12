/**
 * Performance Monitor Service - Effect-TS Implementation
 *
 * Converted from class-based implementation to functional Effect-TS service
 * Features:
 * - Real-time performance metrics collection
 * - Frame-by-frame analysis and profiling
 * - Memory usage tracking
 * - System bottleneck detection
 * - Performance regression alerts
 * - Adaptive quality adjustment
 * - Historical performance data
 */

import { Effect, Context, Layer, Option, Ref, Schema } from 'effect'

/**
 * Performance metric types
 */
export type PerformanceMetricType =
  | 'execution_time'
  | 'memory_usage'
  | 'cpu_usage'
  | 'frame_time'
  | 'query_performance'
  | 'communication_overhead'
  | 'garbage_collection'
  | 'entity_count'
  | 'system_load'

/**
 * Performance metric
 */
export interface PerformanceMetric {
  readonly type: PerformanceMetricType
  readonly systemId: string
  readonly value: number
  readonly unit: string
  readonly timestamp: number
  readonly frameId: number
  readonly metadata?: Record<string, any>
}

/**
 * Performance threshold
 */
export interface PerformanceThreshold {
  readonly metricType: PerformanceMetricType
  readonly systemId?: string // undefined for global thresholds
  readonly warningValue: number
  readonly criticalValue: number
  readonly enabled: boolean
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  readonly id: string
  readonly level: 'warning' | 'critical'
  readonly metric: PerformanceMetric
  readonly threshold: PerformanceThreshold
  readonly timestamp: number
  readonly resolved: boolean
  readonly description: string
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  readonly metricType: PerformanceMetricType
  readonly systemId: string
  readonly count: number
  readonly min: number
  readonly max: number
  readonly average: number
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly standardDeviation: number
  readonly trend: 'improving' | 'degrading' | 'stable'
}

/**
 * System performance profile
 */
export interface SystemPerformanceProfile {
  readonly systemId: string
  readonly executionTime: PerformanceStats
  readonly memoryUsage: PerformanceStats
  readonly queryPerformance: PerformanceStats
  readonly bottleneckScore: number
  readonly recommendations: readonly string[]
}

/**
 * Frame performance summary
 */
export interface FramePerformanceSummary {
  readonly frameId: number
  readonly timestamp: number
  readonly totalFrameTime: number
  readonly targetFrameTime: number
  readonly frameRate: number
  readonly systemBreakdown: Map<string, number>
  readonly bottleneckSystem: Option.Option<string>
  readonly qualityLevel: 'low' | 'medium' | 'high' | 'ultra'
  readonly recommendedQuality: 'low' | 'medium' | 'high' | 'ultra'
}

/**
 * Performance monitor configuration
 */
export interface PerformanceMonitorConfig {
  readonly enabled: boolean
  readonly collectFrameMetrics: boolean
  readonly collectMemoryMetrics: boolean
  readonly collectQueryMetrics: boolean
  readonly collectCommunicationMetrics: boolean
  readonly historySize: number
  readonly alertThresholds: readonly PerformanceThreshold[]
  readonly targetFrameRate: number
  readonly enableAutomaticOptimization: boolean
  readonly enableRegressionDetection: boolean
  readonly metricsRetentionMs: number
}

/**
 * Performance monitor errors
 */
export class PerformanceMonitorError extends Schema.TaggedError<PerformanceMonitorError>()('PerformanceMonitorError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * Performance Monitor Service interface
 */
export interface PerformanceMonitorService {
  readonly startFrame: (frameId: number) => Effect.Effect<void>
  readonly startSystem: (systemId: string) => Effect.Effect<void>
  readonly endSystem: (systemId: string) => Effect.Effect<void>
  readonly endFrame: () => Effect.Effect<FramePerformanceSummary>
  readonly recordMetric: (type: PerformanceMetricType, systemId: string, value: number, unit: string, metadata?: Record<string, any>) => Effect.Effect<void>
  readonly getSystemStats: (systemId: string, type: PerformanceMetricType) => Effect.Effect<Option.Option<PerformanceStats>>
  readonly getSystemProfile: (systemId: string) => Effect.Effect<SystemPerformanceProfile>
  readonly getActiveAlerts: () => Effect.Effect<readonly PerformanceAlert[]>
  readonly getFrameHistory: (count?: number) => Effect.Effect<readonly FramePerformanceSummary[]>
  readonly getMetrics: (systemId: string, type: PerformanceMetricType) => Effect.Effect<readonly PerformanceMetric[]>
}

/**
 * Performance Monitor Service tag
 */
export const PerformanceMonitorService = Context.GenericTag<PerformanceMonitorService>('PerformanceMonitorService')

/**
 * Default performance monitor configuration
 */
export const defaultPerformanceMonitorConfig: PerformanceMonitorConfig = {
  enabled: true,
  collectFrameMetrics: true,
  collectMemoryMetrics: true,
  collectQueryMetrics: true,
  collectCommunicationMetrics: true,
  historySize: 3600, // 1 minute at 60fps
  alertThresholds: [
    { metricType: 'execution_time', warningValue: 8, criticalValue: 16, enabled: true },
    { metricType: 'frame_time', warningValue: 20, criticalValue: 33, enabled: true },
    { metricType: 'memory_usage', warningValue: 512, criticalValue: 1024, enabled: true },
    { metricType: 'query_performance', warningValue: 5, criticalValue: 10, enabled: true },
  ],
  targetFrameRate: 60,
  enableAutomaticOptimization: true,
  enableRegressionDetection: true,
  metricsRetentionMs: 300000, // 5 minutes
}

/**
 * Performance Monitor Service Live implementation
 */
export const PerformanceMonitorServiceLive = (config: PerformanceMonitorConfig = defaultPerformanceMonitorConfig) =>
  Layer.effect(
    PerformanceMonitorService,
    Effect.gen(function* () {
      const metricsRef = yield* Ref.make<Map<string, PerformanceMetric[]>>(new Map())
      const statsRef = yield* Ref.make<Map<string, PerformanceStats>>(new Map())
      const alertsRef = yield* Ref.make<PerformanceAlert[]>([])
      const frameHistoryRef = yield* Ref.make<FramePerformanceSummary[]>([])
      const frameStartTimeRef = yield* Ref.make<number>(0)
      const systemStartTimesRef = yield* Ref.make<Map<string, number>>(new Map())
      const currentFrameIdRef = yield* Ref.make<number>(0)
      const qualityLevelRef = yield* Ref.make<'low' | 'medium' | 'high' | 'ultra'>('high')

      /**
       * Calculate performance trend
       */
      const calculateTrend = (values: number[]): 'improving' | 'degrading' | 'stable' => {
        if (values.length < 10) return 'stable'

        const recentValues = values.slice(-10)
        const earlierValues = values.slice(-20, -10)

        if (earlierValues.length === 0) return 'stable'

        const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
        const earlierAvg = earlierValues.reduce((sum, val) => sum + val, 0) / earlierValues.length

        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100

        if (changePercent < -5) return 'improving' // Lower values are better for most metrics
        if (changePercent > 5) return 'degrading'
        return 'stable'
      }

      /**
       * Update statistics for metric key
       */
      const updateStats = (key: string, metrics: PerformanceMetric[]) =>
        Effect.gen(function* () {
          if (metrics.length === 0) return

          const values = metrics.map((m) => m.value)
          const sorted = [...values].sort((a, b) => a - b)

          const min = Math.min(...values)
          const max = Math.max(...values)
          const average = values.reduce((sum, val) => sum + val, 0) / values.length
          const median = sorted[Math.floor(sorted.length / 2)]
          const p95 = sorted[Math.floor(sorted.length * 0.95)]
          const p99 = sorted[Math.floor(sorted.length * 0.99)]

          // Calculate standard deviation
          const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length
          const standardDeviation = Math.sqrt(variance)

          // Calculate trend
          const trend = calculateTrend(values)

          const lastMetric = metrics[metrics.length - 1]!

          const stats: PerformanceStats = {
            metricType: lastMetric.type,
            systemId: lastMetric.systemId,
            count: values.length,
            min,
            max,
            average,
            median,
            p95,
            p99,
            standardDeviation,
            trend,
          }

          yield* Ref.update(statsRef, (statsMap) => {
            const updated = new Map(statsMap)
            updated.set(key, stats)
            return updated
          })
        })

      /**
       * Cleanup old metrics
       */
      const cleanupOldMetrics = Effect.gen(function* () {
        const cutoffTime = Date.now() - config.metricsRetentionMs

        yield* Ref.update(metricsRef, (metricsMap) => {
          const updated = new Map(metricsMap)

          for (const [key, metricList] of updated) {
            const filteredMetrics = metricList.filter((metric) => metric.timestamp > cutoffTime)
            updated.set(key, filteredMetrics)
          }

          return updated
        })
      })

      /**
       * Add performance metric
       */
      const addMetric = (metric: PerformanceMetric) =>
        Effect.gen(function* () {
          const key = `${metric.systemId}_${metric.type}`

          yield* Ref.update(metricsRef, (metricsMap) => {
            const updated = new Map(metricsMap)

            if (!updated.has(key)) {
              updated.set(key, [])
            }

            const metricList = updated.get(key)!
            const newMetricList = [...metricList, metric]

            // Limit history size
            if (newMetricList.length > config.historySize) {
              newMetricList.shift()
            }

            updated.set(key, newMetricList)
            return updated
          })

          // Update statistics
          const metrics = yield* Ref.get(metricsRef)
          const updatedMetrics = metrics.get(key) || []
          yield* updateStats(key, updatedMetrics)

          // Cleanup old metrics
          yield* cleanupOldMetrics
        })

      /**
       * Check performance thresholds and create alerts
       */
      const checkThresholds = (metric: PerformanceMetric) =>
        Effect.gen(function* () {
          for (const threshold of config.alertThresholds) {
            if (!threshold.enabled) continue
            if (threshold.metricType !== metric.type) continue
            if (threshold.systemId && threshold.systemId !== metric.systemId) continue

            let level: 'warning' | 'critical' | null = null

            if (metric.value >= threshold.criticalValue) {
              level = 'critical'
            } else if (metric.value >= threshold.warningValue) {
              level = 'warning'
            }

            if (level) {
              const alert: PerformanceAlert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                level,
                metric,
                threshold,
                timestamp: Date.now(),
                resolved: false,
                description: `${metric.systemId} ${metric.type} (${metric.value}${metric.unit}) exceeded ${level} threshold (${level === 'critical' ? threshold.criticalValue : threshold.warningValue}${metric.unit})`,
              }

              yield* Ref.update(alertsRef, (alerts) => {
                const updated = [...alerts, alert]
                // Limit alert history
                return updated.length > 100 ? updated.slice(-100) : updated
              })
            }
          }
        })

      /**
       * Find bottleneck system from frame breakdown
       */
      const findBottleneckSystem = (systemBreakdown: Map<string, number>): Option.Option<string> => {
        if (systemBreakdown.size === 0) return Option.none()

        let maxTime = 0
        let bottleneckSystem = ''

        for (const [systemId, time] of systemBreakdown) {
          if (time > maxTime) {
            maxTime = time
            bottleneckSystem = systemId
          }
        }

        return bottleneckSystem ? Option.some(bottleneckSystem) : Option.none()
      }

      /**
       * Calculate recommended quality level based on performance
       */
      const calculateRecommendedQuality = (frameTime: number, targetFrameTime: number): 'low' | 'medium' | 'high' | 'ultra' => {
        const ratio = frameTime / targetFrameTime

        if (ratio > 2.0) return 'low' // Running at <30fps, need low quality
        if (ratio > 1.5) return 'medium' // Running at ~40fps, use medium quality
        if (ratio > 1.1) return 'high' // Running at ~55fps, use high quality
        return 'ultra' // Running at 60fps+, can use ultra quality
      }

      /**
       * Adjust quality level
       */
      const adjustQualityLevel = (newQuality: 'low' | 'medium' | 'high' | 'ultra') =>
        Effect.gen(function* () {
          const currentQuality = yield* Ref.get(qualityLevelRef)
          if (newQuality === currentQuality) return

          console.log(`Performance Monitor: Adjusting quality level from ${currentQuality} to ${newQuality}`)
          yield* Ref.set(qualityLevelRef, newQuality)

          // Here you would send messages to systems to adjust their quality settings
          // This would integrate with the communication hub
        })

      /**
       * Calculate bottleneck score for a system
       */
      const calculateBottleneckScore = (systemId: string) =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(statsRef)
          const executionStats = stats.get(`${systemId}_execution_time`)

          if (!executionStats) return 0

          // Higher score = more likely to be a bottleneck
          // Based on average execution time, trend, and variance
          let score = executionStats.average / 10 // Base score from execution time

          // Add penalty for degrading performance
          if (executionStats.trend === 'degrading') score += 20

          // Add penalty for high variance (inconsistent performance)
          score += executionStats.standardDeviation / 5

          return Math.min(100, Math.max(0, score))
        })

      /**
       * Generate performance recommendations
       */
      const generateRecommendations = (
        systemId: string,
        executionTime: Option.Option<PerformanceStats>,
        memoryUsage: Option.Option<PerformanceStats>,
        queryPerformance: Option.Option<PerformanceStats>,
      ): string[] => {
        const recommendations: string[] = []

        if (Option.isSome(executionTime)) {
          const stats = executionTime.value

          if (stats.average > 10) {
            recommendations.push(`Consider optimizing ${systemId} execution time (avg: ${stats.average.toFixed(2)}ms)`)
          }

          if (stats.trend === 'degrading') {
            recommendations.push(`${systemId} performance is degrading, investigate recent changes`)
          }

          if (stats.standardDeviation > stats.average * 0.5) {
            recommendations.push(`${systemId} has inconsistent performance, check for frame spikes`)
          }
        }

        if (Option.isSome(queryPerformance)) {
          const stats = queryPerformance.value

          if (stats.average > 5) {
            recommendations.push(`Optimize queries in ${systemId} (avg: ${stats.average.toFixed(2)}ms)`)
          }
        }

        return recommendations
      }

      /**
       * Create empty stats placeholder
       */
      const createEmptyStats = (systemId: string, type: PerformanceMetricType): PerformanceStats => ({
        metricType: type,
        systemId,
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        standardDeviation: 0,
        trend: 'stable',
      })

      return PerformanceMonitorService.of({
        startFrame: (frameId: number) =>
          Effect.gen(function* () {
            yield* Ref.set(currentFrameIdRef, frameId)
            yield* Ref.set(frameStartTimeRef, performance.now())
          }),

        startSystem: (systemId: string) =>
          Effect.gen(function* () {
            if (!config.enabled) return
            yield* Ref.update(systemStartTimesRef, (times) => {
              const updated = new Map(times)
              updated.set(systemId, performance.now())
              return updated
            })
          }),

        endSystem: (systemId: string) =>
          Effect.gen(function* () {
            if (!config.enabled) return

            const startTimes = yield* Ref.get(systemStartTimesRef)
            const startTime = startTimes.get(systemId)
            if (!startTime) return

            const executionTime = performance.now() - startTime
            const currentFrameId = yield* Ref.get(currentFrameIdRef)

            const metric: PerformanceMetric = {
              type: 'execution_time',
              systemId,
              value: executionTime,
              unit: 'ms',
              timestamp: Date.now(),
              frameId: currentFrameId,
            }

            yield* addMetric(metric)
            yield* checkThresholds(metric)

            yield* Ref.update(systemStartTimesRef, (times) => {
              const updated = new Map(times)
              updated.delete(systemId)
              return updated
            })
          }),

        endFrame: () =>
          Effect.gen(function* () {
            const frameStartTime = yield* Ref.get(frameStartTimeRef)
            const frameTime = performance.now() - frameStartTime
            const targetFrameTime = 1000 / config.targetFrameRate
            const frameRate = 1000 / frameTime
            const currentFrameId = yield* Ref.get(currentFrameIdRef)

            // Collect system execution times from this frame
            const systemBreakdown = new Map<string, number>()
            const metrics = yield* Ref.get(metricsRef)

            for (const [key, metricList] of metrics) {
              if (key.endsWith('_execution_time')) {
                const systemId = key.replace('_execution_time', '')
                const currentFrameMetrics = metricList.filter((m) => m.frameId === currentFrameId)

                if (currentFrameMetrics.length > 0) {
                  const totalTime = currentFrameMetrics.reduce((sum, m) => sum + m.value, 0)
                  systemBreakdown.set(systemId, totalTime)
                }
              }
            }

            // Find bottleneck system
            const bottleneckSystem = findBottleneckSystem(systemBreakdown)

            // Determine recommended quality level
            const recommendedQuality = calculateRecommendedQuality(frameTime, targetFrameTime)
            const qualityLevel = yield* Ref.get(qualityLevelRef)

            const summary: FramePerformanceSummary = {
              frameId: currentFrameId,
              timestamp: Date.now(),
              totalFrameTime: frameTime,
              targetFrameTime,
              frameRate,
              systemBreakdown,
              bottleneckSystem,
              qualityLevel,
              recommendedQuality,
            }

            yield* Ref.update(frameHistoryRef, (history) => {
              const updated = [...history, summary]
              return updated.length > config.historySize ? updated.slice(-config.historySize) : updated
            })

            // Apply automatic optimization if enabled
            if (config.enableAutomaticOptimization && recommendedQuality !== qualityLevel) {
              yield* adjustQualityLevel(recommendedQuality)
            }

            return summary
          }),

        recordMetric: (type, systemId, value, unit, metadata) =>
          Effect.gen(function* () {
            if (!config.enabled) return

            const currentFrameId = yield* Ref.get(currentFrameIdRef)
            const metric: PerformanceMetric = {
              type,
              systemId,
              value,
              unit,
              timestamp: Date.now(),
              frameId: currentFrameId,
              metadata,
            }

            yield* addMetric(metric)
            yield* checkThresholds(metric)
          }),

        getSystemStats: (systemId: string, type: PerformanceMetricType) =>
          Effect.gen(function* () {
            const stats = yield* Ref.get(statsRef)
            const key = `${systemId}_${type}`
            return Option.fromNullable(stats.get(key))
          }),

        getSystemProfile: (systemId: string) =>
          Effect.gen(function* () {
            const stats = yield* Ref.get(statsRef)

            const executionTime = Option.fromNullable(stats.get(`${systemId}_execution_time`))
            const memoryUsage = Option.fromNullable(stats.get(`${systemId}_memory_usage`))
            const queryPerformance = Option.fromNullable(stats.get(`${systemId}_query_performance`))

            // Calculate bottleneck score
            const bottleneckScore = yield* calculateBottleneckScore(systemId)

            // Generate recommendations
            const recommendations = generateRecommendations(systemId, executionTime, memoryUsage, queryPerformance)

            return {
              systemId,
              executionTime: Option.isSome(executionTime) ? executionTime.value : createEmptyStats(systemId, 'execution_time'),
              memoryUsage: Option.isSome(memoryUsage) ? memoryUsage.value : createEmptyStats(systemId, 'memory_usage'),
              queryPerformance: Option.isSome(queryPerformance) ? queryPerformance.value : createEmptyStats(systemId, 'query_performance'),
              bottleneckScore,
              recommendations,
            }
          }),

        getActiveAlerts: () =>
          Effect.gen(function* () {
            const alerts = yield* Ref.get(alertsRef)
            return alerts.filter((alert) => !alert.resolved)
          }),

        getFrameHistory: (count = 60) =>
          Effect.gen(function* () {
            const history = yield* Ref.get(frameHistoryRef)
            return history.slice(-count)
          }),

        getMetrics: (systemId: string, type: PerformanceMetricType) =>
          Effect.gen(function* () {
            const metrics = yield* Ref.get(metricsRef)
            const key = `${systemId}_${type}`
            return metrics.get(key) || []
          }),
      })
    }),
  )

/**
 * Performance monitoring utilities
 */
export const PerformanceUtils = {
  /**
   * Create performance monitoring decorator for system functions
   */
  withPerformanceMonitoring:
    <Args extends readonly unknown[], Return, Error, Requirements>(systemId: string, originalMethod: (...args: Args) => Effect.Effect<Return, Error, Requirements>) =>
    (...args: Args): Effect.Effect<Return, Error, Requirements | PerformanceMonitorService> =>
      Effect.gen(function* () {
        const monitor = yield* PerformanceMonitorService

        yield* monitor.startSystem(systemId)

        const result = yield* Effect.ensuring(originalMethod(...args), monitor.endSystem(systemId))

        return result
      }),

  /**
   * Track memory usage
   */
  trackMemoryUsage: (systemId: string) =>
    Effect.gen(function* () {
      const monitor = yield* PerformanceMonitorService

      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memory = (performance as { memory: MemoryInfo }).memory
        yield* monitor.recordMetric('memory_usage', systemId, memory.usedJSHeapSize / 1024 / 1024, 'MB')
      }
    }),

  /**
   * Generate performance report
   */
  generatePerformanceReport: () =>
    Effect.gen(function* () {
      const monitor = yield* PerformanceMonitorService
      const frameHistory = yield* monitor.getFrameHistory(60)
      const alerts = yield* monitor.getActiveAlerts()

      let report = '=== Performance Report ===\n\n'

      if (frameHistory.length > 0) {
        const avgFrameTime = frameHistory.reduce((sum, f) => sum + f.totalFrameTime, 0) / frameHistory.length
        const avgFrameRate = frameHistory.reduce((sum, f) => sum + f.frameRate, 0) / frameHistory.length

        report += `Average Frame Time: ${avgFrameTime.toFixed(2)}ms\n`
        report += `Average Frame Rate: ${avgFrameRate.toFixed(1)} FPS\n`
        report += `Quality Level: ${frameHistory[frameHistory.length - 1]?.qualityLevel || 'unknown'}\n\n`
      }

      if (alerts.length > 0) {
        report += `Active Alerts (${alerts.length}):\n`
        for (const alert of alerts.slice(0, 5)) {
          report += `- [${alert.level.toUpperCase()}] ${alert.description}\n`
        }
        report += '\n'
      }

      return report
    }),
}

/**
 * Create performance monitor service with custom configuration
 */
export const createPerformanceMonitorService = (config: Partial<PerformanceMonitorConfig> = {}) => PerformanceMonitorServiceLive({ ...defaultPerformanceMonitorConfig, ...config })
