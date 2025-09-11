/**
 * Centralized monitoring utilities for ts-minecraft
 * 
 * Provides performance monitoring, health checks, and metrics collection
 * across all application layers.
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'
import { Logger } from './logging'

// Performance metrics
export interface PerformanceMetrics {
  memory: {
    used: number
    total: number
    percentage: number
  }
  fps: {
    current: number
    average: number
    min: number
    max: number
  }
  timing: {
    frameTime: number
    updateTime: number
    renderTime: number
  }
  counts: {
    entities: number
    chunks: number
    activeQueries: number
  }
}

// Health check result
export interface HealthCheck {
  component: string
  status: 'healthy' | 'warning' | 'error'
  message?: string
  metrics?: Record<string, number>
  timestamp: Date
}

// System status
export interface SystemStatus {
  overall: 'healthy' | 'warning' | 'error'
  uptime: number
  checks: HealthCheck[]
  metrics: PerformanceMetrics
  timestamp: Date
}

// Monitoring configuration
export interface MonitoringConfig {
  enableMetrics: boolean
  enableHealthChecks: boolean
  metricsInterval: number // milliseconds
  healthCheckInterval: number // milliseconds
  component?: string
}

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMetrics: true,
  enableHealthChecks: true,
  metricsInterval: 1000, // 1 second
  healthCheckInterval: 5000, // 5 seconds
  component: 'Monitor',
}

// Monitoring state
class MonitoringState {
  private config: MonitoringConfig = DEFAULT_MONITORING_CONFIG
  private startTime: Date = new Date()
  private healthChecks: Map<string, HealthCheck> = new Map()
  private metrics: PerformanceMetrics = this.createEmptyMetrics()
  private metricsHistory: PerformanceMetrics[] = []
  private fpsBuffer: number[] = []

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      memory: { used: 0, total: 0, percentage: 0 },
      fps: { current: 0, average: 0, min: 0, max: 0 },
      timing: { frameTime: 0, updateTime: 0, renderTime: 0 },
      counts: { entities: 0, chunks: 0, activeQueries: 0 },
    }
  }

  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): MonitoringConfig {
    return { ...this.config }
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime()
  }

  updateHealthCheck(component: string, check: Omit<HealthCheck, 'timestamp'>): void {
    const fullCheck: HealthCheck = {
      ...check,
      timestamp: new Date(),
    }
    this.healthChecks.set(component, fullCheck)
  }

  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values())
  }

  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics }
    
    // Update FPS calculations
    if (metrics.fps?.current !== undefined) {
      this.fpsBuffer.push(metrics.fps.current)
      if (this.fpsBuffer.length > 60) { // Keep last 60 samples
        this.fpsBuffer.shift()
      }
      
      this.metrics.fps = {
        current: metrics.fps.current,
        average: this.fpsBuffer.reduce((sum, fps) => sum + fps, 0) / this.fpsBuffer.length,
        min: Math.min(...this.fpsBuffer),
        max: Math.max(...this.fpsBuffer),
      }
    }
    
    // Store metrics history
    this.metricsHistory.push({ ...this.metrics })
    if (this.metricsHistory.length > 100) { // Keep last 100 samples
      this.metricsHistory.shift()
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }
}

const monitoringState = new MonitoringState()

// Memory monitoring utilities
const getMemoryMetrics = (): Effect.Effect<PerformanceMetrics['memory'], never, never> =>
  Effect.sync(() => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      }
    }
    return { used: 0, total: 0, percentage: 0 }
  })

// Performance measurement utilities
const measureFrameTime = <T>(effect: Effect.Effect<T, any, any>): Effect.Effect<T, any, never> =>
  pipe(
    Effect.sync(() => performance.now()),
    Effect.flatMap(startTime =>
      pipe(
        effect,
        Effect.tap(() => {
          const frameTime = performance.now() - startTime
          monitoringState.updateMetrics({ 
            timing: { 
              ...monitoringState.getMetrics().timing, 
              frameTime 
            } 
          })
          return Effect.void
        })
      )
    )
  )

// Health check registry
const healthCheckRegistry: Map<string, () => Effect.Effect<HealthCheck, never, never>> = new Map()

// Register a health check function
export const registerHealthCheck = (
  component: string,
  checkFn: () => Effect.Effect<Omit<HealthCheck, 'timestamp'>, never, never>
): void => {
  healthCheckRegistry.set(component, () =>
    pipe(
      checkFn(),
      Effect.map(check => ({
        ...check,
        timestamp: new Date(),
      }))
    )
  )
}

// Performance monitor
export const PerformanceMonitor = {
  // Configuration
  configure: (config: Partial<MonitoringConfig>) => {
    monitoringState.updateConfig(config)
  },

  getConfig: () => monitoringState.getConfig(),

  // Metrics collection
  updateMetrics: (metrics: Partial<PerformanceMetrics>) =>
    Effect.sync(() => monitoringState.updateMetrics(metrics)),

  getMetrics: () => Effect.sync(() => monitoringState.getMetrics()),

  getMetricsHistory: () => Effect.sync(() => monitoringState.getMetricsHistory()),

  // Memory monitoring
  updateMemoryMetrics: () =>
    pipe(
      getMemoryMetrics(),
      Effect.tap(memory => Effect.sync(() => monitoringState.updateMetrics({ memory })))
    ),

  // FPS monitoring
  updateFPS: (fps: number) =>
    Effect.sync(() => monitoringState.updateMetrics({ fps: { current: fps, average: 0, min: 0, max: 0 } })),

  // Timing measurements
  measureFrame: measureFrameTime,

  measureUpdate: <T>(effect: Effect.Effect<T, any, any>) =>
    pipe(
      Effect.sync(() => performance.now()),
      Effect.flatMap(startTime =>
        pipe(
          effect,
          Effect.tap(() => {
            const updateTime = performance.now() - startTime
            monitoringState.updateMetrics({ 
              timing: { 
                ...monitoringState.getMetrics().timing, 
                updateTime 
              } 
            })
            return Effect.void
          })
        )
      )
    ),

  measureRender: <T>(effect: Effect.Effect<T, any, any>) =>
    pipe(
      Effect.sync(() => performance.now()),
      Effect.flatMap(startTime =>
        pipe(
          effect,
          Effect.tap(() => {
            const renderTime = performance.now() - startTime
            monitoringState.updateMetrics({ 
              timing: { 
                ...monitoringState.getMetrics().timing, 
                renderTime 
              } 
            })
            return Effect.void
          })
        )
      )
    ),

  // Count tracking
  updateCounts: (counts: Partial<PerformanceMetrics['counts']>) =>
    Effect.sync(() => {
      const currentMetrics = monitoringState.getMetrics()
      monitoringState.updateMetrics({
        counts: { ...currentMetrics.counts, ...counts }
      })
    }),
}

// Health monitoring
export const HealthMonitor = {
  // Health check registration and execution
  registerCheck: registerHealthCheck,

  runHealthCheck: (component: string) =>
    Effect.gen(function* (_) {
      const checkFn = healthCheckRegistry.get(component)
      if (!checkFn) {
        return {
          component,
          status: 'error' as const,
          message: 'Health check not registered',
          timestamp: new Date(),
        }
      }

      try {
        const result = yield* _(checkFn())
        monitoringState.updateHealthCheck(component, result)
        return result
      } catch (error) {
        const errorCheck = {
          component,
          status: 'error' as const,
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date(),
        }
        monitoringState.updateHealthCheck(component, errorCheck)
        return errorCheck
      }
    }),

  runAllHealthChecks: () =>
    Effect.gen(function* (_) {
      const components = Array.from(healthCheckRegistry.keys())
      const results: HealthCheck[] = []

      for (const component of components) {
        const result = yield* _(HealthMonitor.runHealthCheck(component))
        results.push(result)
      }

      return results
    }),

  getHealthStatus: () => Effect.sync(() => monitoringState.getHealthChecks()),

  // System status
  getSystemStatus: (): Effect.Effect<SystemStatus, never, never> =>
    Effect.gen(function* (_) {
      const healthChecks = yield* _(HealthMonitor.runAllHealthChecks())
      const metrics = monitoringState.getMetrics()

      const overall = healthChecks.some(check => check.status === 'error')
        ? 'error' as const
        : healthChecks.some(check => check.status === 'warning')
        ? 'warning' as const
        : 'healthy' as const

      return {
        overall,
        uptime: monitoringState.getUptime(),
        checks: healthChecks,
        metrics,
        timestamp: new Date(),
      }
    }),
}

// Monitoring decorators for common use cases
export const withMonitoring = <T>(
  operation: string,
  component?: string
) => (effect: Effect.Effect<T, any, any>): Effect.Effect<T, any, never> =>
  pipe(
    Effect.sync(() => performance.now()),
    Effect.flatMap(startTime =>
      pipe(
        effect,
        Effect.tap(result =>
          pipe(
            Logger.performance.start(operation, component).end({ result }),
            Effect.flatMap(() => {
              const duration = performance.now() - startTime
              if (duration > 16) { // Log slow operations (> 1 frame at 60fps)
                return Logger.warn(
                  `Slow operation detected: ${operation}`,
                  component,
                  { duration: `${duration.toFixed(2)}ms`, operation },
                  ['performance', 'slow']
                )
              }
              return Effect.void
            })
          )
        )
      )
    )
  )

// Component-specific monitor
export const createComponentMonitor = (component: string) => ({
  updateMetrics: (metrics: Partial<PerformanceMetrics>) =>
    PerformanceMonitor.updateMetrics(metrics),
  
  measureOperation: <T>(operation: string, effect: Effect.Effect<T, any, any>) =>
    withMonitoring(operation, component)(effect),
  
  registerHealthCheck: (checkFn: () => Effect.Effect<Omit<HealthCheck, 'timestamp'>, never, never>) =>
    registerHealthCheck(component, checkFn),
  
  log: Logger.withComponent(component),
})

// Built-in health checks
registerHealthCheck('Memory', () =>
  pipe(
    getMemoryMetrics(),
    Effect.map(memory => ({
      component: 'Memory',
      status: memory.percentage > 90 ? 'error' as const : memory.percentage > 70 ? 'warning' as const : 'healthy' as const,
      message: memory.percentage > 90 ? 'Memory usage critical' : memory.percentage > 70 ? 'Memory usage high' : 'Memory usage normal',
      metrics: { usage: memory.percentage, used: memory.used, total: memory.total },
    }))
  )
)

registerHealthCheck('Performance', () =>
  Effect.sync(() => {
    const metrics = monitoringState.getMetrics()
    const avgFps = metrics.fps.average
    
    return {
      component: 'Performance',
      status: avgFps < 30 ? 'error' as const : avgFps < 50 ? 'warning' as const : 'healthy' as const,
      message: avgFps < 30 ? 'Performance critical' : avgFps < 50 ? 'Performance degraded' : 'Performance normal',
      metrics: { fps: avgFps, frameTime: metrics.timing.frameTime },
    }
  })
)