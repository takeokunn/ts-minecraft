import { Effect, Ref, Context, Layer, Duration } from 'effect'

/**
 * Profiling measurement data
 */
export interface ProfileMeasurement {
  readonly name: string
  readonly duration: number
  readonly timestamp: number
  readonly memory?: {
    readonly before: number
    readonly after: number
    readonly delta: number
  }
  readonly metadata?: Record<string, unknown>
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  readonly enableMemoryTracking: boolean
  readonly enableConsoleOutput: boolean
  readonly slowThreshold: number
  readonly maxMeasurements: number
  readonly sampleRate: number
}

/**
 * Profiler statistics
 */
export interface ProfilerStats {
  readonly totalMeasurements: number
  readonly averageDuration: number
  readonly minDuration: number
  readonly maxDuration: number
  readonly slowOperations: number
  readonly memoryAllocated: number
  readonly memoryPeak: number
}

/**
 * Active profile session
 */
export interface ProfileSession {
  readonly id: string
  readonly name: string
  readonly startTime: number
  readonly measurements: ProfileMeasurement[]
}

/**
 * Profiler Service for dependency injection
 */
export const ProfilerService = Context.GenericTag<{
  readonly startMeasurement: (name: string, metadata?: Record<string, unknown>) => Effect.Effect<string, never, never>
  readonly endMeasurement: (id: string) => Effect.Effect<ProfileMeasurement, never, never>
  readonly measure: <R, E>(
    name: string,
    effect: Effect.Effect<R, E, never>,
    metadata?: Record<string, unknown>
  ) => Effect.Effect<R, E, never>
  readonly getMeasurements: () => Effect.Effect<ProfileMeasurement[], never, never>
  readonly getStats: () => Effect.Effect<ProfilerStats, never, never>
  readonly clearMeasurements: () => Effect.Effect<void, never, never>
  readonly startSession: (name: string) => Effect.Effect<string, never, never>
  readonly endSession: (id: string) => Effect.Effect<ProfileSession, never, never>
  readonly getSessions: () => Effect.Effect<ProfileSession[], never, never>
  readonly exportData: () => Effect.Effect<{
    measurements: ProfileMeasurement[]
    sessions: ProfileSession[]
    stats: ProfilerStats
  }, never, never>
}>('ProfilerService')

/**
 * Create profiler service implementation
 */
const createProfilerServiceImpl = (
  config: ProfilerConfig
): Effect.Effect<Context.Tag.Service<typeof ProfilerService>, never, never> =>
  Effect.gen(function* () {
    const measurements = yield* Ref.make<ProfileMeasurement[]>([])
    const activeMeasurements = yield* Ref.make<Map<string, {
      name: string
      startTime: number
      startMemory?: number
      metadata?: Record<string, unknown>
    }>>(new Map())
    const sessions = yield* Ref.make<Map<string, ProfileSession>>(new Map())
    const activeSessions = yield* Ref.make<Map<string, {
      name: string
      startTime: number
      measurements: ProfileMeasurement[]
    }>>(new Map())

    const generateId = () => Math.random().toString(36).substr(2, 9)

    const getMemoryUsage = (): number => {
      if (typeof performance !== 'undefined' && performance.memory) {
        return performance.memory.usedJSHeapSize
      }
      return 0
    }

    const addMeasurement = (measurement: ProfileMeasurement) =>
      Effect.gen(function* () {
        yield* Ref.update(measurements, current => {
          const updated = [...current, measurement]
          return updated.length > config.maxMeasurements
            ? updated.slice(-config.maxMeasurements)
            : updated
        })

        // Add to active sessions
        const activeSessions_ = yield* Ref.get(activeSessions)
        for (const session of activeSessions_.values()) {
          session.measurements.push(measurement)
        }

        // Log slow operations
        if (config.enableConsoleOutput && measurement.duration > config.slowThreshold) {
          yield* Effect.logWarning(
            `Slow operation detected: ${measurement.name} took ${measurement.duration.toFixed(2)}ms`
          )
        }

        // Log memory spikes
        if (config.enableMemoryTracking && measurement.memory && measurement.memory.delta > 1024 * 1024) {
          yield* Effect.logWarning(
            `Memory spike detected: ${measurement.name} allocated ${(measurement.memory.delta / 1024 / 1024).toFixed(2)}MB`
          )
        }
      })

    return {
      startMeasurement: (name: string, metadata?: Record<string, unknown>) =>
        Effect.gen(function* () {
          const id = generateId()
          const startTime = performance.now()
          const startMemory = config.enableMemoryTracking ? getMemoryUsage() : undefined

          yield* Ref.update(activeMeasurements, map => 
            new Map(map).set(id, {
              name,
              startTime,
              startMemory,
              metadata
            })
          )

          return id
        }),

      endMeasurement: (id: string) =>
        Effect.gen(function* () {
          const endTime = performance.now()
          const endMemory = config.enableMemoryTracking ? getMemoryUsage() : undefined
          
          const activeMap = yield* Ref.get(activeMeasurements)
          const active = activeMap.get(id)

          if (!active) {
            yield* Effect.fail(new Error(`No active measurement found for id: ${id}`))
          }

          const measurement: ProfileMeasurement = {
            name: active.name,
            duration: endTime - active.startTime,
            timestamp: active.startTime,
            memory: config.enableMemoryTracking && active.startMemory !== undefined && endMemory !== undefined
              ? {
                  before: active.startMemory,
                  after: endMemory,
                  delta: endMemory - active.startMemory
                }
              : undefined,
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
          // Sample rate check
          if (Math.random() > config.sampleRate) {
            return yield* effect
          }

          const id = yield* Effect.sync(() => generateId())
          const startTime = yield* Effect.sync(() => performance.now())
          const startMemory = config.enableMemoryTracking 
            ? yield* Effect.sync(() => getMemoryUsage())
            : yield* Effect.succeed(undefined)

          const result = yield* effect

          const endTime = yield* Effect.sync(() => performance.now())
          const endMemory = config.enableMemoryTracking 
            ? yield* Effect.sync(() => getMemoryUsage())
            : yield* Effect.succeed(undefined)

          const measurement: ProfileMeasurement = {
            name,
            duration: endTime - startTime,
            timestamp: startTime,
            memory: config.enableMemoryTracking && startMemory !== undefined && endMemory !== undefined
              ? {
                  before: startMemory,
                  after: endMemory,
                  delta: endMemory - startMemory
                }
              : undefined,
            metadata
          }

          yield* addMeasurement(measurement)
          return result
        }),

      getMeasurements: () => Ref.get(measurements),

      getStats: () =>
        Effect.gen(function* () {
          const allMeasurements = yield* Ref.get(measurements)
          
          if (allMeasurements.length === 0) {
            return {
              totalMeasurements: 0,
              averageDuration: 0,
              minDuration: 0,
              maxDuration: 0,
              slowOperations: 0,
              memoryAllocated: 0,
              memoryPeak: 0
            }
          }

          const durations = allMeasurements.map(m => m.duration)
          const memoryDeltas = allMeasurements
            .filter(m => m.memory)
            .map(m => m.memory!.delta)

          return {
            totalMeasurements: allMeasurements.length,
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            slowOperations: allMeasurements.filter(m => m.duration > config.slowThreshold).length,
            memoryAllocated: memoryDeltas.reduce((sum, d) => sum + d, 0),
            memoryPeak: memoryDeltas.length > 0 ? Math.max(...memoryDeltas) : 0
          }
        }),

      clearMeasurements: () => 
        Effect.gen(function* () {
          yield* Ref.set(measurements, [])
          yield* Ref.set(activeMeasurements, new Map())
        }),

      startSession: (name: string) =>
        Effect.gen(function* () {
          const id = generateId()
          const startTime = performance.now()

          yield* Ref.update(activeSessions, map =>
            new Map(map).set(id, {
              name,
              startTime,
              measurements: []
            })
          )

          return id
        }),

      endSession: (id: string) =>
        Effect.gen(function* () {
          const activeMap = yield* Ref.get(activeSessions)
          const active = activeMap.get(id)

          if (!active) {
            yield* Effect.fail(new Error(`No active session found for id: ${id}`))
          }

          const session: ProfileSession = {
            id,
            name: active.name,
            startTime: active.startTime,
            measurements: [...active.measurements]
          }

          yield* Ref.update(activeSessions, map => {
            const newMap = new Map(map)
            newMap.delete(id)
            return newMap
          })

          yield* Ref.update(sessions, map =>
            new Map(map).set(id, session)
          )

          return session
        }),

      getSessions: () =>
        Effect.gen(function* () {
          const sessionMap = yield* Ref.get(sessions)
          return Array.from(sessionMap.values())
        }),

      exportData: () =>
        Effect.gen(function* () {
          const allMeasurements = yield* Ref.get(measurements)
          const allSessions = yield* Ref.get(sessions)
          const stats = yield* Effect.sync(() => ({
            totalMeasurements: allMeasurements.length,
            averageDuration: allMeasurements.length > 0
              ? allMeasurements.reduce((sum, m) => sum + m.duration, 0) / allMeasurements.length
              : 0,
            minDuration: allMeasurements.length > 0 ? Math.min(...allMeasurements.map(m => m.duration)) : 0,
            maxDuration: allMeasurements.length > 0 ? Math.max(...allMeasurements.map(m => m.duration)) : 0,
            slowOperations: allMeasurements.filter(m => m.duration > config.slowThreshold).length,
            memoryAllocated: allMeasurements
              .filter(m => m.memory)
              .reduce((sum, m) => sum + m.memory!.delta, 0),
            memoryPeak: allMeasurements
              .filter(m => m.memory)
              .reduce((max, m) => Math.max(max, m.memory!.delta), 0)
          }))

          return {
            measurements: allMeasurements,
            sessions: Array.from(allSessions.values()),
            stats
          }
        })
    }
  })

/**
 * Default profiler configuration
 */
export const defaultProfilerConfig: ProfilerConfig = {
  enableMemoryTracking: true,
  enableConsoleOutput: false,
  slowThreshold: 16, // 60fps threshold
  maxMeasurements: 1000,
  sampleRate: 1.0 // Profile all operations by default
}

/**
 * Profiler Service Layer implementation
 */
export const ProfilerServiceLive = (config: ProfilerConfig = defaultProfilerConfig) =>
  Layer.effect(
    ProfilerService,
    createProfilerServiceImpl(config)
  )

/**
 * Profiling decorators and utilities
 */
export const profile = (name?: string) => 
  <R, E>(effect: Effect.Effect<R, E, ProfilerService>): Effect.Effect<R, E, ProfilerService> =>
    Effect.gen(function* () {
      const profiler = yield* ProfilerService
      const operationName = name || 'anonymous'
      return yield* profiler.measure(operationName, effect)
    })

/**
 * Profile an async function
 */
export const profileAsync = <T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
) =>
  (...args: T): Effect.Effect<R, never, ProfilerService> =>
    Effect.gen(function* () {
      const profiler = yield* ProfilerService
      const asyncEffect = Effect.fromPromise(() => fn(...args))
      return yield* profiler.measure(name, asyncEffect)
    })

/**
 * Profile a synchronous function
 */
export const profileSync = <T extends any[], R>(
  name: string,
  fn: (...args: T) => R
) =>
  (...args: T): Effect.Effect<R, never, ProfilerService> =>
    Effect.gen(function* () {
      const profiler = yield* ProfilerService
      const syncEffect = Effect.sync(() => fn(...args))
      return yield* profiler.measure(name, syncEffect)
    })

/**
 * Batch profile multiple operations
 */
export const profileBatch = (
  operations: Array<{
    name: string
    effect: Effect.Effect<any, any, ProfilerService>
  }>
): Effect.Effect<any[], any, ProfilerService> =>
  Effect.gen(function* () {
    const results = []
    for (const op of operations) {
      const result = yield* profile(op.name)(op.effect)
      results.push(result)
    }
    return results
  })

/**
 * Create a profiling session for complex operations
 */
export const withSession = <R, E>(
  sessionName: string,
  effect: Effect.Effect<R, E, ProfilerService>
): Effect.Effect<R, E, ProfilerService> =>
  Effect.gen(function* () {
    const profiler = yield* ProfilerService
    const sessionId = yield* profiler.startSession(sessionName)
    
    try {
      const result = yield* effect
      yield* profiler.endSession(sessionId)
      return result
    } catch (error) {
      yield* profiler.endSession(sessionId)
      throw error
    }
  })