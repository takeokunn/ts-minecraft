import { Effect, Ref, Schedule, Context, Layer, Duration, Fiber, Queue, Option, Chunk, Metric as EffectMetric } from 'effect'
import { withErrorLog, withPerformanceMonitoring } from '../../shared/utils/effect'

/**
 * Enhanced comprehensive metrics collection and reporting system
 * Tracks various performance metrics with advanced features and real-time monitoring
 */

export interface MetricValue {
  readonly timestamp: number
  readonly value: number
  readonly labels?: Record<string, string>
  readonly metadata?: Record<string, unknown>
}

export interface MetricSeries {
  readonly name: string
  readonly type: MetricType
  readonly unit: string
  readonly values: ReadonlyArray<MetricValue>
  readonly description: string
  readonly aggregationWindow: number
  readonly retention: number
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary' | 'rate'

export interface MetricsConfig {
  readonly maxSeriesLength: number
  readonly retentionPeriod: number // milliseconds
  readonly collectInterval: number // milliseconds
  readonly enableAutoCollection: boolean
  readonly enableCompression: boolean
  readonly compressionThreshold: number
  readonly batchSize: number
  readonly enableBackpressure: boolean
  readonly backpressureThreshold: number
  readonly aggregationEnabled: boolean
  readonly exportFormats: ReadonlyArray<'prometheus' | 'json' | 'csv'>
}

export interface MetricsSnapshot {
  readonly timestamp: number
  readonly series: ReadonlyMap<string, MetricSeries>
  readonly systemMetrics: SystemMetrics
  readonly performanceProfile: PerformanceProfile
  readonly aggregates: MetricAggregates
}

export interface SystemMetrics {
  readonly memory: {
    readonly used: number
    readonly total: number
    readonly percentage: number
    readonly heapUsed: number
    readonly heapTotal: number
    readonly external: number
    readonly gcCollections: number
  } | null
  readonly cpu: {
    readonly usage: number
    readonly loadAverage: number[]
  } | null
  readonly fps: number | null
  readonly frameTime: number | null
  readonly gcPressure: number | null
  readonly networkLatency: number | null
  readonly diskIO: {
    readonly read: number
    readonly write: number
  } | null
}

export interface PerformanceProfile {
  readonly hotspots: ReadonlyArray<{
    readonly name: string
    readonly duration: number
    readonly frequency: number
    readonly impact: number
  }>
  readonly bottlenecks: ReadonlyArray<{
    readonly component: string
    readonly severity: 'low' | 'medium' | 'high' | 'critical'
    readonly recommendation: string
  }>
  readonly trends: ReadonlyArray<{
    readonly metric: string
    readonly trend: 'increasing' | 'decreasing' | 'stable'
    readonly changeRate: number
  }>
}

export interface MetricAggregates {
  readonly [key: string]: {
    readonly min: number
    readonly max: number
    readonly mean: number
    readonly median: number
    readonly p95: number
    readonly p99: number
    readonly stdDev: number
    readonly count: number
  }
}

/**
 * Error types for metrics operations
 */
export class MetricsError extends Error {
  readonly _tag = 'MetricsError'
  constructor(message: string, public readonly operation: string, public readonly metricName?: string) {
    super(message)
    this.name = 'MetricsError'
  }
}

export class MetricBackpressureError extends MetricsError {
  readonly _tag = 'MetricBackpressureError'
  constructor(metricName: string, queueSize: number) {
    super(`Metrics backpressure for '${metricName}' (queue size: ${queueSize})`, 'record', metricName)
    this.name = 'MetricBackpressureError'
  }
}

/**
 * Enhanced metrics collector state with advanced features
 */
interface MetricsState {
  readonly series: Map<string, MetricSeries>
  readonly lastCleanup: number
  readonly compressionState: Map<string, number>
  readonly aggregationCache: Map<string, MetricAggregates[string]>
  readonly alertThresholds: Map<string, { min?: number; max?: number; callback: (value: number) => Effect.Effect<void> }>
  readonly performanceMarkers: Map<string, number>
}

/**
 * Metrics service for dependency injection
 */
export const MetricsService = Context.GenericTag<{
  readonly recordMetric: (name: string, type: MetricType, value: number, unit: string, description: string, labels?: Record<string, string>) => Effect.Effect<void, MetricsError, never>
  readonly recordBatch: (metrics: ReadonlyArray<{ name: string; type: MetricType; value: number; unit: string; description: string; labels?: Record<string, string> }>) => Effect.Effect<void, MetricsError, never>
  readonly getSnapshot: () => Effect.Effect<MetricsSnapshot, never, never>
  readonly getSeries: (name: string) => Effect.Effect<MetricSeries | null, never, never>
  readonly getAggregates: (name: string, windowMs?: number) => Effect.Effect<MetricAggregates[string] | null, never, never>
  readonly exportMetrics: (format: 'prometheus' | 'json' | 'csv') => Effect.Effect<string, never, never>
  readonly startCollection: () => Effect.Effect<Fiber.Fiber<void>, never, never>
  readonly stopCollection: () => Effect.Effect<void, never, never>
  readonly clearMetrics: () => Effect.Effect<void, never, never>
  readonly setAlert: (name: string, threshold: { min?: number; max?: number }, callback: (value: number) => Effect.Effect<void>) => Effect.Effect<void, never, never>
}>('MetricsService')

// Global state
let metricsState: Ref.Ref<MetricsState> | null = null
let metricsConfig: MetricsConfig = {
  maxSeriesLength: 10000,
  retentionPeriod: 10 * 60 * 1000, // 10 minutes
  collectInterval: 1000, // 1 second
  enableAutoCollection: true,
  enableCompression: true,
  compressionThreshold: 1000,
  batchSize: 100,
  enableBackpressure: true,
  backpressureThreshold: 50000,
  aggregationEnabled: true,
  exportFormats: ['prometheus', 'json'],
}
let collectionFiber: Fiber.Fiber<void> | null = null
let metricsQueue: Queue.Queue<MetricValue & { name: string; type: MetricType; unit: string; description: string }> | null = null

/**
 * Initialize the enhanced metrics system
 */
export const initializeMetrics = (config?: Partial<MetricsConfig>): Effect.Effect<void, MetricsError, never> =>
  Effect.gen(function* () {
    metricsConfig = { ...metricsConfig, ...config }

    metricsState = yield* Ref.make<MetricsState>({
      series: new Map(),
      lastCleanup: Date.now(),
      compressionState: new Map(),
      aggregationCache: new Map(),
      alertThresholds: new Map(),
      performanceMarkers: new Map(),
    })

    // Initialize metrics queue for batching
    metricsQueue = yield* Queue.bounded(metricsConfig.batchSize * 10)

    if (metricsConfig.enableAutoCollection) {
      collectionFiber = yield* startAutoCollection()
    }

    yield* Effect.logInfo('Enhanced metrics system initialized')
  }).pipe(withErrorLog('initializeMetrics'))

/**
 * Enhanced automatic metrics collection with system monitoring
 */
const startAutoCollection = (): Effect.Effect<Fiber.Fiber<void>, never, never> =>
  Effect.gen(function* () {
    const collectSystemMetrics = Effect.gen(function* () {
      // Memory metrics
      const memoryUsage = getMemoryUsage()
      if (memoryUsage) {
        yield* Metrics.recordGauge('system.memory.used', memoryUsage.used, 'bytes')
        yield* Metrics.recordGauge('system.memory.percentage', memoryUsage.percentage, 'percent')
        yield* Metrics.recordGauge('system.memory.heap_used', memoryUsage.heapUsed, 'bytes')
        yield* Metrics.recordGauge('system.memory.heap_total', memoryUsage.heapTotal, 'bytes')
        yield* Metrics.recordGauge('system.memory.external', memoryUsage.external, 'bytes')
      }

      // FPS and frame time metrics
      const fpsSample = getFPSSample()
      if (fpsSample) {
        yield* Metrics.recordGauge('system.fps', fpsSample.fps, 'fps')
        yield* Metrics.recordTimer('system.frame_time', fpsSample.frameTime)
      }

      // CPU usage (if available)
      const cpuUsage = getCPUUsage()
      if (cpuUsage) {
        yield* Metrics.recordGauge('system.cpu.usage', cpuUsage.usage, 'percent')
        if (cpuUsage.loadAverage.length > 0) {
          yield* Metrics.recordGauge('system.cpu.load_1m', cpuUsage.loadAverage[0], 'load')
        }
      }

      // GC pressure estimation
      const gcPressure = getGCPressure()
      if (gcPressure !== null) {
        yield* Metrics.recordGauge('system.gc.pressure', gcPressure, 'ratio')
      }

      // Process batched metrics
      yield* processBatchedMetrics()

      // Cleanup old metrics periodically
      yield* cleanupOldMetrics()

      // Update aggregations if enabled
      if (metricsConfig.aggregationEnabled) {
        yield* updateAggregations()
      }

      // Check alerts
      yield* checkAlerts()
    })

    // Schedule collection
    return yield* Effect.fork(
      Effect.repeat(collectSystemMetrics, Schedule.fixed(Duration.millis(metricsConfig.collectInterval)))
    )
  })

/**
 * Enhanced memory usage with more detailed information
 */
const getMemoryUsage = (): SystemMetrics['memory'] => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory
    const used = memory.usedJSHeapSize
    const total = memory.jsHeapSizeLimit
    return {
      used,
      total,
      percentage: (used / total) * 100,
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: 0, // Would need Node.js process.memoryUsage()
      gcCollections: 0, // Would need GC event tracking
    }
  }
  return null
}

/**
 * CPU usage detection (basic implementation)
 */
const getCPUUsage = (): SystemMetrics['cpu'] => {
  // This is a simplified implementation
  // In a real environment, you'd need proper CPU monitoring
  return null
}

/**
 * Enhanced FPS monitoring with smoothing
 */
let lastFrameTime = performance.now()
let frameCount = 0
let fpsHistory: number[] = []
let frameTimeHistory: number[] = []

const getFPSSample = (): { fps: number; frameTime: number } | null => {
  const now = performance.now()
  const deltaTime = now - lastFrameTime
  frameCount++

  // Update FPS every second
  if (deltaTime >= 1000) {
    const fps = (frameCount * 1000) / deltaTime
    const avgFrameTime = deltaTime / frameCount
    
    fpsHistory.push(fps)
    frameTimeHistory.push(avgFrameTime)

    // Keep only last 10 samples for smoothing
    if (fpsHistory.length > 10) {
      fpsHistory.shift()
      frameTimeHistory.shift()
    }

    const smoothedFps = fpsHistory.reduce((sum, f) => sum + f, 0) / fpsHistory.length
    const smoothedFrameTime = frameTimeHistory.reduce((sum, ft) => sum + ft, 0) / frameTimeHistory.length

    frameCount = 0
    lastFrameTime = now

    return { fps: smoothedFps, frameTime: smoothedFrameTime }
  }

  return null
}

/**
 * GC pressure estimation
 */
let lastHeapSize = 0
let gcPressureHistory: number[] = []

const getGCPressure = (): number | null => {
  const memUsage = getMemoryUsage()
  if (!memUsage) return null

  const currentHeapSize = memUsage.heapUsed
  const heapDelta = currentHeapSize - lastHeapSize
  const pressure = Math.abs(heapDelta) / memUsage.heapTotal

  gcPressureHistory.push(pressure)
  if (gcPressureHistory.length > 5) {
    gcPressureHistory.shift()
  }

  lastHeapSize = currentHeapSize
  return gcPressureHistory.reduce((sum, p) => sum + p, 0) / gcPressureHistory.length
}

/**
 * Process batched metrics for better performance
 */
const processBatchedMetrics = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsQueue || !metricsState) return

    const batch = yield* Queue.takeAll(metricsQueue)
    if (Chunk.isEmpty(batch)) return

    const batchArray = Chunk.toReadonlyArray(batch)
    
    yield* Ref.update(metricsState, (state) => {
      const newSeries = new Map(state.series)
      
      for (const metric of batchArray) {
        const existing = newSeries.get(metric.name)
        const values = existing ? [...existing.values, metric] : [metric]
        
        // Apply compression if enabled
        const finalValues = metricsConfig.enableCompression && values.length > metricsConfig.compressionThreshold
          ? compressValues(values)
          : values
          
        // Trim to max length
        const trimmedValues = finalValues.length > metricsConfig.maxSeriesLength 
          ? finalValues.slice(-metricsConfig.maxSeriesLength) 
          : finalValues

        const series: MetricSeries = {
          name: metric.name,
          type: metric.type,
          unit: metric.unit,
          values: trimmedValues,
          description: metric.description,
          aggregationWindow: metricsConfig.collectInterval,
          retention: metricsConfig.retentionPeriod,
        }

        newSeries.set(metric.name, series)
      }

      return {
        ...state,
        series: newSeries,
      }
    })
  })

/**
 * Compress metric values using simple downsampling
 */
const compressValues = (values: MetricValue[]): MetricValue[] => {
  if (values.length <= metricsConfig.compressionThreshold) return values

  const compressionRatio = 2
  const compressed: MetricValue[] = []
  
  for (let i = 0; i < values.length; i += compressionRatio) {
    const window = values.slice(i, i + compressionRatio)
    const avgValue = window.reduce((sum, v) => sum + v.value, 0) / window.length
    
    compressed.push({
      timestamp: window[0].timestamp,
      value: avgValue,
      labels: window[0].labels,
      metadata: { ...window[0].metadata, compressed: true, originalCount: window.length }
    })
  }
  
  return compressed
}

/**
 * Enhanced cleanup with compression state tracking
 */
const cleanupOldMetrics = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsState) return

    const now = Date.now()
    const cutoff = now - metricsConfig.retentionPeriod

    yield* Ref.update(metricsState, (state) => {
      if (now - state.lastCleanup < 60000) {
        // Cleanup every minute
        return state
      }

      const cleanedSeries = new Map<string, MetricSeries>()
      const cleanedCompressionState = new Map<string, number>()

      for (const [name, series] of state.series.entries()) {
        const filteredValues = series.values.filter((v) => v.timestamp > cutoff)

        if (filteredValues.length > 0) {
          cleanedSeries.set(name, {
            ...series,
            values: filteredValues,
          })
          
          // Preserve compression state for active series
          if (state.compressionState.has(name)) {
            cleanedCompressionState.set(name, state.compressionState.get(name)!)
          }
        }
      }

      return {
        ...state,
        series: cleanedSeries,
        compressionState: cleanedCompressionState,
        lastCleanup: now,
      }
    })
  })

/**
 * Update metric aggregations
 */
const updateAggregations = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsState) return

    yield* Ref.update(metricsState, (state) => {
      const newAggregationCache = new Map<string, MetricAggregates[string]>()

      for (const [name, series] of state.series.entries()) {
        if (series.values.length === 0) continue

        const values = series.values.map(v => v.value).sort((a, b) => a - b)
        const count = values.length
        const sum = values.reduce((acc, val) => acc + val, 0)
        const mean = sum / count

        const percentile = (p: number) => {
          const index = Math.floor(((count - 1) * p) / 100)
          return values[index] || 0
        }

        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
        const stdDev = Math.sqrt(variance)

        const aggregate = {
          min: values[0] || 0,
          max: values[count - 1] || 0,
          mean,
          median: percentile(50),
          p95: percentile(95),
          p99: percentile(99),
          stdDev,
          count,
        }

        newAggregationCache.set(name, aggregate)
      }

      return {
        ...state,
        aggregationCache: newAggregationCache,
      }
    })
  })

/**
 * Check metric alerts
 */
const checkAlerts = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!metricsState) return

    const state = yield* Ref.get(metricsState)

    for (const [name, threshold] of state.alertThresholds.entries()) {
      const series = state.series.get(name)
      if (!series || series.values.length === 0) continue

      const latestValue = series.values[series.values.length - 1].value
      const shouldAlert = (threshold.min !== undefined && latestValue < threshold.min) ||
                         (threshold.max !== undefined && latestValue > threshold.max)

      if (shouldAlert) {
        yield* threshold.callback(latestValue).pipe(
          Effect.catchAll((error) => 
            Effect.logError(`Alert callback failed for metric ${name}:`, error)
          )
        )
      }
    }
  })

/**
 * Enhanced record metric with batching and backpressure
 */
const recordMetric = (name: string, type: MetricType, value: number, unit: string, description: string, labels?: Record<string, string>): Effect.Effect<void, MetricsError, never> =>
  Effect.gen(function* () {
    if (!metricsQueue) {
      return yield* Effect.fail(new MetricsError('Metrics system not initialized', 'record', name))
    }

    // Check backpressure
    if (metricsConfig.enableBackpressure) {
      const queueSize = yield* Queue.size(metricsQueue)
      if (queueSize >= metricsConfig.backpressureThreshold) {
        return yield* Effect.fail(new MetricBackpressureError(name, queueSize))
      }
    }

    const metricValue = {
      name,
      type,
      unit,
      description,
      timestamp: Date.now(),
      value,
      ...(labels && { labels }),
    }

    // Offer to queue (non-blocking)
    const offered = yield* Queue.offer(metricsQueue, metricValue).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    )

    if (!offered && metricsConfig.enableBackpressure) {
      return yield* Effect.fail(new MetricBackpressureError(name, yield* Queue.size(metricsQueue)))
    }
  })

/**
 * Record batch of metrics efficiently
 */
const recordBatch = (metrics: ReadonlyArray<{ name: string; type: MetricType; value: number; unit: string; description: string; labels?: Record<string, string> }>): Effect.Effect<void, MetricsError, never> =>
  Effect.gen(function* () {
    if (!metricsQueue) {
      return yield* Effect.fail(new MetricsError('Metrics system not initialized', 'recordBatch'))
    }

    const timestamp = Date.now()
    const queueItems = metrics.map(metric => ({
      ...metric,
      timestamp,
    }))

    // Offer all items to queue
    for (const item of queueItems) {
      const offered = yield* Queue.offer(metricsQueue, item).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      )

      if (!offered && metricsConfig.enableBackpressure) {
        yield* Effect.logWarning(`Failed to queue metric ${item.name} due to backpressure`)
      }
    }
  })

/**
 * Main enhanced Metrics API
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
   * Record a summary metric (quantiles)
   */
  recordSummary: (name: string, value: number, unit: string = 'value', labels?: Record<string, string>) =>
    recordMetric(name, 'summary', value, unit, `Summary: ${name}`, labels),

  /**
   * Record a rate metric
   */
  recordRate: (name: string, value: number, unit: string = 'per_second', labels?: Record<string, string>) =>
    recordMetric(name, 'rate', value, unit, `Rate: ${name}`, labels),

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
   * Time an Effect execution with enhanced timing
   */
  time:
    <A, E, R>(name: string, labels?: Record<string, string>) =>
    (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const startMarker = `${name}_start_${Date.now()}`
        
        try {
          const result = yield* effect
          const duration = performance.now() - startTime
          yield* Metrics.recordTimer(name, duration, { ...labels, status: 'success' })
          return result
        } catch (error) {
          const duration = performance.now() - startTime
          yield* Metrics.recordTimer(name, duration, { ...labels, status: 'error' })
          throw error
        }
      }),

  /**
   * Mark performance points for analysis
   */
  mark: (name: string) =>
    Effect.gen(function* () {
      if (!metricsState) return
      
      yield* Ref.update(metricsState, (state) => ({
        ...state,
        performanceMarkers: new Map(state.performanceMarkers).set(name, performance.now())
      }))
    }),

  /**
   * Measure time between marks
   */
  measure: (name: string, startMark: string, endMark?: string) =>
    Effect.gen(function* () {
      if (!metricsState) return
      
      const state = yield* Ref.get(metricsState)
      const startTime = state.performanceMarkers.get(startMark)
      const endTime = endMark ? state.performanceMarkers.get(endMark) : performance.now()
      
      if (startTime && endTime) {
        const duration = endTime - startTime
        yield* Metrics.recordTimer(name, duration)
      }
    }),

  /**
   * Get current metrics snapshot with enhanced data
   */
  getSnapshot: (): Effect.Effect<MetricsSnapshot, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) {
        return {
          timestamp: Date.now(),
          series: new Map(),
          systemMetrics: {
            memory: null,
            cpu: null,
            fps: null,
            frameTime: null,
            gcPressure: null,
            networkLatency: null,
            diskIO: null,
          },
          performanceProfile: {
            hotspots: [],
            bottlenecks: [],
            trends: [],
          },
          aggregates: {},
        }
      }

      const state = yield* Ref.get(metricsState)
      const memoryUsage = getMemoryUsage()
      const cpuUsage = getCPUUsage()
      const fpsSample = getFPSSample()
      const gcPressure = getGCPressure()

      // Generate performance profile
      const performanceProfile = generatePerformanceProfile(state)

      return {
        timestamp: Date.now(),
        series: new Map(state.series),
        systemMetrics: {
          memory: memoryUsage,
          cpu: cpuUsage,
          fps: fpsSample?.fps || null,
          frameTime: fpsSample?.frameTime || null,
          gcPressure,
          networkLatency: null, // Would need actual network monitoring
          diskIO: null, // Would need actual disk monitoring
        },
        performanceProfile,
        aggregates: Object.fromEntries(state.aggregationCache),
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
   * Get metrics matching a pattern with enhanced filtering
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

      return matching.sort((a, b) => a.name.localeCompare(b.name))
    }),

  /**
   * Calculate enhanced statistics for a metric series
   */
  getStatistics: (name: string, windowMs?: number) =>
    Effect.gen(function* () {
      if (!metricsState) return null
      
      const state = yield* Ref.get(metricsState)
      const cached = state.aggregationCache.get(name)
      
      if (cached && !windowMs) {
        return cached
      }
      
      const series = state.series.get(name)
      if (!series || series.values.length === 0) return null

      // Filter by time window if specified
      const now = Date.now()
      const values = windowMs 
        ? series.values.filter((v) => v.timestamp > now - windowMs)
        : series.values

      if (values.length === 0) return null

      const sorted = values.map((v) => v.value).sort((a, b) => a - b)
      const count = sorted.length
      const sum = sorted.reduce((acc, val) => acc + val, 0)
      const mean = sum / count

      const percentile = (p: number) => {
        const index = Math.floor(((count - 1) * p) / 100)
        return sorted[index] || 0
      }

      const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
      const stdDev = Math.sqrt(variance)

      return {
        count,
        min: sorted[0] || 0,
        max: sorted[count - 1] || 0,
        mean,
        median: percentile(50),
        p95: percentile(95),
        p99: percentile(99),
        stdDev,
      }
    }),

  /**
   * Export metrics in various formats
   */
  exportPrometheusFormat: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Metrics.getSnapshot()
      let output = ''

      for (const series of snapshot.series.values()) {
        const latest = series.values[series.values.length - 1]
        if (!latest) continue

        output += `# HELP ${series.name} ${series.description}\n`
        output += `# TYPE ${series.name} ${series.type}\n`

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
   * Export metrics as JSON
   */
  exportJSONFormat: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Metrics.getSnapshot()
      return JSON.stringify({
        timestamp: snapshot.timestamp,
        series: Object.fromEntries(snapshot.series),
        systemMetrics: snapshot.systemMetrics,
        performanceProfile: snapshot.performanceProfile,
        aggregates: snapshot.aggregates,
      }, null, 2)
    }),

  /**
   * Set up metric alerts
   */
  setAlert: (name: string, threshold: { min?: number; max?: number }, callback: (value: number) => Effect.Effect<void>) =>
    Effect.gen(function* () {
      if (!metricsState) return
      
      yield* Ref.update(metricsState, (state) => ({
        ...state,
        alertThresholds: new Map(state.alertThresholds).set(name, { ...threshold, callback })
      }))
    }),

  /**
   * Clear all metrics
   */
  clear: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!metricsState) return

      yield* Ref.set(metricsState, {
        series: new Map(),
        lastCleanup: Date.now(),
        compressionState: new Map(),
        aggregationCache: new Map(),
        alertThresholds: new Map(),
        performanceMarkers: new Map(),
      })

      if (metricsQueue) {
        yield* Queue.takeAll(metricsQueue)
      }

      yield* Effect.logInfo('All metrics cleared')
    }),

  /**
   * Get system health score
   */
  getHealthScore: (): Effect.Effect<{ score: number; issues: string[] }, never, never> =>
    Effect.gen(function* () {
      const snapshot = yield* Metrics.getSnapshot()
      let score = 100
      const issues: string[] = []

      // Check memory pressure
      if (snapshot.systemMetrics.memory) {
        const memPercent = snapshot.systemMetrics.memory.percentage
        if (memPercent > 90) {
          score -= 30
          issues.push('Critical memory usage')
        } else if (memPercent > 75) {
          score -= 15
          issues.push('High memory usage')
        }
      }

      // Check FPS
      if (snapshot.systemMetrics.fps && snapshot.systemMetrics.fps < 30) {
        score -= 20
        issues.push('Low FPS detected')
      }

      // Check GC pressure
      if (snapshot.systemMetrics.gcPressure && snapshot.systemMetrics.gcPressure > 0.1) {
        score -= 15
        issues.push('High garbage collection pressure')
      }

      // Check for performance bottlenecks
      const criticalBottlenecks = snapshot.performanceProfile.bottlenecks
        .filter(b => b.severity === 'critical')
      
      score -= criticalBottlenecks.length * 10
      criticalBottlenecks.forEach(b => issues.push(`Critical bottleneck: ${b.component}`))

      return { score: Math.max(0, score), issues }
    }),
}

/**
 * Generate performance profile analysis
 */
const generatePerformanceProfile = (state: MetricsState): PerformanceProfile => {
  const hotspots: PerformanceProfile['hotspots'] = []
  const bottlenecks: PerformanceProfile['bottlenecks'] = []
  const trends: PerformanceProfile['trends'] = []

  // Analyze timer metrics for hotspots
  for (const [name, series] of state.series.entries()) {
    if (series.type === 'timer' && series.values.length > 10) {
      const recent = series.values.slice(-10)
      const avgDuration = recent.reduce((sum, v) => sum + v.value, 0) / recent.length
      const frequency = recent.length / ((recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000)

      if (avgDuration > 100) { // Slow operations
        hotspots.push({
          name,
          duration: avgDuration,
          frequency,
          impact: avgDuration * frequency,
        })
      }
    }
  }

  // Analyze for bottlenecks
  const memoryMetric = state.series.get('system.memory.percentage')
  if (memoryMetric && memoryMetric.values.length > 0) {
    const latestMemory = memoryMetric.values[memoryMetric.values.length - 1].value
    if (latestMemory > 90) {
      bottlenecks.push({
        component: 'Memory',
        severity: 'critical',
        recommendation: 'Consider optimizing memory usage or increasing available memory',
      })
    } else if (latestMemory > 75) {
      bottlenecks.push({
        component: 'Memory',
        severity: 'high',
        recommendation: 'Monitor memory usage and consider optimization',
      })
    }
  }

  // Analyze trends
  for (const [name, series] of state.series.entries()) {
    if (series.values.length >= 20) {
      const values = series.values.map(v => v.value)
      const half = Math.floor(values.length / 2)
      const firstHalf = values.slice(0, half)
      const secondHalf = values.slice(half)
      
      const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length
      
      const changeRate = (secondAvg - firstAvg) / firstAvg
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
      if (Math.abs(changeRate) > 0.1) {
        trend = changeRate > 0 ? 'increasing' : 'decreasing'
      }
      
      if (trend !== 'stable') {
        trends.push({
          metric: name,
          trend,
          changeRate: Math.abs(changeRate),
        })
      }
    }
  }

  return {
    hotspots: hotspots.sort((a, b) => b.impact - a.impact),
    bottlenecks,
    trends: trends.sort((a, b) => b.changeRate - a.changeRate),
  }
}

/**
 * Enhanced metrics service layer
 */
export const MetricsServiceLive = Layer.effect(
  MetricsService,
  Effect.gen(function* () {
    yield* initializeMetrics()
    
    return {
      recordMetric,
      recordBatch,
      getSnapshot: Metrics.getSnapshot,
      getSeries: Metrics.getSeries,
      getAggregates: Metrics.getStatistics,
      exportMetrics: (format: 'prometheus' | 'json' | 'csv') => {
        switch (format) {
          case 'prometheus':
            return Metrics.exportPrometheusFormat()
          case 'json':
            return Metrics.exportJSONFormat()
          case 'csv':
            return Effect.succeed('CSV export not yet implemented')
          default:
            return Effect.succeed('')
        }
      },
      startCollection: () => Effect.succeed(collectionFiber!),
      stopCollection: () => Effect.gen(function* () {
        if (collectionFiber) {
          yield* Fiber.interrupt(collectionFiber)
          collectionFiber = null
        }
      }),
      clearMetrics: Metrics.clear,
      setAlert: Metrics.setAlert,
    }
  })
).pipe(withErrorLog('MetricsServiceLive'))

/**
 * Enhanced metric collection decorators and utilities
 */

/**
 * Decorator to automatically record method execution time with enhanced features
 */
export const timed = (metricName?: string, labels?: Record<string, string>, enableProfiling: boolean = false) => {
  return function (target: object, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyName}.duration`

    descriptor.value = function (...args: unknown[]) {
      const start = performance.now()

      try {
        const result = method.apply(this, args)
        const duration = performance.now() - start

        // Record timing
        Effect.runSync(Metrics.recordTimer(name, duration, { ...labels, status: 'success' }))

        // Record profiling data if enabled
        if (enableProfiling) {
          Effect.runSync(Metrics.recordHistogram(`${name}.args_count`, args.length, 'count'))
        }

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
 * Enhanced decorator to count method invocations
 */
export const counted = (metricName?: string, labels?: Record<string, string>, trackArgs: boolean = false) => {
  return function (target: object, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyName}.calls`

    descriptor.value = function (...args: unknown[]) {
      const finalLabels = { ...labels }
      
      if (trackArgs) {
        finalLabels.args_count = args.length.toString()
      }
      
      Effect.runSync(Metrics.increment(name, finalLabels))
      return method.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Enhanced higher-order function to wrap functions with comprehensive metrics
 */
export const withMetrics =
  <Args extends ReadonlyArray<any>, Return>(
    name: string, 
    fn: (...args: Args) => Return, 
    options?: {
      labels?: Record<string, string>
      trackMemory?: boolean
      trackArgs?: boolean
      enableProfiling?: boolean
    }
  ) =>
  (...args: Args): Return => {
    const start = performance.now()
    const startMemory = options?.trackMemory ? getMemoryUsage()?.used || 0 : 0

    try {
      const result = fn(...args)
      const duration = performance.now() - start
      const endMemory = options?.trackMemory ? getMemoryUsage()?.used || 0 : 0

      const labels = { 
        ...options?.labels, 
        status: 'success',
        ...(options?.trackArgs && { args_count: args.length.toString() })
      }

      Effect.runSync(Metrics.recordTimer(`${name}.duration`, duration, labels))
      Effect.runSync(Metrics.increment(`${name}.calls`, labels))

      if (options?.trackMemory) {
        Effect.runSync(Metrics.recordGauge(`${name}.memory_delta`, endMemory - startMemory, 'bytes', labels))
      }

      if (options?.enableProfiling) {
        Effect.runSync(Metrics.recordHistogram(`${name}.result_size`, 
          typeof result === 'string' ? result.length : 
          typeof result === 'object' ? JSON.stringify(result).length : 1,
          'bytes'
        ))
      }

      return result
    } catch (error) {
      const duration = performance.now() - start
      const endMemory = options?.trackMemory ? getMemoryUsage()?.used || 0 : 0

      const labels = { 
        ...options?.labels, 
        status: 'error',
        error_type: error instanceof Error ? error.constructor.name : 'unknown'
      }

      Effect.runSync(Metrics.recordTimer(`${name}.duration`, duration, labels))
      Effect.runSync(Metrics.increment(`${name}.calls`, labels))

      if (options?.trackMemory) {
        Effect.runSync(Metrics.recordGauge(`${name}.memory_delta`, endMemory - startMemory, 'bytes', labels))
      }

      throw error
    }
  }

/**
 * Resource usage tracking for long-running operations
 */
export const trackResourceUsage = <T>(operation: string, effect: Effect.Effect<T>) =>
  Effect.gen(function* () {
    const startTime = performance.now()
    const startMemory = getMemoryUsage()

    yield* Metrics.mark(`${operation}_start`)

    const result = yield* effect.pipe(
      Effect.tap(() => Metrics.mark(`${operation}_end`)),
      Effect.catchAll((error) => 
        Effect.gen(function* () {
          yield* Metrics.mark(`${operation}_error`)
          return yield* Effect.fail(error)
        })
      )
    )

    yield* Metrics.measure(`${operation}.total_duration`, `${operation}_start`, `${operation}_end`)

    const endMemory = getMemoryUsage()
    if (startMemory && endMemory) {
      yield* Metrics.recordGauge(
        `${operation}.memory_usage`,
        endMemory.used - startMemory.used,
        'bytes'
      )
    }

    return result
  })