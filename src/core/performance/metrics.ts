import { Effect, Ref, Schedule, pipe } from 'effect'

/**
 * Comprehensive metrics collection and reporting system
 * Tracks various performance metrics and provides real-time monitoring
 */

export interface MetricValue {
  readonly timestamp: number
  readonly value: number
  readonly labels?: Record<string, string>
}

export interface MetricSeries {
  readonly name: string
  readonly type: MetricType
  readonly unit: string
  readonly values: ReadonlyArray<MetricValue>
  readonly description: string
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer'

export interface MetricsConfig {
  readonly maxSeriesLength: number
  readonly retentionPeriod: number // milliseconds
  readonly collectInterval: number // milliseconds
  readonly enableAutoCollection: boolean
}

export interface MetricsSnapshot {
  readonly timestamp: number
  readonly series: ReadonlyMap<string, MetricSeries>
  readonly systemMetrics: SystemMetrics
}

export interface SystemMetrics {
  readonly memory: {
    readonly used: number
    readonly total: number
    readonly percentage: number
  } | null
  readonly fps: number | null
  readonly frameTime: number | null
  readonly gcPressure: number | null
}

/**
 * Metrics collector state
 */
interface MetricsState {
  readonly series: Map<string, MetricSeries>
  readonly lastCleanup: number
}

let metricsState: Ref.Ref<MetricsState> | null = null
let metricsConfig: MetricsConfig = {
  maxSeriesLength: 1000,
  retentionPeriod: 5 * 60 * 1000, // 5 minutes
  collectInterval: 1000, // 1 second
  enableAutoCollection: true
}

/**
 * Initialize the metrics system
 */
export const initializeMetrics = (config?: Partial<MetricsConfig>): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    metricsConfig = { ...metricsConfig, ...config }
    
    metricsState = yield* Ref.make<MetricsState>({
      series: new Map(),
      lastCleanup: Date.now()
    })
    
    if (metricsConfig.enableAutoCollection) {
      yield* startAutoCollection()
    }
    
    yield* Effect.log('Metrics system initialized')
  })

/**
 * Start automatic metrics collection
 */
const startAutoCollection = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const collectSystemMetrics = Effect.gen(function* () {
      yield* Metrics.recordGauge('system.memory.used', getMemoryUsage()?.used || 0, 'bytes')
      yield* Metrics.recordGauge('system.memory.percentage', getMemoryUsage()?.percentage || 0, 'percent')
      
      const fpsSample = getFPSSample()
      if (fpsSample) {
        yield* Metrics.recordGauge('system.fps', fpsSample.fps, 'fps')
        yield* Metrics.recordGauge('system.frame_time', fpsSample.frameTime, 'ms')
      }
      
      // Cleanup old metrics periodically
      yield* cleanupOldMetrics()
    })
    
    // Schedule collection
    yield* collectSystemMetrics.pipe(
      Effect.repeat(
        Schedule.fixed(`${metricsConfig.collectInterval} millis`)
      ),
      Effect.fork
    )
  })

/**
 * Get current memory usage
 */
const getMemoryUsage = (): { used: number; total: number; percentage: number } | null => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory
    const used = memory.usedJSHeapSize
    const total = memory.jsHeapSizeLimit
    return {
      used,
      total,
      percentage: (used / total) * 100
    }
  }
  return null
}

/**
 * Get FPS sample (requires external FPS counter)
 */
let lastFrameTime = performance.now()
let frameCount = 0
let fpsHistory: number[] = []

const getFPSSample = (): { fps: number; frameTime: number } | null => {
  const now = performance.now()
  const deltaTime = now - lastFrameTime
  frameCount++
  
  // Update FPS every second
  if (deltaTime >= 1000) {
    const fps = (frameCount * 1000) / deltaTime
    fpsHistory.push(fps)
    
    // Keep only last 10 samples
    if (fpsHistory.length > 10) {
      fpsHistory.shift()
    }
    
    const avgFps = fpsHistory.reduce((sum, f) => sum + f, 0) / fpsHistory.length
    const avgFrameTime = 1000 / avgFps
    
    frameCount = 0
    lastFrameTime = now
    
    return { fps: avgFps, frameTime: avgFrameTime }
  }
  
  return null
}

/**
 * Clean up old metrics data
 */
const cleanupOldMetrics = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsState) return
    
    const now = Date.now()
    const cutoff = now - metricsConfig.retentionPeriod
    
    yield* Ref.update(metricsState, state => {
      if (now - state.lastCleanup < 60000) { // Cleanup every minute
        return state
      }
      
      const cleanedSeries = new Map<string, MetricSeries>()
      
      for (const [name, series] of state.series.entries()) {
        const filteredValues = series.values.filter(v => v.timestamp > cutoff)
        
        if (filteredValues.length > 0) {
          cleanedSeries.set(name, {
            ...series,
            values: filteredValues
          })
        }
      }
      
      return {
        series: cleanedSeries,
        lastCleanup: now
      }
    })
  })

/**
 * Record a metric value
 */
const recordMetric = (
  name: string,
  type: MetricType,
  value: number,
  unit: string,
  description: string,
  labels?: Record<string, string>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsState) return
    
    const timestamp = Date.now()
    const metricValue: MetricValue = { timestamp, value, labels }
    
    yield* Ref.update(metricsState, state => {
      const existing = state.series.get(name)
      const values = existing ? [...existing.values, metricValue] : [metricValue]
      
      // Trim to max length
      const trimmedValues = values.length > metricsConfig.maxSeriesLength
        ? values.slice(-metricsConfig.maxSeriesLength)
        : values
      
      const series: MetricSeries = {
        name,
        type,
        unit,
        values: trimmedValues,
        description
      }
      
      const newSeries = new Map(state.series)
      newSeries.set(name, series)
      
      return {
        ...state,
        series: newSeries
      }
    })
  })

/**
 * Main Metrics API
 */
export const Metrics = {
  /**
   * Record a counter metric (monotonically increasing)
   */
  recordCounter: (name: string, value: number = 1, unit: string = 'count', labels?: Record<string, string>) =>
    recordMetric(name, 'counter', value, unit, `Counter: ${name}`, labels),
  
  /**
   * Record a gauge metric (can go up or down)
   */
  recordGauge: (name: string, value: number, unit: string = 'value', labels?: Record<string, string>) =>
    recordMetric(name, 'gauge', value, unit, `Gauge: ${name}`, labels),
  
  /**
   * Record a histogram metric (for distributions)
   */
  recordHistogram: (name: string, value: number, unit: string = 'value', labels?: Record<string, string>) =>
    recordMetric(name, 'histogram', value, unit, `Histogram: ${name}`, labels),
  
  /**
   * Record a timer metric (duration measurements)
   */
  recordTimer: (name: string, durationMs: number, labels?: Record<string, string>) =>
    recordMetric(name, 'timer', durationMs, 'ms', `Timer: ${name}`, labels),
  
  /**
   * Increment a counter by 1
   */
  increment: (name: string, labels?: Record<string, string>) =>
    Metrics.recordCounter(name, 1, 'count', labels),
  
  /**
   * Decrement a counter by 1
   */
  decrement: (name: string, labels?: Record<string, string>) =>
    Metrics.recordCounter(name, -1, 'count', labels),
  
  /**
   * Time an Effect execution
   */
  time: <A, E, R>(name: string, labels?: Record<string, string>) =>
    (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      Effect.gen(function* () {
        const start = performance.now()
        const result = yield* effect
        const duration = performance.now() - start
        yield* Metrics.recordTimer(name, duration, labels)
        return result
      }),
  
  /**
   * Get current metrics snapshot
   */
  getSnapshot: (): Effect.Effect<MetricsSnapshot, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) {
        return {
          timestamp: Date.now(),
          series: new Map(),
          systemMetrics: {
            memory: null,
            fps: null,
            frameTime: null,
            gcPressure: null
          }
        }
      }
      
      const state = yield* Ref.get(metricsState)
      const memoryUsage = getMemoryUsage()
      const fpsSample = getFPSSample()
      
      return {
        timestamp: Date.now(),
        series: new Map(state.series),
        systemMetrics: {
          memory: memoryUsage,
          fps: fpsSample?.fps || null,
          frameTime: fpsSample?.frameTime || null,
          gcPressure: null // TODO: Implement GC pressure detection
        }
      }
    }),
  
  /**
   * Get specific metric series
   */
  getSeries: (name: string): Effect.Effect<MetricSeries | null, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) return null
      
      const state = yield* Ref.get(metricsState)
      return state.series.get(name) || null
    }),
  
  /**
   * Get metrics matching a pattern
   */
  getSeriesByPattern: (pattern: RegExp): Effect.Effect<ReadonlyArray<MetricSeries>, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) return []
      
      const state = yield* Ref.get(metricsState)
      const matching: MetricSeries[] = []
      
      for (const [name, series] of state.series.entries()) {
        if (pattern.test(name)) {
          matching.push(series)
        }
      }
      
      return matching
    }),
  
  /**
   * Calculate statistics for a metric series
   */
  getStatistics: (name: string, windowMs?: number): Effect.Effect<{
    count: number
    min: number
    max: number
    mean: number
    median: number
    p90: number
    p95: number
    p99: number
    stdDev: number
  } | null, never, never> =>
    Effect.gen(function* () {
      const series = yield* Metrics.getSeries(name)
      if (!series || series.values.length === 0) return null
      
      // Filter by time window if specified
      const now = Date.now()
      const values = windowMs
        ? series.values.filter(v => v.timestamp > now - windowMs)
        : series.values
      
      if (values.length === 0) return null
      
      const sorted = values.map(v => v.value).sort((a, b) => a - b)
      const count = sorted.length
      const sum = sorted.reduce((acc, val) => acc + val, 0)
      const mean = sum / count
      
      // Calculate percentiles
      const percentile = (p: number) => {
        const index = Math.floor((count - 1) * p / 100)
        return sorted[index]
      }
      
      // Calculate standard deviation
      const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
      const stdDev = Math.sqrt(variance)
      
      return {
        count,
        min: sorted[0],
        max: sorted[count - 1],
        mean,
        median: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99),
        stdDev
      }
    }),
  
  /**
   * Generate a metrics dashboard report
   */
  generateDashboard: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Metrics.getSnapshot()
      
      let dashboard = '📊 Performance Dashboard\n'
      dashboard += '═'.repeat(60) + '\n\n'
      
      // System metrics
      dashboard += '🖥️  System Metrics\n'
      dashboard += '─'.repeat(20) + '\n'
      
      if (snapshot.systemMetrics.memory) {
        const { used, total, percentage } = snapshot.systemMetrics.memory
        dashboard += `Memory: ${(used / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB (${percentage.toFixed(1)}%)\n`
      }
      
      if (snapshot.systemMetrics.fps) {
        dashboard += `FPS: ${snapshot.systemMetrics.fps.toFixed(1)} fps\n`
      }
      
      if (snapshot.systemMetrics.frameTime) {
        dashboard += `Frame Time: ${snapshot.systemMetrics.frameTime.toFixed(2)}ms\n`
      }
      
      dashboard += '\n'
      
      // Custom metrics
      dashboard += '📈 Custom Metrics\n'
      dashboard += '─'.repeat(20) + '\n'
      
      const sortedSeries = Array.from(snapshot.series.values())
        .sort((a, b) => a.name.localeCompare(b.name))
      
      for (const series of sortedSeries) {
        if (series.values.length === 0) continue
        
        const stats = yield* Metrics.getStatistics(series.name)
        if (!stats) continue
        
        const latest = series.values[series.values.length - 1]
        dashboard += `${series.name} (${series.type}): ${latest.value} ${series.unit}\n`
        
        if (series.type === 'timer' || series.type === 'histogram') {
          dashboard += `  └ avg: ${stats.mean.toFixed(2)}, p95: ${stats.p95.toFixed(2)}, max: ${stats.max.toFixed(2)}\n`
        }
      }
      
      return dashboard
    }),
  
  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusFormat: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Metrics.getSnapshot()
      
      let output = ''
      
      for (const series of snapshot.series.values()) {
        const latest = series.values[series.values.length - 1]
        if (!latest) continue
        
        // HELP comment
        output += `# HELP ${series.name} ${series.description}\n`
        output += `# TYPE ${series.name} ${series.type}\n`
        
        // Metric value
        const labels = latest.labels
          ? Object.entries(latest.labels)
              .map(([key, value]) => `${key}="${value}"`)
              .join(',')
          : ''
        
        const labelsStr = labels ? `{${labels}}` : ''
        output += `${series.name}${labelsStr} ${latest.value} ${latest.timestamp}\n`
      }
      
      return output
    }),
  
  /**
   * Clear all metrics
   */
  clear: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) return
      
      yield* Ref.set(metricsState, {
        series: new Map(),
        lastCleanup: Date.now()
      })
      
      yield* Effect.log('All metrics cleared')
    })
}

/**
 * Metric collection decorators and utilities
 */

/**
 * Decorator to automatically record method execution time
 */
export const timed = (metricName?: string, labels?: Record<string, string>) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyName}.duration`
    
    descriptor.value = function (...args: any[]) {
      const start = performance.now()
      
      try {
        const result = method.apply(this, args)
        const duration = performance.now() - start
        
        // Record timing
        Effect.runSync(Metrics.recordTimer(name, duration, labels))
        
        return result
      } catch (error) {
        const duration = performance.now() - start
        
        // Record timing even on error
        Effect.runSync(Metrics.recordTimer(name, duration, { ...labels, status: 'error' }))
        throw error
      }
    }
    
    return descriptor
  }
}

/**
 * Decorator to count method invocations
 */
export const counted = (metricName?: string, labels?: Record<string, string>) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyName}.calls`
    
    descriptor.value = function (...args: any[]) {
      Effect.runSync(Metrics.increment(name, labels))
      return method.apply(this, args)
    }
    
    return descriptor
  }
}

/**
 * Higher-order function to wrap functions with metrics
 */
export const withMetrics = <Args extends ReadonlyArray<any>, Return>(
  name: string,
  fn: (...args: Args) => Return,
  labels?: Record<string, string>
) =>
  (...args: Args): Return => {
    const start = performance.now()
    
    try {
      const result = fn(...args)
      const duration = performance.now() - start
      
      Effect.runSync(Metrics.recordTimer(`${name}.duration`, duration, labels))
      Effect.runSync(Metrics.increment(`${name}.calls`, { ...labels, status: 'success' }))
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      
      Effect.runSync(Metrics.recordTimer(`${name}.duration`, duration, { ...labels, status: 'error' }))
      Effect.runSync(Metrics.increment(`${name}.calls`, { ...labels, status: 'error' }))
      
      throw error
    }
  }