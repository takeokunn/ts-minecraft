/**
 * Performance Monitor - Next-Generation System Performance Analysis
 * 
 * Features:
 * - Real-time performance metrics collection
 * - Frame-by-frame analysis and profiling
 * - Memory usage tracking
 * - System bottleneck detection
 * - Performance regression alerts
 * - Adaptive quality adjustment
 * - Historical performance data
 */

import { Option } from 'effect'
import { SystemConfig, SystemContext } from './scheduler'



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
 * Performance data store
 */
class PerformanceDataStore {
  private metrics = new Map<string, PerformanceMetric[]>()
  private stats = new Map<string, PerformanceStats>()
  private alerts: PerformanceAlert[] = []
  private frameHistory: FramePerformanceSummary[] = []

  constructor(private config: PerformanceMonitorConfig) {}

  /**
   * Add performance metric
   */
  addMetric(metric: PerformanceMetric): void {
    const key = `${metric.systemId}_${metric.type}`
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metricList = this.metrics.get(key)!
    metricList.push(metric)
    
    // Limit history size
    if (metricList.length > this.config.historySize) {
      metricList.shift()
    }
    
    // Update statistics
    this.updateStats(key, metricList)
    
    // Cleanup old metrics
    this.cleanupOldMetrics()
  }

  /**
   * Get metrics for system and type
   */
  getMetrics(systemId: string, type: PerformanceMetricType): PerformanceMetric[] {
    const key = `${systemId}_${type}`
    return this.metrics.get(key) || []
  }

  /**
   * Get statistics for system and type
   */
  getStats(systemId: string, type: PerformanceMetricType): Option.Option<PerformanceStats> {
    const key = `${systemId}_${type}`
    const stats = this.stats.get(key)
    return stats ? Option.some(stats) : Option.none()
  }

  /**
   * Add performance alert
   */
  addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert)
    
    // Limit alert history
    if (this.alerts.length > 100) {
      this.alerts.shift()
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Add frame performance summary
   */
  addFrameSummary(summary: FramePerformanceSummary): void {
    this.frameHistory.push(summary)
    
    if (this.frameHistory.length > this.config.historySize) {
      this.frameHistory.shift()
    }
  }

  /**
   * Get recent frame summaries
   */
  getFrameHistory(count: number = 60): FramePerformanceSummary[] {
    return this.frameHistory.slice(-count)
  }

  /**
   * Update statistics for metric key
   */
  private updateStats(key: string, metrics: PerformanceMetric[]): void {
    if (metrics.length === 0) return

    const values = metrics.map(m => m.value)
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
    const trend = this.calculateTrend(values)
    
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
    
    this.stats.set(key, stats)
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
    if (values.length < 10) return 'stable'
    
    const recentValues = values.slice(-10)
    const earlierValues = values.slice(-20, -10)
    
    if (earlierValues.length === 0) return 'stable'
    
    const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length
    const earlierAvg = earlierValues.reduce((sum, val) => sum + val, 0) / earlierValues.length
    
    const changePercent = (recentAvg - earlierAvg) / earlierAvg * 100
    
    if (changePercent < -5) return 'improving' // Lower values are better for most metrics
    if (changePercent > 5) return 'degrading'
    return 'stable'
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionMs
    
    for (const [key, metricList] of this.metrics) {
      const filteredMetrics = metricList.filter(metric => metric.timestamp > cutoffTime)
      this.metrics.set(key, filteredMetrics)
    }
  }

  /**
   * Get all system IDs
   */
  getAllSystemIds(): string[] {
    const systemIds = new Set<string>()
    
    for (const key of this.metrics.keys()) {
      const systemId = key.split('_')[0]
      if (systemId) systemIds.add(systemId)
    }
    
    return Array.from(systemIds)
  }
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private dataStore: PerformanceDataStore
  private frameStartTime = 0
  private systemStartTimes = new Map<string, number>()
  private currentFrameId = 0
  private qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'high'

  constructor(private config: PerformanceMonitorConfig) {
    this.dataStore = new PerformanceDataStore(config)
  }

  /**
   * Start frame timing
   */
  startFrame(frameId: number): void {
    this.currentFrameId = frameId
    this.frameStartTime = performance.now()
  }

  /**
   * Start system timing
   */
  startSystem(systemId: string): void {
    if (!this.config.enabled) return
    this.systemStartTimes.set(systemId, performance.now())
  }

  /**
   * End system timing and record metric
   */
  endSystem(systemId: string): void {
    if (!this.config.enabled) return
    
    const startTime = this.systemStartTimes.get(systemId)
    if (!startTime) return
    
    const executionTime = performance.now() - startTime
    
    const metric: PerformanceMetric = {
      type: 'execution_time',
      systemId,
      value: executionTime,
      unit: 'ms',
      timestamp: Date.now(),
      frameId: this.currentFrameId,
    }
    
    this.dataStore.addMetric(metric)
    this.checkThresholds(metric)
    this.systemStartTimes.delete(systemId)
  }

  /**
   * End frame timing and generate summary
   */
  endFrame(): FramePerformanceSummary {
    const frameTime = performance.now() - this.frameStartTime
    const targetFrameTime = 1000 / this.config.targetFrameRate
    const frameRate = 1000 / frameTime
    
    // Collect system execution times from this frame
    const systemBreakdown = new Map<string, number>()
    const systemIds = this.dataStore.getAllSystemIds()
    
    for (const systemId of systemIds) {
      const recentMetrics = this.dataStore.getMetrics(systemId, 'execution_time')
      const currentFrameMetrics = recentMetrics.filter(m => m.frameId === this.currentFrameId)
      
      if (currentFrameMetrics.length > 0) {
        const totalTime = currentFrameMetrics.reduce((sum, m) => sum + m.value, 0)
        systemBreakdown.set(systemId, totalTime)
      }
    }
    
    // Find bottleneck system
    const bottleneckSystem = this.findBottleneckSystem(systemBreakdown)
    
    // Determine recommended quality level
    const recommendedQuality = this.calculateRecommendedQuality(frameTime, targetFrameTime)
    
    const summary: FramePerformanceSummary = {
      frameId: this.currentFrameId,
      timestamp: Date.now(),
      totalFrameTime: frameTime,
      targetFrameTime,
      frameRate,
      systemBreakdown,
      bottleneckSystem,
      qualityLevel: this.qualityLevel,
      recommendedQuality,
    }
    
    this.dataStore.addFrameSummary(summary)
    
    // Apply automatic optimization if enabled
    if (this.config.enableAutomaticOptimization && recommendedQuality !== this.qualityLevel) {
      this.adjustQualityLevel(recommendedQuality)
    }
    
    return summary
  }

  /**
   * Record custom metric
   */
  recordMetric(
    type: PerformanceMetricType,
    systemId: string,
    value: number,
    unit: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled) return
    
    const metric: PerformanceMetric = {
      type,
      systemId,
      value,
      unit,
      timestamp: Date.now(),
      frameId: this.currentFrameId,
      metadata,
    }
    
    this.dataStore.addMetric(metric)
    this.checkThresholds(metric)
  }

  /**
   * Get performance statistics for system
   */
  getSystemStats(systemId: string, type: PerformanceMetricType): Option.Option<PerformanceStats> {
    return this.dataStore.getStats(systemId, type)
  }

  /**
   * Get system performance profile
   */
  getSystemProfile(systemId: string): SystemPerformanceProfile {
    const executionTime = this.dataStore.getStats(systemId, 'execution_time')
    const memoryUsage = this.dataStore.getStats(systemId, 'memory_usage')
    const queryPerformance = this.dataStore.getStats(systemId, 'query_performance')
    
    // Calculate bottleneck score
    const bottleneckScore = this.calculateBottleneckScore(systemId)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(systemId, executionTime, memoryUsage, queryPerformance)
    
    return {
      systemId,
      executionTime: executionTime._tag === 'Some' ? executionTime.value : this.createEmptyStats(systemId, 'execution_time'),
      memoryUsage: memoryUsage._tag === 'Some' ? memoryUsage.value : this.createEmptyStats(systemId, 'memory_usage'),
      queryPerformance: queryPerformance._tag === 'Some' ? queryPerformance.value : this.createEmptyStats(systemId, 'query_performance'),
      bottleneckScore,
      recommendations,
    }
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.dataStore.getActiveAlerts()
  }

  /**
   * Get frame performance history
   */
  getFrameHistory(count = 60): FramePerformanceSummary[] {
    return this.dataStore.getFrameHistory(count)
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.config.alertThresholds) {
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
        
        this.dataStore.addAlert(alert)
      }
    }
  }

  /**
   * Find bottleneck system from frame breakdown
   */
  private findBottleneckSystem(systemBreakdown: Map<string, number>): Option.Option<string> {
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
  private calculateRecommendedQuality(
    frameTime: number,
    targetFrameTime: number
  ): 'low' | 'medium' | 'high' | 'ultra' {
    const ratio = frameTime / targetFrameTime
    
    if (ratio > 2.0) return 'low'      // Running at <30fps, need low quality
    if (ratio > 1.5) return 'medium'   // Running at ~40fps, use medium quality
    if (ratio > 1.1) return 'high'     // Running at ~55fps, use high quality
    return 'ultra'                     // Running at 60fps+, can use ultra quality
  }

  /**
   * Adjust quality level
   */
  private adjustQualityLevel(newQuality: 'low' | 'medium' | 'high' | 'ultra'): void {
    if (newQuality === this.qualityLevel) return
    
    console.log(`Performance Monitor: Adjusting quality level from ${this.qualityLevel} to ${newQuality}`)
    this.qualityLevel = newQuality
    
    // Here you would send messages to systems to adjust their quality settings
    // This would integrate with the communication hub
  }

  /**
   * Calculate bottleneck score for a system
   */
  private calculateBottleneckScore(systemId: string): number {
    const executionStats = this.dataStore.getStats(systemId, 'execution_time')
    
    if (Option.isNone(executionStats)) return 0
    
    const stats = executionStats.value
    
    // Higher score = more likely to be a bottleneck
    // Based on average execution time, trend, and variance
    let score = stats.average / 10 // Base score from execution time
    
    // Add penalty for degrading performance
    if (stats.trend === 'degrading') score += 20
    
    // Add penalty for high variance (inconsistent performance)
    score += stats.standardDeviation / 5
    
    return Math.min(100, Math.max(0, score))
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    systemId: string,
    executionTime: Option.Option<PerformanceStats>,
    memoryUsage: Option.Option<PerformanceStats>,
    queryPerformance: Option.Option<PerformanceStats>
  ): string[] {
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
  private createEmptyStats(systemId: string, type: PerformanceMetricType): PerformanceStats {
    return {
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
    }
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor(defaultPerformanceMonitorConfig)

/**
 * Performance monitoring utilities
 */
export const PerformanceUtils = {
  /**
   * Create performance monitoring decorator for system functions
   */
  withPerformanceMonitoring: (
    systemId: string,
    monitor: PerformanceMonitor = globalPerformanceMonitor
  ) => {
    return <T extends (...args: any[]) => any>(originalMethod: T): T => {
      return ((...args: any[]) => {
        monitor.startSystem(systemId)
        
        try {
          const result = originalMethod(...args)
          
          // Handle both sync and async results
          if (result instanceof Promise || (result && typeof result.then === 'function')) {
            return result.finally(() => monitor.endSystem(systemId))
          } else {
            monitor.endSystem(systemId)
            return result
          }
        } catch (error) {
          monitor.endSystem(systemId)
          throw error
        }
      }) as T
    }
  },

  /**
   * Create memory usage tracker
   */
  trackMemoryUsage: (
    systemId: string,
    monitor: PerformanceMonitor = globalPerformanceMonitor
  ) => {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      monitor.recordMetric('memory_usage', systemId, memory.usedJSHeapSize / 1024 / 1024, 'MB')
    }
  },

  /**
   * Create query performance tracker
   */
  trackQueryPerformance: (
    systemId: string,
    queryName: string,
    executionTime: number,
    monitor: PerformanceMonitor = globalPerformanceMonitor
  ) => {
    monitor.recordMetric('query_performance', systemId, executionTime, 'ms', {
      queryName,
    })
  },

  /**
   * Create communication overhead tracker
   */
  trackCommunicationOverhead: (
    systemId: string,
    messageCount: number,
    totalTime: number,
    monitor: PerformanceMonitor = globalPerformanceMonitor
  ) => {
    monitor.recordMetric('communication_overhead', systemId, totalTime, 'ms', {
      messageCount,
      averageTimePerMessage: messageCount > 0 ? totalTime / messageCount : 0,
    })
  },

  /**
   * Generate performance report
   */
  generatePerformanceReport: (
    monitor: PerformanceMonitor = globalPerformanceMonitor
  ): string => {
    const frameHistory = monitor.getFrameHistory(60)
    const alerts = monitor.getActiveAlerts()
    
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
  },
}