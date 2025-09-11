import { Effect, Ref, pipe } from 'effect'

/**
 * Performance profiler with automatic measurement capabilities
 * Provides decorators and utilities for measuring function execution times
 */

export interface ProfileMeasurement {
  readonly name: string
  readonly startTime: number
  readonly endTime: number
  readonly duration: number
  readonly memoryBefore?: number
  readonly memoryAfter?: number
  readonly memoryDelta?: number
}

export interface ProfilerConfig {
  readonly enableMemoryTracking: boolean
  readonly enableConsoleOutput: boolean
  readonly slowThreshold: number // ms
  readonly maxMeasurements: number
}

export interface ProfilerState {
  readonly measurements: ReadonlyArray<ProfileMeasurement>
  readonly activeMeasurements: Map<string, { startTime: number; memoryBefore?: number }>
}

/**
 * Global profiler instance
 */
let profilerState: Ref.Ref<ProfilerState> | null = null
let profilerConfig: ProfilerConfig = {
  enableMemoryTracking: true,
  enableConsoleOutput: false,
  slowThreshold: 16, // 60fps threshold
  maxMeasurements: 1000
}

/**
 * Initialize the profiler
 */
export const initializeProfiler = (config?: Partial<ProfilerConfig>): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    profilerConfig = { ...profilerConfig, ...config }
    
    profilerState = yield* Ref.make<ProfilerState>({
      measurements: [],
      activeMeasurements: new Map()
    })
    
    yield* Effect.log('Performance profiler initialized')
  })

/**
 * Get current memory usage if available
 */
const getCurrentMemory = (): number | undefined => {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize
  }
  return undefined
}

/**
 * Start a performance measurement
 */
const startMeasurement = (name: string): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!profilerState) {
      return
    }
    
    const startTime = performance.now()
    const memoryBefore = profilerConfig.enableMemoryTracking ? getCurrentMemory() : undefined
    
    yield* Ref.update(profilerState, state => ({
      ...state,
      activeMeasurements: new Map(state.activeMeasurements).set(name, { startTime, memoryBefore })
    }))
    
    if (profilerConfig.enableConsoleOutput) {
      yield* Effect.log(`🔄 Starting measurement: ${name}`)
    }
  })

/**
 * End a performance measurement
 */
const endMeasurement = (name: string): Effect.Effect<ProfileMeasurement | null, never, never> =>
  Effect.gen(function* () {
    if (!profilerState) {
      return null
    }
    
    const endTime = performance.now()
    const memoryAfter = profilerConfig.enableMemoryTracking ? getCurrentMemory() : undefined
    
    const state = yield* Ref.get(profilerState)
    const active = state.activeMeasurements.get(name)
    
    if (!active) {
      yield* Effect.logWarning(`No active measurement found for: ${name}`)
      return null
    }
    
    const duration = endTime - active.startTime
    const memoryDelta = active.memoryBefore && memoryAfter 
      ? memoryAfter - active.memoryBefore 
      : undefined
    
    const measurement: ProfileMeasurement = {
      name,
      startTime: active.startTime,
      endTime,
      duration,
      memoryBefore: active.memoryBefore,
      memoryAfter,
      memoryDelta
    }
    
    // Update state
    const newActiveMeasurements = new Map(state.activeMeasurements)
    newActiveMeasurements.delete(name)
    
    const measurements = [...state.measurements, measurement]
    // Keep only the last maxMeasurements
    const trimmedMeasurements = measurements.length > profilerConfig.maxMeasurements
      ? measurements.slice(-profilerConfig.maxMeasurements)
      : measurements
    
    yield* Ref.set(profilerState, {
      measurements: trimmedMeasurements,
      activeMeasurements: newActiveMeasurements
    })
    
    // Log slow operations
    if (duration > profilerConfig.slowThreshold) {
      yield* Effect.logWarning(`🐌 Slow operation: ${name} took ${duration.toFixed(2)}ms (threshold: ${profilerConfig.slowThreshold}ms)`)
    }
    
    if (profilerConfig.enableConsoleOutput) {
      const memoryInfo = memoryDelta ? ` | Memory: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB` : ''
      yield* Effect.log(`✅ Completed measurement: ${name} - ${duration.toFixed(2)}ms${memoryInfo}`)
    }
    
    return measurement
  })

/**
 * Main Profile API
 */
export const Profile = {
  /**
   * Measure decorator for Effect operations
   */
  measure: <A, E, R>(name: string) =>
    (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      Effect.gen(function* () {
        yield* startMeasurement(name)
        
        try {
          const result = yield* effect
          yield* endMeasurement(name)
          return result
        } catch (error) {
          yield* endMeasurement(name)
          throw error
        }
      }),
  
  /**
   * Measure a synchronous function
   */
  measureSync: <Args extends ReadonlyArray<any>, Return>(
    name: string,
    fn: (...args: Args) => Return
  ) =>
    (...args: Args): Effect.Effect<Return, never, never> =>
      Effect.gen(function* () {
        yield* startMeasurement(name)
        const result = fn(...args)
        yield* endMeasurement(name)
        return result
      }),
  
  /**
   * Get current memory usage
   */
  memory: (): { heap: number; limit: number } | null => {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      return {
        heap: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    }
    return null
  },
  
  /**
   * Start a manual measurement
   */
  start: (name: string) => startMeasurement(name),
  
  /**
   * End a manual measurement
   */
  end: (name: string) => endMeasurement(name),
  
  /**
   * Clear all measurements
   */
  clear: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!profilerState) {
        return
      }
      
      yield* Ref.set(profilerState, {
        measurements: [],
        activeMeasurements: new Map()
      })
      
      yield* Effect.log('Profiler measurements cleared')
    }),
  
  /**
   * Get all measurements
   */
  getMeasurements: (): Effect.Effect<ReadonlyArray<ProfileMeasurement>, never, never> =>
    Effect.gen(function* () {
      if (!profilerState) {
        return []
      }
      
      const state = yield* Ref.get(profilerState)
      return state.measurements
    }),
  
  /**
   * Get measurements by name pattern
   */
  getMeasurementsByPattern: (pattern: RegExp): Effect.Effect<ReadonlyArray<ProfileMeasurement>, never, never> =>
    Effect.gen(function* () {
      const measurements = yield* Profile.getMeasurements()
      return measurements.filter(m => pattern.test(m.name))
    }),
  
  /**
   * Get performance statistics for a specific measurement name
   */
  getStats: (name: string): Effect.Effect<{
    count: number
    totalTime: number
    averageTime: number
    minTime: number
    maxTime: number
    p50: number
    p90: number
    p95: number
    p99: number
  } | null, never, never> =>
    Effect.gen(function* () {
      const measurements = yield* Profile.getMeasurements()
      const filtered = measurements.filter(m => m.name === name)
      
      if (filtered.length === 0) {
        return null
      }
      
      const durations = filtered.map(m => m.duration).sort((a, b) => a - b)
      const totalTime = durations.reduce((sum, d) => sum + d, 0)
      
      const percentile = (p: number) => {
        const index = Math.floor((durations.length - 1) * p / 100)
        return durations[index]
      }
      
      return {
        count: filtered.length,
        totalTime,
        averageTime: totalTime / filtered.length,
        minTime: Math.min(...durations),
        maxTime: Math.max(...durations),
        p50: percentile(50),
        p90: percentile(90),
        p95: percentile(95),
        p99: percentile(99)
      }
    }),
  
  /**
   * Generate a performance report
   */
  generateReport: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const measurements = yield* Profile.getMeasurements()
      
      if (measurements.length === 0) {
        return 'No performance measurements recorded'
      }
      
      // Group by name
      const groupedMeasurements = new Map<string, ProfileMeasurement[]>()
      for (const measurement of measurements) {
        const group = groupedMeasurements.get(measurement.name) || []
        group.push(measurement)
        groupedMeasurements.set(measurement.name, group)
      }
      
      let report = '📊 Performance Report\n'
      report += '═'.repeat(50) + '\n\n'
      
      for (const [name, group] of groupedMeasurements.entries()) {
        const stats = yield* Profile.getStats(name)
        if (!stats) continue
        
        report += `🔍 ${name}\n`
        report += `   Count: ${stats.count}\n`
        report += `   Average: ${stats.averageTime.toFixed(2)}ms\n`
        report += `   Min/Max: ${stats.minTime.toFixed(2)}ms / ${stats.maxTime.toFixed(2)}ms\n`
        report += `   P90/P95/P99: ${stats.p90.toFixed(2)}ms / ${stats.p95.toFixed(2)}ms / ${stats.p99.toFixed(2)}ms\n`
        
        // Memory info if available
        const withMemory = group.filter(m => m.memoryDelta !== undefined)
        if (withMemory.length > 0) {
          const totalMemory = withMemory.reduce((sum, m) => sum + (m.memoryDelta || 0), 0)
          const avgMemory = totalMemory / withMemory.length
          report += `   Avg Memory Delta: ${(avgMemory / 1024 / 1024).toFixed(2)}MB\n`
        }
        
        report += '\n'
      }
      
      return report
    })
}

/**
 * Decorator function for class methods
 */
export const measure = (name?: string) => {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const measurementName = name || `${target.constructor.name}.${propertyName}`
    
    descriptor.value = function (...args: any[]) {
      const result = method.apply(this, args)
      
      // If result is an Effect, wrap it
      if (result && typeof result === 'object' && '_tag' in result) {
        return Profile.measure(measurementName)(result)
      }
      
      // Otherwise measure synchronously
      return Effect.runSync(Profile.measureSync(measurementName, () => result)())
    }
    
    return descriptor
  }
}

/**
 * Higher-order function to wrap any function with profiling
 */
export const withProfiling = <Args extends ReadonlyArray<any>, Return>(
  name: string,
  fn: (...args: Args) => Return
) =>
  (...args: Args): Return => {
    const start = performance.now()
    const memoryBefore = profilerConfig.enableMemoryTracking ? getCurrentMemory() : undefined
    
    try {
      const result = fn(...args)
      const end = performance.now()
      const duration = end - start
      
      // Log if over threshold
      if (duration > profilerConfig.slowThreshold) {
        console.warn(`🐌 Slow sync operation: ${name} took ${duration.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const end = performance.now()
      const duration = end - start
      console.error(`❌ Error in ${name} after ${duration.toFixed(2)}ms:`, error)
      throw error
    }
  }

/**
 * Batch measurement utility
 */
export const measureBatch = <T>(
  name: string,
  items: ReadonlyArray<T>,
  processor: (item: T) => Effect.Effect<any, any, any>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const batchName = `${name}:batch(${items.length})`
    yield* Profile.start(batchName)
    
    try {
      for (let i = 0; i < items.length; i++) {
        const itemName = `${name}:item[${i}]`
        yield* Profile.measure(itemName)(processor(items[i]))
      }
    } finally {
      yield* Profile.end(batchName)
    }
  })