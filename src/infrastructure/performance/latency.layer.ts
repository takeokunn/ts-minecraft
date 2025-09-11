import { Effect, Context, Layer, Ref, Queue, Duration } from 'effect'

/**
 * Latency measurement point
 */
export interface LatencyMeasurement {
  readonly id: string
  readonly name: string
  readonly startTime: number
  readonly endTime: number
  readonly latency: number
  readonly metadata?: Record<string, unknown>
}

/**
 * Latency bucket for histogram analysis
 */
export interface LatencyBucket {
  readonly min: number
  readonly max: number
  readonly count: number
  readonly percentage: number
}

/**
 * Latency statistics
 */
export interface LatencyStats {
  readonly count: number
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly median: number
  readonly p95: number
  readonly p99: number
  readonly standardDeviation: number
  readonly histogram: LatencyBucket[]
}

/**
 * Latency optimization target
 */
export interface LatencyTarget {
  readonly name: string
  readonly targetLatency: number
  readonly warningThreshold: number
  readonly criticalThreshold: number
  readonly enabled: boolean
}

/**
 * Latency optimization configuration
 */
export interface LatencyOptimizerConfig {
  readonly enablePredictiveOptimization: boolean
  readonly enableAdaptiveBatching: boolean
  readonly enableRequestCoalescing: boolean
  readonly enableCaching: boolean
  readonly enablePrefetching: boolean
  readonly maxHistorySize: number
  readonly measurementWindow: number
  readonly optimizationInterval: number
  readonly adaptiveThreshold: number
}

/**
 * Request batch for optimization
 */
export interface RequestBatch<T, R> {
  readonly id: string
  readonly requests: Array<{
    id: string
    data: T
    resolve: (result: R) => void
    reject: (error: Error) => void
  }>
  readonly batchProcessor: (requests: T[]) => Promise<R[]>
  readonly maxBatchSize: number
  readonly maxWaitTime: number
}

/**
 * Latency Optimizer Service for dependency injection
 */
export const LatencyOptimizerService = Context.GenericTag<{
  readonly startMeasurement: (name: string, metadata?: Record<string, unknown>) => Effect.Effect<string, never, never>
  readonly endMeasurement: (id: string) => Effect.Effect<LatencyMeasurement, never, never>
  readonly measure: <R, E>(
    name: string,
    effect: Effect.Effect<R, E, never>,
    metadata?: Record<string, unknown>
  ) => Effect.Effect<R, E, never>
  
  readonly getStats: (name?: string) => Effect.Effect<LatencyStats, never, never>
  readonly getAllStats: () => Effect.Effect<Map<string, LatencyStats>, never, never>
  readonly clearMeasurements: (name?: string) => Effect.Effect<void, never, never>
  
  readonly setTarget: (target: LatencyTarget) => Effect.Effect<void, never, never>
  readonly getTargets: () => Effect.Effect<LatencyTarget[], never, never>
  readonly checkTargets: () => Effect.Effect<Array<{ name: string; status: 'ok' | 'warning' | 'critical'; actualLatency: number }>, never, never>
  
  readonly enableBatching: <T, R>(config: {
    name: string
    maxBatchSize: number
    maxWaitTime: number
    processor: (requests: T[]) => Promise<R[]>
  }) => Effect.Effect<(request: T) => Promise<R>, never, never>
  
  readonly prefetch: (key: string, generator: () => Promise<any>) => Effect.Effect<void, never, never>
  readonly getCached: <T>(key: string) => Effect.Effect<T | null, never, never>
  readonly invalidateCache: (pattern?: string) => Effect.Effect<void, never, never>
  
  readonly optimizeLatency: () => Effect.Effect<void, never, never>
  readonly generateReport: () => Effect.Effect<string, never, never>
}>('LatencyOptimizerService')

/**
 * Create latency optimizer service implementation
 */
const createLatencyOptimizerServiceImpl = (
  config: LatencyOptimizerConfig
): Effect.Effect<Context.Tag.Service<typeof LatencyOptimizerService>, never, never> =>
  Effect.gen(function* () {
    const measurements = yield* Ref.make<Map<string, LatencyMeasurement[]>>(new Map())
    const activeMeasurements = yield* Ref.make<Map<string, { name: string; startTime: number; metadata?: Record<string, unknown> }>>(new Map())
    const targets = yield* Ref.make<LatencyTarget[]>([])
    const cache = yield* Ref.make<Map<string, { data: any; timestamp: number; ttl: number }>>(new Map())
    const batchQueues = yield* Ref.make<Map<string, RequestBatch<any, any>>>(new Map())

    const generateId = () => Math.random().toString(36).substr(2, 9)

    const addMeasurement = (measurement: LatencyMeasurement) =>
      Effect.gen(function* () {
        yield* Ref.update(measurements, map => {
          const existing = map.get(measurement.name) || []
          const updated = [...existing, measurement].slice(-config.maxHistorySize)
          return new Map(map).set(measurement.name, updated)
        })

        // Check against targets
        const currentTargets = yield* Ref.get(targets)
        const target = currentTargets.find(t => t.name === measurement.name && t.enabled)
        
        if (target) {
          if (measurement.latency > target.criticalThreshold) {
            yield* Effect.logError(`CRITICAL: ${measurement.name} latency ${measurement.latency.toFixed(2)}ms exceeds critical threshold ${target.criticalThreshold}ms`)
          } else if (measurement.latency > target.warningThreshold) {
            yield* Effect.logWarning(`WARNING: ${measurement.name} latency ${measurement.latency.toFixed(2)}ms exceeds warning threshold ${target.warningThreshold}ms`)
          }
        }
      })

    const calculateStats = (latencies: number[]): LatencyStats => {
      if (latencies.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          p95: 0,
          p99: 0,
          standardDeviation: 0,
          histogram: []
        }
      }

      const sorted = [...latencies].sort((a, b) => a - b)
      const count = sorted.length
      const min = sorted[0]
      const max = sorted[count - 1]
      const mean = sorted.reduce((sum, val) => sum + val, 0) / count
      const median = count % 2 === 0 
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)]
      const p95 = sorted[Math.floor(count * 0.95)]
      const p99 = sorted[Math.floor(count * 0.99)]
      
      const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count
      const standardDeviation = Math.sqrt(variance)

      // Create histogram buckets
      const bucketCount = Math.min(10, Math.ceil(Math.sqrt(count)))
      const bucketSize = (max - min) / bucketCount
      const histogram: LatencyBucket[] = []

      for (let i = 0; i < bucketCount; i++) {
        const bucketMin = min + i * bucketSize
        const bucketMax = bucketMin + bucketSize
        const bucketValues = sorted.filter(val => val >= bucketMin && val < bucketMax)
        
        histogram.push({
          min: bucketMin,
          max: bucketMax,
          count: bucketValues.length,
          percentage: (bucketValues.length / count) * 100
        })
      }

      return {
        count,
        min,
        max,
        mean,
        median,
        p95,
        p99,
        standardDeviation,
        histogram
      }
    }

    const processBatch = <T, R>(batchId: string) =>
      Effect.gen(function* () {
        const batches = yield* Ref.get(batchQueues)
        const batch = batches.get(batchId) as RequestBatch<T, R>
        
        if (!batch || batch.requests.length === 0) {
          return
        }

        try {
          const requestData = batch.requests.map(r => r.data)
          const results = yield* Effect.fromPromise(() => batch.batchProcessor(requestData))
          
          batch.requests.forEach((req, index) => {
            req.resolve(results[index])
          })
        } catch (error) {
          batch.requests.forEach(req => {
            req.reject(error instanceof Error ? error : new Error(String(error)))
          })
        }

        // Clear the batch
        yield* Ref.update(batchQueues, map => {
          const newMap = new Map(map)
          newMap.delete(batchId)
          return newMap
        })
      })

    const startOptimizationLoop = () =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(Duration.millis(config.optimizationInterval))
          
          if (config.enablePredictiveOptimization) {
            yield* Effect.gen(function* () {
              // Analyze patterns and adjust thresholds
              const allMeasurements = yield* Ref.get(measurements)
              
              for (const [name, latencyList] of allMeasurements.entries()) {
                if (latencyList.length > 10) {
                  const recent = latencyList.slice(-10)
                  const trend = recent.slice(-5).reduce((sum, m) => sum + m.latency, 0) / 5
                  const baseline = recent.slice(0, 5).reduce((sum, m) => sum + m.latency, 0) / 5
                  
                  if (trend > baseline * config.adaptiveThreshold) {
                    yield* Effect.logInfo(`Detected latency increase in ${name}, enabling optimizations`)
                    // Trigger optimizations for this operation
                  }
                }
              }
            }).pipe(Effect.catchAll(() => Effect.succeed(undefined as void)))
          }
        }
      })

    // Start optimization loop
    Effect.runFork(startOptimizationLoop())

    return {
      startMeasurement: (name: string, metadata?: Record<string, unknown>) =>
        Effect.gen(function* () {
          const id = generateId()
          const startTime = performance.now()

          yield* Ref.update(activeMeasurements, map =>
            new Map(map).set(id, { name, startTime, metadata })
          )

          return id
        }),

      endMeasurement: (id: string) =>
        Effect.gen(function* () {
          const endTime = performance.now()
          const activeMap = yield* Ref.get(activeMeasurements)
          const active = activeMap.get(id)

          if (!active) {
            yield* Effect.fail(new Error(`No active measurement found for id: ${id}`))
          }

          const measurement: LatencyMeasurement = {
            id,
            name: active.name,
            startTime: active.startTime,
            endTime,
            latency: endTime - active.startTime,
            metadata: active.metadata
          }

          yield* Ref.update(activeMeasurements, map => {
            const newMap = new Map(map)
            newMap.delete(id)
            return newMap
          })

          yield* addMeasurement(measurement)
          return measurement
        }),

      measure: <R, E>(
        name: string,
        effect: Effect.Effect<R, E, never>,
        metadata?: Record<string, unknown>
      ) =>
        Effect.gen(function* () {
          const id = yield* Effect.sync(() => generateId())
          const startTime = yield* Effect.sync(() => performance.now())

          const result = yield* effect

          const endTime = yield* Effect.sync(() => performance.now())
          const measurement: LatencyMeasurement = {
            id,
            name,
            startTime,
            endTime,
            latency: endTime - startTime,
            metadata
          }

          yield* addMeasurement(measurement)
          return result
        }),

      getStats: (name?: string) =>
        Effect.gen(function* () {
          const allMeasurements = yield* Ref.get(measurements)
          
          if (name) {
            const nameLatencies = allMeasurements.get(name) || []
            const latencies = nameLatencies.map(m => m.latency)
            return calculateStats(latencies)
          } else {
            // Aggregate all measurements
            const allLatencies: number[] = []
            for (const latencyList of allMeasurements.values()) {
              allLatencies.push(...latencyList.map(m => m.latency))
            }
            return calculateStats(allLatencies)
          }
        }),

      getAllStats: () =>
        Effect.gen(function* () {
          const allMeasurements = yield* Ref.get(measurements)
          const statsMap = new Map<string, LatencyStats>()
          
          for (const [name, latencyList] of allMeasurements.entries()) {
            const latencies = latencyList.map(m => m.latency)
            statsMap.set(name, calculateStats(latencies))
          }
          
          return statsMap
        }),

      clearMeasurements: (name?: string) =>
        Effect.gen(function* () {
          if (name) {
            yield* Ref.update(measurements, map => {
              const newMap = new Map(map)
              newMap.delete(name)
              return newMap
            })
          } else {
            yield* Ref.set(measurements, new Map())
            yield* Ref.set(activeMeasurements, new Map())
          }
        }),

      setTarget: (target: LatencyTarget) =>
        Ref.update(targets, current => {
          const existing = current.findIndex(t => t.name === target.name)
          if (existing >= 0) {
            const updated = [...current]
            updated[existing] = target
            return updated
          } else {
            return [...current, target]
          }
        }),

      getTargets: () => Ref.get(targets),

      checkTargets: () =>
        Effect.gen(function* () {
          const currentTargets = yield* Ref.get(targets)
          const allMeasurements = yield* Ref.get(measurements)
          const results = []

          for (const target of currentTargets.filter(t => t.enabled)) {
            const latencies = allMeasurements.get(target.name)
            if (latencies && latencies.length > 0) {
              const recentLatency = latencies[latencies.length - 1].latency
              const status = recentLatency > target.criticalThreshold ? 'critical' :
                           recentLatency > target.warningThreshold ? 'warning' : 'ok'
              
              results.push({
                name: target.name,
                status: status as 'ok' | 'warning' | 'critical',
                actualLatency: recentLatency
              })
            }
          }

          return results
        }),

      enableBatching: <T, R>(batchConfig: {
        name: string
        maxBatchSize: number
        maxWaitTime: number
        processor: (requests: T[]) => Promise<R[]>
      }) =>
        Effect.gen(function* () {
          return (request: T): Promise<R> => {
            return new Promise((resolve, reject) => {
              Effect.runSync(
                Effect.gen(function* () {
                  const batches = yield* Ref.get(batchQueues)
                  let batch = batches.get(batchConfig.name) as RequestBatch<T, R>

                  if (!batch) {
                    batch = {
                      id: batchConfig.name,
                      requests: [],
                      batchProcessor: batchConfig.processor,
                      maxBatchSize: batchConfig.maxBatchSize,
                      maxWaitTime: batchConfig.maxWaitTime
                    }

                    yield* Ref.update(batchQueues, map =>
                      new Map(map).set(batchConfig.name, batch)
                    )

                    // Schedule batch processing
                    setTimeout(() => {
                      Effect.runFork(processBatch<T, R>(batchConfig.name))
                    }, batchConfig.maxWaitTime)
                  }

                  batch.requests.push({ id: generateId(), data: request, resolve, reject })

                  // Process immediately if batch is full
                  if (batch.requests.length >= batchConfig.maxBatchSize) {
                    yield* processBatch<T, R>(batchConfig.name)
                  }
                })
              )
            })
          }
        }),

      prefetch: (key: string, generator: () => Promise<any>) =>
        Effect.gen(function* () {
          if (config.enablePrefetching) {
            const result = yield* Effect.fromPromise(generator)
            const ttl = 5 * 60 * 1000 // 5 minutes default TTL
            
            yield* Ref.update(cache, map =>
              new Map(map).set(key, { data: result, timestamp: Date.now(), ttl })
            )
          }
        }),

      getCached: <T>(key: string) =>
        Effect.gen(function* () {
          const cacheMap = yield* Ref.get(cache)
          const cached = cacheMap.get(key)
          
          if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data as T
          }
          
          return null
        }),

      invalidateCache: (pattern?: string) =>
        Effect.gen(function* () {
          if (pattern) {
            const regex = new RegExp(pattern)
            yield* Ref.update(cache, map => {
              const newMap = new Map()
              for (const [key, value] of map.entries()) {
                if (!regex.test(key)) {
                  newMap.set(key, value)
                }
              }
              return newMap
            })
          } else {
            yield* Ref.set(cache, new Map())
          }
        }),

      optimizeLatency: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('🚀 Running latency optimization')
          
          // Clear expired cache entries
          yield* Ref.update(cache, map => {
            const now = Date.now()
            const newMap = new Map()
            for (const [key, value] of map.entries()) {
              if (now - value.timestamp < value.ttl) {
                newMap.set(key, value)
              }
            }
            return newMap
          })

          yield* Effect.logInfo('✅ Latency optimization completed')
        }),

      generateReport: () =>
        Effect.gen(function* () {
          const allStats = yield* Effect.gen(function* () {
            const service = yield* LatencyOptimizerService
            return yield* service.getAllStats()
          })
          const currentTargets = yield* Ref.get(targets)
          
          let report = '📊 Latency Optimization Report\n'
          report += '═'.repeat(50) + '\n\n'
          
          report += '📈 Performance Statistics:\n'
          for (const [name, stats] of allStats.entries()) {
            report += `\n🎯 ${name}:\n`
            report += `  • Count: ${stats.count}\n`
            report += `  • Mean: ${stats.mean.toFixed(2)}ms\n`
            report += `  • Median: ${stats.median.toFixed(2)}ms\n`
            report += `  • P95: ${stats.p95.toFixed(2)}ms\n`
            report += `  • P99: ${stats.p99.toFixed(2)}ms\n`
            report += `  • Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms\n`
          }

          if (currentTargets.length > 0) {
            report += '\n🎯 Target Compliance:\n'
            const targetChecks = yield* Effect.gen(function* () {
              const service = yield* LatencyOptimizerService
              return yield* service.checkTargets()
            })

            for (const check of targetChecks) {
              const statusEmoji = check.status === 'ok' ? '✅' : 
                                 check.status === 'warning' ? '⚠️' : '❌'
              report += `  ${statusEmoji} ${check.name}: ${check.actualLatency.toFixed(2)}ms (${check.status})\n`
            }
          }

          return report
        })
    }
  })

/**
 * Default latency optimizer configuration
 */
export const defaultLatencyConfig: LatencyOptimizerConfig = {
  enablePredictiveOptimization: true,
  enableAdaptiveBatching: true,
  enableRequestCoalescing: true,
  enableCaching: true,
  enablePrefetching: true,
  maxHistorySize: 1000,
  measurementWindow: 60000, // 1 minute
  optimizationInterval: 10000, // 10 seconds
  adaptiveThreshold: 1.2 // 20% increase triggers optimization
}

/**
 * Latency Optimizer Service Layer implementation
 */
export const LatencyOptimizerServiceLive = (config: LatencyOptimizerConfig = defaultLatencyConfig) =>
  Layer.effect(
    LatencyOptimizerService,
    createLatencyOptimizerServiceImpl(config)
  )

/**
 * Latency utilities
 */
export const measureLatency = <R, E>(
  name: string,
  effect: Effect.Effect<R, E, never>,
  metadata?: Record<string, unknown>
): Effect.Effect<R, E, LatencyOptimizerService> =>
  Effect.gen(function* () {
    const service = yield* LatencyOptimizerService
    return yield* service.measure(name, effect, metadata)
  })

/**
 * Create a latency target helper
 */
export const createLatencyTarget = (config: {
  name: string
  targetLatency: number
  warningThreshold?: number
  criticalThreshold?: number
  enabled?: boolean
}): LatencyTarget => ({
  warningThreshold: config.targetLatency * 1.5,
  criticalThreshold: config.targetLatency * 2,
  enabled: true,
  ...config
})

/**
 * Batch multiple operations for latency optimization
 */
export const withBatching = <T, R>(
  name: string,
  processor: (requests: T[]) => Promise<R[]>,
  options: { maxBatchSize?: number; maxWaitTime?: number } = {}
) =>
  Effect.gen(function* () {
    const service = yield* LatencyOptimizerService
    return yield* service.enableBatching({
      name,
      processor,
      maxBatchSize: options.maxBatchSize || 10,
      maxWaitTime: options.maxWaitTime || 100
    })
  })

/**
 * Cache frequently accessed data
 */
export const withCaching = <T>(
  key: string,
  generator: () => Promise<T>
): Effect.Effect<T, Error, LatencyOptimizerService> =>
  Effect.gen(function* () {
    const service = yield* LatencyOptimizerService
    const cached = yield* service.getCached<T>(key)
    
    if (cached) {
      return cached
    }
    
    const result = yield* Effect.fromPromise(generator)
    yield* service.prefetch(key, () => Promise.resolve(result))
    return result
  })