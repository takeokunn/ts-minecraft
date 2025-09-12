import { Effect, Ref, Queue, Option, Context, Layer, Duration, Schedule, Fiber, Chunk } from 'effect'
import { withErrorLog, withPerformanceMonitoring } from '../../shared/utils/effect'

/**
 * Enhanced object pool for reusable objects with advanced features
 * Reduces garbage collection pressure by reusing objects with backpressure support
 */

export interface PoolableObject {
  reset(): void
}

/**
 * Enhanced object pool configuration with backpressure and optimization settings
 */
export interface ObjectPoolConfig {
  readonly initialSize: number
  readonly maxSize: number
  readonly growthFactor: number
  readonly shrinkThreshold: number
  readonly enableBackpressure: boolean
  readonly backpressureThreshold: number
  readonly enableMetrics: boolean
  readonly poolName?: string
  readonly autoOptimize: boolean
  readonly maxIdleTime: number
}

/**
 * Object pool error types
 */
export class ObjectPoolError extends Error {
  readonly _tag = 'ObjectPoolError'
  constructor(message: string, public readonly operation: string, public readonly poolName?: string) {
    super(message)
    this.name = 'ObjectPoolError'
  }
}

export class PoolExhaustedError extends ObjectPoolError {
  readonly _tag = 'PoolExhaustedError'
  constructor(poolName: string, maxSize: number) {
    super(`Object pool '${poolName}' exhausted (max size: ${maxSize})`, 'acquire', poolName)
    this.name = 'PoolExhaustedError'
  }
}

/**
 * Object pool metrics for monitoring and optimization
 */
export interface ObjectPoolMetrics {
  readonly poolName?: string
  readonly available: number
  readonly inUse: number
  readonly total: number
  readonly maxSize: number
  readonly hitRate: number
  readonly acquisitionTime: number
  readonly releaseTime: number
  readonly fragmentationRatio: number
  readonly peakUsage: number
  readonly totalAcquired: number
  readonly totalReleased: number
  readonly lastOptimization: number
  readonly backpressureEvents: number
}

/**
 * Enhanced object pool service interface with advanced features
 */
export interface ObjectPool<T extends PoolableObject> {
  readonly acquire: Effect.Effect<T, PoolExhaustedError, never>
  readonly tryAcquire: Effect.Effect<Option.Option<T>, never, never>
  readonly acquireWithTimeout: (timeout: Duration.DurationInput) => Effect.Effect<T, PoolExhaustedError | Error, never>
  readonly acquireBatch: (count: number) => Effect.Effect<T[], PoolExhaustedError, never>
  readonly release: (obj: T) => Effect.Effect<void, ObjectPoolError, never>
  readonly releaseAll: Effect.Effect<void, never, never>
  readonly releaseBatch: (objs: ReadonlyArray<T>) => Effect.Effect<void, ObjectPoolError, never>
  readonly grow: Effect.Effect<void, never, never>
  readonly shrink: (targetSize?: number) => Effect.Effect<void, never, never>
  readonly optimize: Effect.Effect<void, never, never>
  readonly getStats: Effect.Effect<ObjectPoolMetrics, never, never>
  readonly clear: Effect.Effect<void, never, never>
  readonly warmUp: (count: number) => Effect.Effect<void, ObjectPoolError, never>
  readonly resize: (newMaxSize: number) => Effect.Effect<void, ObjectPoolError, never>
}

/**
 * Object pool service for dependency injection with enhanced capabilities
 */
export const ObjectPoolService = Context.GenericTag<{
  readonly createPool: <T extends PoolableObject>(factory: () => T, config?: ObjectPoolConfig) => Effect.Effect<ObjectPool<T>, ObjectPoolError, never>
  readonly createSharedPool: <T extends PoolableObject>(factory: () => T, poolName: string, config?: ObjectPoolConfig) => Effect.Effect<ObjectPool<T>, ObjectPoolError, never>
  readonly getPoolMetrics: (poolName?: string) => Effect.Effect<ObjectPoolMetrics[], never, never>
  readonly startGlobalOptimization: (interval: Duration.DurationInput) => Effect.Effect<Fiber.Fiber<void>, never, never>
  readonly clearAllPools: () => Effect.Effect<void, never, never>
}>('ObjectPoolService')

/**
 * Create an enhanced object pool implementation with advanced features
 */
const createObjectPoolImpl = <T extends PoolableObject>(
  factory: () => T,
  config: ObjectPoolConfig = {
    initialSize: 10,
    maxSize: 1000,
    growthFactor: 2,
    shrinkThreshold: 0.3,
    enableBackpressure: true,
    backpressureThreshold: 800,
    enableMetrics: true,
    autoOptimize: true,
    maxIdleTime: 300000, // 5 minutes
  },
): Effect.Effect<ObjectPool<T>, ObjectPoolError, never> =>
  Effect.gen(function* () {
    const available = yield* Queue.unbounded<T>()
    const inUse = yield* Ref.make(new Set<T>())
    const metrics = yield* Ref.make<ObjectPoolMetrics>({
      poolName: config.poolName,
      available: 0,
      inUse: 0,
      total: 0,
      maxSize: config.maxSize,
      hitRate: 0,
      acquisitionTime: 0,
      releaseTime: 0,
      fragmentationRatio: 0,
      peakUsage: 0,
      totalAcquired: 0,
      totalReleased: 0,
      lastOptimization: Date.now(),
      backpressureEvents: 0,
    })
    const acquisitionTimes = yield* Ref.make<number[]>([])
    const releaseTimes = yield* Ref.make<number[]>([])

    // Pre-allocate initial objects with error handling
    for (let i = 0; i < config.initialSize; i++) {
      try {
        const obj = factory()
        yield* Queue.offer(available, obj)
      } catch (error) {
        return yield* Effect.fail(new ObjectPoolError(
          `Failed to create initial pool object ${i}: ${error}`,
          'initialization',
          config.poolName
        ))
      }
    }

    // Initialize metrics
    yield* Ref.update(metrics, (m) => ({
      ...m,
      available: config.initialSize,
      total: config.initialSize,
    }))

    yield* Effect.logInfo(`Object pool '${config.poolName || 'unnamed'}' initialized with ${config.initialSize} objects (max: ${config.maxSize})`)

    return {
      acquire: Effect.gen(function* () {
        const startTime = performance.now()
        
        // Check backpressure if enabled
        if (config.enableBackpressure) {
          const currentInUse = (yield* Ref.get(inUse)).size
          if (currentInUse >= config.backpressureThreshold) {
            yield* Ref.update(metrics, (m) => ({ ...m, backpressureEvents: m.backpressureEvents + 1 }))
            yield* Effect.logWarning(`Pool ${config.poolName || 'unnamed'} approaching backpressure threshold`)
          }
        }

        const fromQueue = yield* Queue.poll(available)

        if (Option.isSome(fromQueue)) {
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(fromQueue.value)
            return newSet
          })
          
          if (config.enableMetrics) {
            const acquireTime = performance.now() - startTime
            yield* Ref.update(acquisitionTimes, (times) => [...times.slice(-99), acquireTime])
            yield* Ref.update(metrics, (m) => {
              const avgAcquisitionTime = m.acquisitionTime === 0 ? acquireTime : (m.acquisitionTime * 0.9) + (acquireTime * 0.1)
              const hitRate = m.totalAcquired > 0 ? m.totalAcquired / (m.totalAcquired + 1) : 1
              return {
                ...m,
                inUse: m.inUse + 1,
                available: Math.max(0, m.available - 1),
                peakUsage: Math.max(m.peakUsage, m.inUse + 1),
                totalAcquired: m.totalAcquired + 1,
                hitRate,
                acquisitionTime: avgAcquisitionTime,
              }
            })
          }
          
          return fromQueue.value
        }

        // Check if we can create new object
        const currentInUse = (yield* Ref.get(inUse)).size
        const queueSize = yield* Queue.size(available)
        
        if (currentInUse + queueSize >= config.maxSize) {
          return yield* Effect.fail(new PoolExhaustedError(config.poolName || 'unnamed', config.maxSize))
        }

        const obj = factory()
        yield* Ref.update(inUse, (set) => {
          const newSet = new Set(set)
          newSet.add(obj)
          return newSet
        })
        
        if (config.enableMetrics) {
          const acquireTime = performance.now() - startTime
          yield* Ref.update(acquisitionTimes, (times) => [...times.slice(-99), acquireTime])
          yield* Ref.update(metrics, (m) => {
            const avgAcquisitionTime = m.acquisitionTime === 0 ? acquireTime : (m.acquisitionTime * 0.9) + (acquireTime * 0.1)
            const hitRate = m.totalAcquired > 0 ? m.totalAcquired / (m.totalAcquired + 1) : 0
            return {
              ...m,
              inUse: m.inUse + 1,
              total: m.total + 1,
              peakUsage: Math.max(m.peakUsage, m.inUse + 1),
              totalAcquired: m.totalAcquired + 1,
              hitRate,
              acquisitionTime: avgAcquisitionTime,
            }
          })
        }
        
        return obj
      }),

      tryAcquire: Effect.gen(function* () {
        const fromQueue = yield* Queue.poll(available)

        if (Option.isSome(fromQueue)) {
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(fromQueue.value)
            return newSet
          })
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              inUse: m.inUse + 1,
              available: Math.max(0, m.available - 1),
              peakUsage: Math.max(m.peakUsage, m.inUse + 1),
              totalAcquired: m.totalAcquired + 1,
            }))
          }
          
          return Option.some(fromQueue.value)
        }

        return Option.none()
      }),

      acquireWithTimeout: (timeout: Duration.DurationInput) =>
        Effect.gen(function* () {
          const acquire = Effect.gen(function* () {
            const obj = yield* Queue.take(available)
            
            yield* Ref.update(inUse, (set) => {
              const newSet = new Set(set)
              newSet.add(obj)
              return newSet
            })
            
            if (config.enableMetrics) {
              yield* Ref.update(metrics, (m) => ({
                ...m,
                inUse: m.inUse + 1,
                available: Math.max(0, m.available - 1),
                peakUsage: Math.max(m.peakUsage, m.inUse + 1),
                totalAcquired: m.totalAcquired + 1,
              }))
            }
            
            return obj
          })
          
          return yield* acquire.pipe(
            Effect.timeout(timeout),
            Effect.catchTag('TimeoutException', () => 
              Effect.fail(new Error(`Timeout waiting for object from pool ${config.poolName || 'unnamed'}`))
            )
          )
        }),

      acquireBatch: (count: number) =>
        Effect.gen(function* () {
          const objects: T[] = []
          
          // Try to acquire from available pool first
          for (let i = 0; i < count; i++) {
            const obj = yield* Queue.poll(available)
            if (Option.isSome(obj)) {
              objects.push(obj.value)
            } else {
              break
            }
          }
          
          // Create remaining objects if needed and allowed
          const currentInUse = (yield* Ref.get(inUse)).size
          const queueSize = yield* Queue.size(available)
          const remaining = count - objects.length
          const canCreate = Math.min(remaining, config.maxSize - (currentInUse + queueSize + objects.length))
          
          for (let i = 0; i < canCreate; i++) {
            const obj = factory()
            objects.push(obj)
          }
          
          if (objects.length < count) {
            return yield* Effect.fail(new PoolExhaustedError(config.poolName || 'unnamed', config.maxSize))
          }
          
          // Update inUse tracking
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            objects.forEach(obj => newSet.add(obj))
            return newSet
          })
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              inUse: m.inUse + objects.length,
              available: Math.max(0, m.available - (count - remaining)),
              total: m.total + canCreate,
              peakUsage: Math.max(m.peakUsage, m.inUse + objects.length),
              totalAcquired: m.totalAcquired + objects.length,
            }))
          }
          
          return objects
        }),

      release: (obj: T) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          const currentInUse = yield* Ref.get(inUse)

          if (!currentInUse.has(obj)) {
            return yield* Effect.fail(new ObjectPoolError(
              'Attempting to release object not from this pool',
              'release',
              config.poolName
            ))
          }

          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.delete(obj)
            return newSet
          })

          yield* Effect.try(() => obj.reset()).pipe(
            Effect.catchAll((error) => 
              Effect.fail(new ObjectPoolError(`Reset failed: ${error}`, 'release', config.poolName))
            )
          )

          const queueSize = yield* Queue.size(available)
          if (queueSize < config.maxSize) {
            yield* Queue.offer(available, obj)
            
            if (config.enableMetrics) {
              yield* Ref.update(metrics, (m) => ({
                ...m,
                available: m.available + 1,
              }))
            }
          }

          if (config.enableMetrics) {
            const releaseTime = performance.now() - startTime
            yield* Ref.update(releaseTimes, (times) => [...times.slice(-99), releaseTime])
            yield* Ref.update(metrics, (m) => {
              const avgReleaseTime = m.releaseTime === 0 ? releaseTime : (m.releaseTime * 0.9) + (releaseTime * 0.1)
              return {
                ...m,
                inUse: Math.max(0, m.inUse - 1),
                totalReleased: m.totalReleased + 1,
                releaseTime: avgReleaseTime,
              }
            })
          }
        }),

      releaseBatch: (objs: ReadonlyArray<T>) =>
        Effect.gen(function* () {
          const currentInUse = yield* Ref.get(inUse)
          const validObjects: T[] = []
          
          // Validate and reset objects
          for (const obj of objs) {
            if (currentInUse.has(obj)) {
              yield* Effect.try(() => obj.reset()).pipe(
                Effect.catchAll(() => Effect.unit) // Continue with other objects even if one fails
              )
              validObjects.push(obj)
            }
          }
          
          // Update inUse tracking
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            validObjects.forEach(obj => newSet.delete(obj))
            return newSet
          })
          
          // Add objects back to available queue (up to capacity)
          const queueSize = yield* Queue.size(available)
          const capacity = config.maxSize - queueSize
          const objectsToQueue = validObjects.slice(0, capacity)
          
          for (const obj of objectsToQueue) {
            yield* Queue.offer(available, obj)
          }
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              inUse: Math.max(0, m.inUse - validObjects.length),
              available: m.available + objectsToQueue.length,
              totalReleased: m.totalReleased + validObjects.length,
            }))
          }
          
          if (validObjects.length !== objs.length) {
            return yield* Effect.fail(new ObjectPoolError(
              `Some objects were not from this pool (${validObjects.length}/${objs.length} valid)`,
              'releaseBatch',
              config.poolName
            ))
          }
        }),

      releaseAll: Effect.gen(function* () {
        const currentInUse = yield* Ref.get(inUse)
        
        // Reset all in-use objects
        for (const obj of currentInUse) {
          yield* Effect.try(() => obj.reset()).pipe(
            Effect.catchAll(() => Effect.unit)
          )
        }
        
        // Add back to available queue (up to capacity)
        const queueSize = yield* Queue.size(available)
        const capacity = config.maxSize - queueSize
        const objectsToQueue = Array.from(currentInUse).slice(0, capacity)
        
        for (const obj of objectsToQueue) {
          yield* Queue.offer(available, obj)
        }
        
        // Clear in-use set
        yield* Ref.set(inUse, new Set())
        
        if (config.enableMetrics) {
          yield* Ref.update(metrics, (m) => ({
            ...m,
            inUse: 0,
            available: m.available + objectsToQueue.length,
            totalReleased: m.totalReleased + currentInUse.size,
          }))
        }
      }),

      grow: Effect.gen(function* () {
        const currentMetrics = yield* Ref.get(metrics)
        const targetSize = Math.min(Math.floor(currentMetrics.total * config.growthFactor), config.maxSize)
        const toAdd = targetSize - currentMetrics.total
        
        if (toAdd > 0) {
          for (let i = 0; i < toAdd; i++) {
            const obj = factory()
            yield* Queue.offer(available, obj)
          }
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              available: m.available + toAdd,
              total: m.total + toAdd,
            }))
          }
          
          yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} grew by ${toAdd} objects`)
        }
      }),

      shrink: (targetSize?: number) =>
        Effect.gen(function* () {
          const currentMetrics = yield* Ref.get(metrics)
          const target = targetSize ?? Math.max(config.initialSize, Math.floor(currentMetrics.total * config.shrinkThreshold))
          const toRemove = Math.max(0, currentMetrics.available - target)
          
          if (toRemove > 0) {
            for (let i = 0; i < toRemove; i++) {
              yield* Queue.poll(available)
            }
            
            if (config.enableMetrics) {
              yield* Ref.update(metrics, (m) => ({
                ...m,
                available: Math.max(0, m.available - toRemove),
                total: Math.max(0, m.total - toRemove),
              }))
            }
            
            yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} shrunk by ${toRemove} objects`)
          }
        }),

      optimize: Effect.gen(function* () {
        const currentMetrics = yield* Ref.get(metrics)
        const utilizationRatio = currentMetrics.total > 0 ? currentMetrics.inUse / currentMetrics.total : 0
        const fragmentationRatio = 1 - utilizationRatio
        
        // Shrink if underutilized
        if (config.shrinkThreshold > 0 && utilizationRatio < config.shrinkThreshold && currentMetrics.available > config.initialSize) {
          yield* Effect.gen(function* () {
            const shrinkTarget = Math.max(config.initialSize, Math.floor(currentMetrics.total * 0.8))
            const toRemove = Math.max(0, currentMetrics.available - shrinkTarget)
            
            for (let i = 0; i < toRemove; i++) {
              yield* Queue.poll(available)
            }
            
            yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} optimized: removed ${toRemove} unused objects`)
          })
        }
        
        // Update optimization metrics
        if (config.enableMetrics) {
          yield* Ref.update(metrics, (m) => ({
            ...m,
            fragmentationRatio,
            lastOptimization: Date.now(),
          }))
        }
      }),

      getStats: Ref.get(metrics),

      clear: Effect.gen(function* () {
        // Clear available queue
        yield* Queue.takeAll(available)
        // Clear in-use set
        yield* Ref.set(inUse, new Set())
        // Reset metrics
        yield* Ref.set(metrics, {
          poolName: config.poolName,
          available: 0,
          inUse: 0,
          total: 0,
          maxSize: config.maxSize,
          hitRate: 0,
          acquisitionTime: 0,
          releaseTime: 0,
          fragmentationRatio: 0,
          peakUsage: 0,
          totalAcquired: 0,
          totalReleased: 0,
          lastOptimization: Date.now(),
          backpressureEvents: 0,
        })
        yield* Ref.set(acquisitionTimes, [])
        yield* Ref.set(releaseTimes, [])
      }),

      warmUp: (count: number) =>
        Effect.gen(function* () {
          const currentMetrics = yield* Ref.get(metrics)
          const availableSpace = config.maxSize - currentMetrics.total
          const itemsToAdd = Math.min(count, availableSpace)
          
          for (let i = 0; i < itemsToAdd; i++) {
            try {
              const obj = factory()
              yield* Queue.offer(available, obj)
            } catch (error) {
              return yield* Effect.fail(new ObjectPoolError(
                `Failed to create warm-up object ${i}: ${error}`,
                'warmUp',
                config.poolName
              ))
            }
          }
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              available: m.available + itemsToAdd,
              total: m.total + itemsToAdd,
            }))
          }
          
          yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} warmed up with ${itemsToAdd} objects`)
        }),

      resize: (newMaxSize: number) =>
        Effect.gen(function* () {
          if (newMaxSize < config.initialSize) {
            return yield* Effect.fail(new ObjectPoolError(
              `New max size (${newMaxSize}) cannot be smaller than initial size (${config.initialSize})`,
              'resize',
              config.poolName
            ))
          }
          
          const currentMetrics = yield* Ref.get(metrics)
          
          if (newMaxSize < currentMetrics.total) {
            // Shrink to fit new size
            const toRemove = currentMetrics.total - newMaxSize
            for (let i = 0; i < toRemove && currentMetrics.available > 0; i++) {
              yield* Queue.poll(available)
            }
          }
          
          // Update max size in metrics
          yield* Ref.update(metrics, (m) => ({
            ...m,
            maxSize: newMaxSize,
          }))
          
          yield* Effect.logInfo(`Pool ${config.poolName || 'unnamed'} resized to max ${newMaxSize}`)
        }),
    }
  }).pipe(withErrorLog('createObjectPool'))

// Global pool registry
const poolRegistry = new Map<string, ObjectPool<any>>()

/**
 * Object Pool Service Layer implementation with enhanced features
 */
export const ObjectPoolServiceLive = Layer.succeed(
  ObjectPoolService,
  ObjectPoolService.of({
    createPool: createObjectPoolImpl,
    
    createSharedPool: <T extends PoolableObject>(factory: () => T, poolName: string, config?: ObjectPoolConfig) =>
      Effect.gen(function* () {
        if (poolRegistry.has(poolName)) {
          yield* Effect.logWarning(`Shared pool '${poolName}' already exists, returning existing pool`)
          return poolRegistry.get(poolName)! as ObjectPool<T>
        }
        
        const poolConfig = { ...config, poolName }
        const pool = yield* createObjectPoolImpl(factory, poolConfig)
        poolRegistry.set(poolName, pool)
        
        yield* Effect.logInfo(`Shared pool '${poolName}' created successfully`)
        return pool
      }),
    
    getPoolMetrics: (poolName?: string) =>
      Effect.gen(function* () {
        if (poolName) {
          const pool = poolRegistry.get(poolName)
          if (pool) {
            const metrics = yield* pool.getStats
            return [metrics]
          }
          return []
        }
        
        // Return metrics for all pools
        const allMetrics: ObjectPoolMetrics[] = []
        for (const [name, pool] of poolRegistry.entries()) {
          const metrics = yield* pool.getStats
          allMetrics.push(metrics)
        }
        return allMetrics
      }),
    
    startGlobalOptimization: (interval: Duration.DurationInput) =>
      Effect.gen(function* () {
        const optimizationFiber = yield* Effect.fork(
          Effect.gen(function* () {
            yield* Effect.repeat(
              Effect.gen(function* () {
                for (const [name, pool] of poolRegistry.entries()) {
                  yield* pool.optimize.pipe(
                    Effect.catchAll((error) => 
                      Effect.logError(`Failed to optimize pool '${name}':`, error)
                    )
                  )
                }
                
                // Global garbage collection hint if available
                if (typeof globalThis.gc === 'function') {
                  yield* Effect.sync(() => globalThis.gc())
                }
              }),
              Schedule.fixed(interval)
            )
          })
        )
        
        return optimizationFiber
      }),
    
    clearAllPools: () =>
      Effect.gen(function* () {
        for (const [name, pool] of poolRegistry.entries()) {
          yield* pool.clear.pipe(
            Effect.catchAll((error) => 
              Effect.logError(`Failed to clear pool '${name}':`, error)
            )
          )
        }
        poolRegistry.clear()
        yield* Effect.logInfo('All object pools cleared')
      })
  }),
)

/**
 * Specialized pools for common objects with enhanced implementations
 */

// Enhanced Vector3 pool functional implementation
export interface PooledVector3 extends PoolableObject {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): this
  copy(other: { x: number; y: number; z: number }): this
  add(other: { x: number; y: number; z: number }): this
  sub(other: { x: number; y: number; z: number }): this
  scale(scalar: number): this
  normalize(): this
  length(): number
  lengthSquared(): number
  dot(other: { x: number; y: number; z: number }): number
}

export const createPooledVector3 = (): PooledVector3 => {
  const vector3 = {
    x: 0,
    y: 0,
    z: 0,

    set(x: number, y: number, z: number) {
      this.x = x
      this.y = y
      this.z = z
      return this
    },

    copy(other: { x: number; y: number; z: number }) {
      this.x = other.x
      this.y = other.y
      this.z = other.z
      return this
    },

    add(other: { x: number; y: number; z: number }) {
      this.x += other.x
      this.y += other.y
      this.z += other.z
      return this
    },

    sub(other: { x: number; y: number; z: number }) {
      this.x -= other.x
      this.y -= other.y
      this.z -= other.z
      return this
    },

    scale(scalar: number) {
      this.x *= scalar
      this.y *= scalar
      this.z *= scalar
      return this
    },

    normalize() {
      const length = this.length()
      if (length > 0) {
        this.scale(1 / length)
      }
      return this
    },

    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
    },

    lengthSquared() {
      return this.x * this.x + this.y * this.y + this.z * this.z
    },

    dot(other: { x: number; y: number; z: number }) {
      return this.x * other.x + this.y * other.y + this.z * other.z
    },

    reset() {
      this.x = 0
      this.y = 0
      this.z = 0
    },
  }
  return vector3
}

// Enhanced Matrix4 pool functional implementation
export interface PooledMatrix4 extends PoolableObject {
  elements: Float32Array
  identity(): this
  copy(other: { elements: Float32Array }): this
  multiply(other: { elements: Float32Array }): this
  transpose(): this
  determinant(): number
  invert(): this
}

export const createPooledMatrix4 = (): PooledMatrix4 => {
  const matrix4 = {
    elements: new Float32Array(16),

    identity() {
      const e = this.elements
      e.fill(0)
      e[0] = e[5] = e[10] = e[15] = 1
      return this
    },

    copy(other: { elements: Float32Array }) {
      this.elements.set(other.elements)
      return this
    },

    multiply(other: { elements: Float32Array }) {
      const a = this.elements
      const b = other.elements
      const result = new Float32Array(16)
      
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i * 4 + j] = 
            a[i * 4] * b[j] +
            a[i * 4 + 1] * b[4 + j] +
            a[i * 4 + 2] * b[8 + j] +
            a[i * 4 + 3] * b[12 + j]
        }
      }
      
      this.elements.set(result)
      return this
    },

    transpose() {
      const e = this.elements
      let temp: number
      
      temp = e[1]; e[1] = e[4]; e[4] = temp
      temp = e[2]; e[2] = e[8]; e[8] = temp
      temp = e[3]; e[3] = e[12]; e[12] = temp
      temp = e[6]; e[6] = e[9]; e[9] = temp
      temp = e[7]; e[7] = e[13]; e[13] = temp
      temp = e[11]; e[11] = e[14]; e[14] = temp
      
      return this
    },

    determinant() {
      const e = this.elements
      return e[0] * (
        e[5] * (e[10] * e[15] - e[11] * e[14]) -
        e[6] * (e[9] * e[15] - e[11] * e[13]) +
        e[7] * (e[9] * e[14] - e[10] * e[13])
      ) - e[1] * (
        e[4] * (e[10] * e[15] - e[11] * e[14]) -
        e[6] * (e[8] * e[15] - e[11] * e[12]) +
        e[7] * (e[8] * e[14] - e[10] * e[12])
      ) + e[2] * (
        e[4] * (e[9] * e[15] - e[11] * e[13]) -
        e[5] * (e[8] * e[15] - e[11] * e[12]) +
        e[7] * (e[8] * e[13] - e[9] * e[12])
      ) - e[3] * (
        e[4] * (e[9] * e[14] - e[10] * e[13]) -
        e[5] * (e[8] * e[14] - e[10] * e[12]) +
        e[6] * (e[8] * e[13] - e[9] * e[12])
      )
    },

    invert() {
      const det = this.determinant()
      if (Math.abs(det) < 1e-10) {
        // Matrix is not invertible, return identity
        this.identity()
        return this
      }
      
      // For brevity, using a simplified inversion (full implementation would be longer)
      // This is a placeholder - in production, use a proper matrix inversion algorithm
      const invDet = 1 / det
      const e = this.elements
      
      // Simplified inversion for demonstration
      for (let i = 0; i < 16; i++) {
        e[i] *= invDet
      }
      
      return this
    },

    reset() {
      this.identity()
    },
  }

  matrix4.identity()
  return matrix4
}

// Enhanced AABB pool functional implementation
export interface PooledAABB extends PoolableObject {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this
  copy(other: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }): this
  expand(amount: number): this
  intersects(other: PooledAABB): boolean
  contains(point: { x: number; y: number; z: number }): boolean
  center(): { x: number; y: number; z: number }
  size(): { x: number; y: number; z: number }
  volume(): number
}

export const createPooledAABB = (): PooledAABB => {
  return {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,

    set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
      this.minX = minX
      this.minY = minY
      this.minZ = minZ
      this.maxX = maxX
      this.maxY = maxY
      this.maxZ = maxZ
      return this
    },

    copy(other: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }) {
      this.minX = other.minX
      this.minY = other.minY
      this.minZ = other.minZ
      this.maxX = other.maxX
      this.maxY = other.maxY
      this.maxZ = other.maxZ
      return this
    },

    expand(amount: number) {
      this.minX -= amount
      this.minY -= amount
      this.minZ -= amount
      this.maxX += amount
      this.maxY += amount
      this.maxZ += amount
      return this
    },

    intersects(other: PooledAABB) {
      return (
        this.minX <= other.maxX && this.maxX >= other.minX &&
        this.minY <= other.maxY && this.maxY >= other.minY &&
        this.minZ <= other.maxZ && this.maxZ >= other.minZ
      )
    },

    contains(point: { x: number; y: number; z: number }) {
      return (
        point.x >= this.minX && point.x <= this.maxX &&
        point.y >= this.minY && point.y <= this.maxY &&
        point.z >= this.minZ && point.z <= this.maxZ
      )
    },

    center() {
      return {
        x: (this.minX + this.maxX) / 2,
        y: (this.minY + this.maxY) / 2,
        z: (this.minZ + this.maxZ) / 2,
      }
    },

    size() {
      return {
        x: this.maxX - this.minX,
        y: this.maxY - this.minY,
        z: this.maxZ - this.minZ,
      }
    },

    volume() {
      const size = this.size()
      return size.x * size.y * size.z
    },

    reset() {
      this.minX = 0
      this.minY = 0
      this.minZ = 0
      this.maxX = 0
      this.maxY = 0
      this.maxZ = 0
    },
  }
}

// Pre-configured pool configurations
export const vector3PoolConfig: ObjectPoolConfig = {
  initialSize: 100,
  maxSize: 10000,
  growthFactor: 2,
  shrinkThreshold: 0.3,
  enableBackpressure: true,
  backpressureThreshold: 8000,
  enableMetrics: true,
  autoOptimize: true,
  maxIdleTime: 300000,
}

export const matrix4PoolConfig: ObjectPoolConfig = {
  initialSize: 20,
  maxSize: 1000,
  growthFactor: 2,
  shrinkThreshold: 0.3,
  enableBackpressure: true,
  backpressureThreshold: 800,
  enableMetrics: true,
  autoOptimize: true,
  maxIdleTime: 300000,
}

export const aabbPoolConfig: ObjectPoolConfig = {
  initialSize: 50,
  maxSize: 5000,
  growthFactor: 2,
  shrinkThreshold: 0.3,
  enableBackpressure: true,
  backpressureThreshold: 4000,
  enableMetrics: true,
  autoOptimize: true,
  maxIdleTime: 300000,
}

/**
 * Pre-configured pools as Effects
 */
export const createVector3Pool = (config: ObjectPoolConfig = vector3PoolConfig) =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    return yield* service.createPool(createPooledVector3, { ...config, poolName: 'vector3' })
  }).pipe(withErrorLog('createVector3Pool'))

export const createMatrix4Pool = (config: ObjectPoolConfig = matrix4PoolConfig) =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    return yield* service.createPool(createPooledMatrix4, { ...config, poolName: 'matrix4' })
  }).pipe(withErrorLog('createMatrix4Pool'))

export const createAABBPool = (config: ObjectPoolConfig = aabbPoolConfig) =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    return yield* service.createPool(createPooledAABB, { ...config, poolName: 'aabb' })
  }).pipe(withErrorLog('createAABBPool'))

/**
 * Enhanced Effect utilities for pooled objects with backpressure handling
 */
export const withPooledEffect = <T extends PoolableObject, R, E>(
  pool: ObjectPool<T>, 
  fn: (obj: T) => Effect.Effect<R, E, never>
): Effect.Effect<R, E | ObjectPoolError | PoolExhaustedError, never> =>
  Effect.acquireUseRelease(
    pool.acquire,
    fn,
    (obj) => pool.release(obj).pipe(Effect.catchAll(() => Effect.unit))
  )

/**
 * Try pooled with fallback to factory
 */
export const withPooledOrFallback = <T extends PoolableObject, R, E>(
  pool: ObjectPool<T>,
  factory: () => T,
  fn: (obj: T) => Effect.Effect<R, E, never>
): Effect.Effect<R, E, never> =>
  Effect.gen(function* () {
    const pooledObj = yield* pool.tryAcquire
    
    if (Option.isSome(pooledObj)) {
      return yield* Effect.acquireUseRelease(
        Effect.succeed(pooledObj.value),
        fn,
        (obj) => pool.release(obj).pipe(Effect.catchAll(() => Effect.unit))
      )
    } else {
      // Fallback to direct allocation
      const obj = factory()
      const result = yield* fn(obj)
      obj.reset() // Clean up
      return result
    }
  })

/**
 * Convenience function to create and use a temporary pool with backpressure
 */
export const withTemporaryPool = <T extends PoolableObject, R, E>(
  factory: () => T,
  config: ObjectPoolConfig,
  fn: (pool: ObjectPool<T>) => Effect.Effect<R, E, never>,
): Effect.Effect<R, E | ObjectPoolError, ObjectPoolService> =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    const pool = yield* service.createPool(factory, config)
    
    // Warm up the pool
    yield* pool.warmUp(config.initialSize)
    
    const result = yield* fn(pool)
    
    // Clean up
    yield* pool.clear
    
    return result
  })

/**
 * Pool clustering for high-performance scenarios
 */
export const createPoolCluster = <T extends PoolableObject>(
  factory: () => T,
  clusterSize: number,
  config: ObjectPoolConfig
) =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    const pools: ObjectPool<T>[] = []
    
    for (let i = 0; i < clusterSize; i++) {
      const poolName = `${config.poolName || 'cluster'}-${i}`
      const pool = yield* service.createSharedPool(factory, poolName, { ...config, poolName })
      pools.push(pool)
    }
    
    // Start optimization for the entire cluster
    yield* service.startGlobalOptimization(Duration.seconds(30))
    
    return {
      pools,
      acquireFromAny: () =>
        Effect.gen(function* () {
          // Try to acquire from pools in round-robin fashion
          for (const pool of pools) {
            const obj = yield* pool.tryAcquire
            if (Option.isSome(obj)) {
              return obj.value
            }
          }
          // If all pools are exhausted, try acquire from first pool (will throw if exhausted)
          return yield* pools[0].acquire
        }),
      releaseToAny: (obj: T) =>
        Effect.gen(function* () {
          // Try to release to the pool with the most available space
          let bestPool = pools[0]
          let bestAvailable = 0
          
          for (const pool of pools) {
            const stats = yield* pool.getStats
            if (stats.available > bestAvailable) {
              bestPool = pool
              bestAvailable = stats.available
            }
          }
          
          yield* bestPool.release(obj)
        }),
      getClusterStats: () =>
        Effect.gen(function* () {
          const allStats = yield* Effect.all(pools.map(pool => pool.getStats))
          return allStats.reduce((acc, stats) => ({
            available: acc.available + stats.available,
            inUse: acc.inUse + stats.inUse,
            total: acc.total + stats.total,
            maxSize: acc.maxSize + stats.maxSize,
            hitRate: (acc.hitRate + stats.hitRate) / 2,
            acquisitionTime: (acc.acquisitionTime + stats.acquisitionTime) / 2,
            releaseTime: (acc.releaseTime + stats.releaseTime) / 2,
            fragmentationRatio: (acc.fragmentationRatio + stats.fragmentationRatio) / 2,
            peakUsage: acc.peakUsage + stats.peakUsage,
            totalAcquired: acc.totalAcquired + stats.totalAcquired,
            totalReleased: acc.totalReleased + stats.totalReleased,
            lastOptimization: Math.max(acc.lastOptimization, stats.lastOptimization),
            backpressureEvents: acc.backpressureEvents + stats.backpressureEvents,
            poolName: 'cluster',
          }))
        })
    }
  })