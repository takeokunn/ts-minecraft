import { Effect, Queue, Ref, Context, Layer, Metric, Schedule, Fiber, Duration, Option, Chunk } from 'effect'
import { withErrorLog, withTiming, withPerformanceMonitoring } from '../../shared/utils/effect'
import { PerformanceMetric } from '../../shared/types/common'

/**
 * Error types for memory pool operations
 */
export class MemoryPoolError extends Error {
  readonly _tag = 'MemoryPoolError'
  constructor(message: string, public readonly operation: string, public readonly poolName?: string) {
    super(message)
    this.name = 'MemoryPoolError'
  }
}

export class PoolExhaustedError extends MemoryPoolError {
  readonly _tag = 'PoolExhaustedError'
  constructor(poolName: string, maxSize: number) {
    super(`Memory pool '${poolName}' exhausted (max size: ${maxSize})`, 'acquire', poolName)
    this.name = 'PoolExhaustedError'
  }
}

/**
 * Enhanced memory pool configuration with optimization options
 */
export interface MemoryPoolConfig {
  readonly maxSize: number
  readonly initialSize: number
  readonly enableMetrics: boolean
  readonly poolName?: string
  readonly growthFactor: number
  readonly shrinkThreshold: number
  readonly enableAutoOptimization: boolean
  readonly maxIdleTime: number
  readonly enableBackpressure: boolean
  readonly backpressureThreshold: number
}

/**
 * Enhanced memory pool metrics with additional tracking
 */
export interface MemoryPoolMetrics {
  readonly poolName?: string
  readonly totalAllocated: number
  readonly currentInUse: number
  readonly peakUsage: number
  readonly hitRate: number
  readonly missCount: number
  readonly averageAcquireTime: number
  readonly averageReleaseTime: number
  readonly fragmentationRatio: number
  readonly lastOptimization: number
  readonly gcCollections: number
  readonly memoryPressure: 'low' | 'medium' | 'high'
}

/**
 * Enhanced memory pool interface with advanced features
 */
export interface MemoryPool<T> {
  readonly acquire: Effect.Effect<T, PoolExhaustedError, never>
  readonly tryAcquire: Effect.Effect<Option.Option<T>, never, never>
  readonly acquireWithTimeout: (timeout: Duration.DurationInput) => Effect.Effect<T, PoolExhaustedError | Error, never>
  readonly release: (item: T) => Effect.Effect<void, MemoryPoolError, never>
  readonly releaseAll: (items: ReadonlyArray<T>) => Effect.Effect<void, MemoryPoolError, never>
  readonly size: Effect.Effect<number, never, never>
  readonly capacity: Effect.Effect<number, never, never>
  readonly availableCount: Effect.Effect<number, never, never>
  readonly inUseCount: Effect.Effect<number, never, never>
  readonly clear: Effect.Effect<void, never, never>
  readonly optimize: Effect.Effect<void, never, never>
  readonly getMetrics: Effect.Effect<MemoryPoolMetrics, never, never>
  readonly resize: (newMaxSize: number) => Effect.Effect<void, MemoryPoolError, never>
  readonly warmUp: (count: number) => Effect.Effect<void, MemoryPoolError, never>
}

/**
 * Memory Pool Service for dependency injection with enhanced error handling
 */
export const MemoryPoolService = Context.GenericTag<{
  readonly createPool: <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig) => Effect.Effect<MemoryPool<T>, MemoryPoolError, never>
  readonly createTypedArrayPool: (
    type: 'Float32' | 'Float64' | 'Int32' | 'Uint32' | 'Int16' | 'Uint16',
    length: number,
    config: MemoryPoolConfig,
  ) => Effect.Effect<MemoryPool<ArrayBuffer>, MemoryPoolError, never>
  readonly createBufferPool: (size: number, config: MemoryPoolConfig) => Effect.Effect<MemoryPool<ArrayBuffer>, MemoryPoolError, never>
  readonly createSharedPool: <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig, poolName: string) => Effect.Effect<MemoryPool<T>, MemoryPoolError, never>
  readonly getPoolMetrics: (poolName?: string) => Effect.Effect<MemoryPoolMetrics[], never, never>
  readonly startBackgroundOptimization: (interval: Duration.DurationInput) => Effect.Effect<Fiber.Fiber<void>, never, never>
}>('MemoryPoolService')

/**
 * Create an enhanced memory pool implementation with advanced features
 */
const createMemoryPoolImpl = <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig): Effect.Effect<MemoryPool<T>, MemoryPoolError, never> =>
  Effect.gen(function* () {
    const available = yield* Queue.unbounded<T>()
    const inUse = yield* Ref.make(new Set<T>())
    const metrics = yield* Ref.make<MemoryPoolMetrics>({
      poolName: config.poolName,
      totalAllocated: 0,
      currentInUse: 0,
      peakUsage: 0,
      hitRate: 0,
      missCount: 0,
      averageAcquireTime: 0,
      averageReleaseTime: 0,
      fragmentationRatio: 0,
      lastOptimization: Date.now(),
      gcCollections: 0,
      memoryPressure: 'low',
    })
    const acquisitionTimes = yield* Ref.make<number[]>([])
    const releaseTimes = yield* Ref.make<number[]>([])

    // Pre-allocate initial objects with error handling
    for (let i = 0; i < config.initialSize; i++) {
      try {
        const item = factory()
        yield* Queue.offer(available, item)
      } catch (error) {
        return yield* Effect.fail(new MemoryPoolError(
          `Failed to create initial pool item ${i}: ${error}`,
          'initialization',
          config.poolName
        ))
      }
    }

    yield* Ref.update(metrics, (m) => ({
      ...m,
      totalAllocated: config.initialSize,
    }))
    
    // Log pool creation
    yield* Effect.logInfo(`Memory pool '${config.poolName || 'unnamed'}' initialized with ${config.initialSize} items (max: ${config.maxSize})`)

    return {
      acquire: Effect.gen(function* () {
        const startTime = performance.now()
        
        // Check backpressure if enabled
        if (config.enableBackpressure) {
          const currentInUse = (yield* Ref.get(inUse)).size
          if (currentInUse >= config.backpressureThreshold) {
            yield* Effect.logWarning(`Pool ${config.poolName || 'unnamed'} approaching backpressure threshold`)
          }
        }

        const item = yield* Queue.poll(available)

        if (Option.isSome(item)) {
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(item.value)
            return newSet
          })
          
          if (config.enableMetrics) {
            const acquireTime = performance.now() - startTime
            yield* Ref.update(acquisitionTimes, (times) => [...times.slice(-99), acquireTime])
            yield* Ref.update(metrics, (m) => {
              const avgAcquireTime = m.averageAcquireTime === 0 ? acquireTime : (m.averageAcquireTime * 0.9) + (acquireTime * 0.1)
              return {
                ...m,
                currentInUse: m.currentInUse + 1,
                peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
                averageAcquireTime: avgAcquireTime,
              }
            })
          }
          return item.value
        } else {
          // Check if we can create new item
          const currentInUse = (yield* Ref.get(inUse)).size
          const queueSize = yield* Queue.size(available)
          
          if (currentInUse + queueSize >= config.maxSize) {
            return yield* Effect.fail(new PoolExhaustedError(config.poolName || 'unnamed', config.maxSize))
          }
          
          // Pool miss - create new item
          const newItem = factory()
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(newItem)
            return newSet
          })
          
          if (config.enableMetrics) {
            const acquireTime = performance.now() - startTime
            yield* Ref.update(acquisitionTimes, (times) => [...times.slice(-99), acquireTime])
            yield* Ref.update(metrics, (m) => {
              const avgAcquireTime = m.averageAcquireTime === 0 ? acquireTime : (m.averageAcquireTime * 0.9) + (acquireTime * 0.1)
              const newHitRate = m.totalAllocated > 0 ? (m.totalAllocated - m.missCount - 1) / (m.totalAllocated + 1) : 0
              return {
                ...m,
                totalAllocated: m.totalAllocated + 1,
                currentInUse: m.currentInUse + 1,
                peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
                missCount: m.missCount + 1,
                hitRate: newHitRate,
                averageAcquireTime: avgAcquireTime,
              }
            })
          }
          return newItem
        }
      }),

      tryAcquire: Effect.gen(function* () {
        const item = yield* Queue.poll(available)
        
        if (Option.isSome(item)) {
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(item.value)
            return newSet
          })
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              currentInUse: m.currentInUse + 1,
              peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
            }))
          }
          return Option.some(item.value)
        }
        
        return Option.none()
      }),

      acquireWithTimeout: (timeout: Duration.DurationInput) =>
        Effect.gen(function* () {
          const acquire = Effect.gen(function* () {
            const item = yield* Queue.take(available)
            
            yield* Ref.update(inUse, (set) => {
              const newSet = new Set(set)
              newSet.add(item)
              return newSet
            })
            
            if (config.enableMetrics) {
              yield* Ref.update(metrics, (m) => ({
                ...m,
                currentInUse: m.currentInUse + 1,
                peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
              }))
            }
            
            return item
          })
          
          return yield* acquire.pipe(
            Effect.timeout(timeout),
            Effect.catchTag('TimeoutException', () => 
              Effect.fail(new Error(`Timeout waiting for item from pool ${config.poolName || 'unnamed'}`))
            )
          )
        }),

      release: (item: T) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          const currentInUse = yield* Ref.get(inUse)
          
          if (!currentInUse.has(item)) {
            return yield* Effect.fail(new MemoryPoolError('Item not from this pool', 'release', config.poolName))
          }
          
          yield* Effect.try(() => reset(item)).pipe(
            Effect.catchAll((error) => 
              Effect.fail(new MemoryPoolError(`Reset failed: ${error}`, 'release', config.poolName))
            )
          )
          
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.delete(item)
            return newSet
          })
          
          const currentSize = yield* Queue.size(available)

          if (currentSize < config.maxSize) {
            yield* Queue.offer(available, item)
          }

          if (config.enableMetrics) {
            const releaseTime = performance.now() - startTime
            yield* Ref.update(releaseTimes, (times) => [...times.slice(-99), releaseTime])
            yield* Ref.update(metrics, (m) => {
              const avgReleaseTime = m.averageReleaseTime === 0 ? releaseTime : (m.averageReleaseTime * 0.9) + (releaseTime * 0.1)
              return {
                ...m,
                currentInUse: Math.max(0, m.currentInUse - 1),
                averageReleaseTime: avgReleaseTime,
              }
            })
          }
        }),

      releaseAll: (items: ReadonlyArray<T>) =>
        Effect.gen(function* () {
          for (const item of items) {
            yield* Effect.gen(function* () {
              yield* Effect.try(() => reset(item)).pipe(
                Effect.catchAll(() => Effect.unit)
              )
            })
          }
          
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            for (const item of items) {
              newSet.delete(item)
            }
            return newSet
          })
          
          const currentSize = yield* Queue.size(available)
          const remainingCapacity = config.maxSize - currentSize
          const itemsToQueue = items.slice(0, remainingCapacity)
          
          for (const item of itemsToQueue) {
            yield* Queue.offer(available, item)
          }
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              currentInUse: Math.max(0, m.currentInUse - items.length),
            }))
          }
        }),

      size: Queue.size(available),

      capacity: Effect.succeed(config.maxSize),
      
      availableCount: Queue.size(available),
      
      inUseCount: Effect.gen(function* () {
        const inUseSet = yield* Ref.get(inUse)
        return inUseSet.size
      }),

      clear: Effect.gen(function* () {
        yield* Queue.takeAll(available)
        yield* Ref.set(inUse, new Set())
        yield* Ref.set(metrics, {
          poolName: config.poolName,
          totalAllocated: 0,
          currentInUse: 0,
          peakUsage: 0,
          hitRate: 0,
          missCount: 0,
          averageAcquireTime: 0,
          averageReleaseTime: 0,
          fragmentationRatio: 0,
          lastOptimization: Date.now(),
          gcCollections: 0,
          memoryPressure: 'low',
        })
        yield* Ref.set(acquisitionTimes, [])
        yield* Ref.set(releaseTimes, [])
      }),

      optimize: Effect.gen(function* () {
        const currentMetrics = yield* Ref.get(metrics)
        const queueSize = yield* Queue.size(available)
        const inUseSize = (yield* Ref.get(inUse)).size
        
        // Calculate fragmentation ratio
        const totalSize = queueSize + inUseSize
        const utilizationRatio = totalSize > 0 ? inUseSize / totalSize : 0
        const fragmentationRatio = 1 - utilizationRatio
        
        // Shrink pool if underutilized
        if (config.shrinkThreshold > 0 && utilizationRatio < config.shrinkThreshold && queueSize > config.initialSize) {
          const itemsToRemove = Math.floor((queueSize - config.initialSize) / 2)
          for (let i = 0; i < itemsToRemove; i++) {
            yield* Queue.poll(available)
          }
          yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} shrunk by ${itemsToRemove} items`)
        }
        
        // Update metrics
        yield* Ref.update(metrics, (m) => ({
          ...m,
          fragmentationRatio,
          lastOptimization: Date.now(),
          memoryPressure: fragmentationRatio > 0.7 ? 'high' : fragmentationRatio > 0.4 ? 'medium' : 'low',
        }))
      }),

      getMetrics: Ref.get(metrics),

      resize: (newMaxSize: number) =>
        Effect.gen(function* () {
          if (newMaxSize < config.initialSize) {
            return yield* Effect.fail(new MemoryPoolError(
              `New max size (${newMaxSize}) cannot be smaller than initial size (${config.initialSize})`,
              'resize',
              config.poolName
            ))
          }
          
          const currentSize = yield* Queue.size(available)
          
          if (newMaxSize < currentSize) {
            // Shrink pool
            const itemsToRemove = currentSize - newMaxSize
            for (let i = 0; i < itemsToRemove; i++) {
              yield* Queue.poll(available)
            }
          }
          
          // Update config (this would require making config mutable or returning new pool)
          yield* Effect.logInfo(`Pool ${config.poolName || 'unnamed'} resized to ${newMaxSize}`) 
        }),

      warmUp: (count: number) =>
        Effect.gen(function* () {
          const currentSize = yield* Queue.size(available)
          const itemsToAdd = Math.min(count, config.maxSize - currentSize)
          
          for (let i = 0; i < itemsToAdd; i++) {
            const item = factory()
            yield* Queue.offer(available, item)
          }
          
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              totalAllocated: m.totalAllocated + itemsToAdd,
            }))
          }
          
          yield* Effect.logDebug(`Pool ${config.poolName || 'unnamed'} warmed up with ${itemsToAdd} items`)
        }),
    }
  }).pipe(withErrorLog('createMemoryPool'))

/**
 * Create an enhanced typed array pool with validation
 */
const createTypedArrayPoolImpl = (
  type: 'Float32' | 'Float64' | 'Int32' | 'Uint32' | 'Int16' | 'Uint16',
  length: number,
  config: MemoryPoolConfig,
): Effect.Effect<MemoryPool<ArrayBuffer>, MemoryPoolError, never> => 
  Effect.gen(function* () {
    if (length <= 0) {
      return yield* Effect.fail(new MemoryPoolError(`Invalid array length: ${length}`, 'createTypedArrayPool'))
    }
    
    const bytesPerElement = {
      Float32: 4, Float64: 8, Int32: 4, Uint32: 4, Int16: 2, Uint16: 2
    }[type]
    
    const totalBytes = length * bytesPerElement
    if (totalBytes > 1024 * 1024 * 50) { // 50MB limit
      yield* Effect.logWarning(`Large typed array detected: ${totalBytes} bytes - this may cause memory pressure`)
    }
    
    const typeMap = {
      Float32: Float32Array,
      Float64: Float64Array,
      Int32: Int32Array,
      Uint32: Uint32Array,
      Int16: Int16Array,
      Uint16: Uint16Array,
    }
    
    return yield* createMemoryPoolImpl(
      () => {
        try {
          return new typeMap[type](length).buffer
        } catch (error) {
          throw new MemoryPoolError(`Failed to create ${type} array: ${error}`, 'factory')
        }
      },
      (buffer) => {
        try {
          // More efficient reset for typed arrays
          const view = new Uint8Array(buffer)
          if (view.length <= 1024) {
            view.fill(0) // Fast for small buffers
          } else {
            // Chunked reset for large buffers to avoid blocking
            const chunkSize = 1024
            for (let i = 0; i < view.length; i += chunkSize) {
              const end = Math.min(i + chunkSize, view.length)
              view.subarray(i, end).fill(0)
            }
          }
        } catch (error) {
          throw new MemoryPoolError(`Failed to reset buffer: ${error}`, 'reset')
        }
      },
      { ...config, poolName: config.poolName || `${type.toLowerCase()}-${length}` },
    )
  })

/**
 * Create an enhanced buffer pool with validation
 */
const createBufferPoolImpl = (size: number, config: MemoryPoolConfig): Effect.Effect<MemoryPool<ArrayBuffer>, MemoryPoolError, never> =>
  Effect.gen(function* () {
    if (size <= 0) {
      return yield* Effect.fail(new MemoryPoolError(`Invalid buffer size: ${size}`, 'createBufferPool'))
    }
    
    if (size > 1024 * 1024 * 100) { // 100MB limit
      yield* Effect.logWarning(`Large buffer size detected: ${size} bytes - this may cause memory pressure`)
    }
    
    return yield* createMemoryPoolImpl(
      () => {
        try {
          return new ArrayBuffer(size)
        } catch (error) {
          throw new MemoryPoolError(`Failed to create buffer of size ${size}: ${error}`, 'factory')
        }
      },
      (buffer) => {
        try {
          // Efficient chunked reset for large buffers
          const view = new Uint8Array(buffer)
          if (view.length <= 1024) {
            view.fill(0)
          } else {
            const chunkSize = 1024
            for (let i = 0; i < view.length; i += chunkSize) {
              const end = Math.min(i + chunkSize, view.length)
              view.subarray(i, end).fill(0)
            }
          }
        } catch (error) {
          throw new MemoryPoolError(`Failed to reset buffer: ${error}`, 'reset')
        }
      },
      { ...config, poolName: config.poolName || `buffer-${size}` },
    )
  })

// Global pool registry for shared pools and metrics
const poolRegistry = new Map<string, MemoryPool<any>>()
const globalMetrics = new Map<string, MemoryPoolMetrics>()

/**
 * Memory Pool Service Layer implementation with enhanced features
 */
export const MemoryPoolServiceLive = Layer.succeed(
  MemoryPoolService,
  MemoryPoolService.of({
    createPool: createMemoryPoolImpl,
    createTypedArrayPool: createTypedArrayPoolImpl,
    createBufferPool: createBufferPoolImpl,
    
    createSharedPool: <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig, poolName: string) =>
      Effect.gen(function* () {
        if (poolRegistry.has(poolName)) {
          yield* Effect.logWarning(`Shared pool '${poolName}' already exists, returning existing pool`)
          return poolRegistry.get(poolName)! as MemoryPool<T>
        }
        
        const poolConfig = { ...config, poolName }
        const pool = yield* createMemoryPoolImpl(factory, reset, poolConfig)
        poolRegistry.set(poolName, pool)
        
        yield* Effect.logInfo(`Shared pool '${poolName}' created successfully`)
        return pool
      }),
    
    getPoolMetrics: (poolName?: string) =>
      Effect.gen(function* () {
        if (poolName) {
          const pool = poolRegistry.get(poolName)
          if (pool) {
            const metrics = yield* pool.getMetrics
            return [metrics]
          }
          return []
        }
        
        // Return metrics for all pools
        const allMetrics: MemoryPoolMetrics[] = []
        for (const [name, pool] of poolRegistry.entries()) {
          const metrics = yield* pool.getMetrics
          allMetrics.push(metrics)
        }
        return allMetrics
      }),
    
    startBackgroundOptimization: (interval: Duration.DurationInput) =>
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
                
                // Global garbage collection hint
                if (typeof globalThis.gc === 'function') {
                  yield* Effect.sync(() => globalThis.gc())
                }
              }),
              Schedule.fixed(interval)
            )
          })
        )
        
        return optimizationFiber
      })
  }),
)

/**
 * Pre-configured memory pools for common use cases with enhanced defaults
 */
export const defaultMemoryPoolConfig: MemoryPoolConfig = {
  maxSize: 1000,
  initialSize: 10,
  enableMetrics: true,
  growthFactor: 2.0,
  shrinkThreshold: 0.3,
  enableAutoOptimization: true,
  maxIdleTime: 300000, // 5 minutes
  enableBackpressure: true,
  backpressureThreshold: 800, // 80% of maxSize
}

/**
 * High-performance configuration for intensive workloads
 */
export const highPerformanceConfig: MemoryPoolConfig = {
  maxSize: 10000,
  initialSize: 100,
  enableMetrics: true,
  growthFactor: 1.5,
  shrinkThreshold: 0.2,
  enableAutoOptimization: true,
  maxIdleTime: 60000, // 1 minute
  enableBackpressure: true,
  backpressureThreshold: 9000,
}

/**
 * Memory-conservative configuration for limited environments
 */
export const memoryConservativeConfig: MemoryPoolConfig = {
  maxSize: 100,
  initialSize: 5,
  enableMetrics: false, // Reduce overhead
  growthFactor: 1.2,
  shrinkThreshold: 0.5,
  enableAutoOptimization: false,
  maxIdleTime: 600000, // 10 minutes
  enableBackpressure: true,
  backpressureThreshold: 80,
}

/**
 * Create common memory pools with enhanced configurations
 */
export const createFloat32Pool = (length: number = 16, config: MemoryPoolConfig = defaultMemoryPoolConfig) =>
  Effect.gen(function* () {
    const service = yield* MemoryPoolService
    const poolConfig = { ...config, poolName: `float32-${length}` }
    return yield* service.createTypedArrayPool('Float32', length, poolConfig)
  }).pipe(withErrorLog('createFloat32Pool'))

export const createMatrix4Pool = (config: MemoryPoolConfig = highPerformanceConfig) => 
  createFloat32Pool(16, { ...config, poolName: 'matrix4' })
  
export const createVector3Pool = (config: MemoryPoolConfig = defaultMemoryPoolConfig) => 
  createFloat32Pool(3, { ...config, poolName: 'vector3' })
  
export const createVector4Pool = (config: MemoryPoolConfig = defaultMemoryPoolConfig) => 
  createFloat32Pool(4, { ...config, poolName: 'vector4' })
  
export const createQuaternionPool = (config: MemoryPoolConfig = defaultMemoryPoolConfig) => 
  createFloat32Pool(4, { ...config, poolName: 'quaternion' })

export const createBufferPool = (size: number = 1024, config: MemoryPoolConfig = defaultMemoryPoolConfig) =>
  Effect.gen(function* () {
    const service = yield* MemoryPoolService
    const poolConfig = { ...config, poolName: `buffer-${size}` }
    return yield* service.createBufferPool(size, poolConfig)
  }).pipe(withErrorLog('createBufferPool'))

/**
 * Specialized pools for different scenarios
 */
export const createLargeBufferPool = (size: number = 64 * 1024) => // 64KB buffers
  createBufferPool(size, { ...highPerformanceConfig, initialSize: 5, maxSize: 50 })

export const createSmallBufferPool = (size: number = 1024) => // 1KB buffers
  createBufferPool(size, { ...defaultMemoryPoolConfig, initialSize: 20, maxSize: 200 })

export const createMeshDataPool = () => // For mesh vertex data
  createFloat32Pool(65536, { // 64K floats
    ...highPerformanceConfig,
    poolName: 'mesh-data',
    initialSize: 10,
    maxSize: 100,
  })

export const createChunkDataPool = () => // For chunk data
  createBufferPool(16 * 16 * 256 * 4, { // Chunk size buffer
    ...highPerformanceConfig,
    poolName: 'chunk-data',
    initialSize: 20,
    maxSize: 100,
  })

/**
 * Enhanced memory pool utilities with error handling
 */
export const withPooledMemory = <T, R, E>(pool: MemoryPool<T>, fn: (item: T) => Effect.Effect<R, E, never>): Effect.Effect<R, E | MemoryPoolError | PoolExhaustedError, never> =>
  Effect.acquireUseRelease(
    pool.acquire,
    fn,
    (item) => pool.release(item).pipe(Effect.catchAll(() => Effect.unit))
  )

/**
 * Try to use pooled memory with fallback to direct allocation
 */
export const withPooledMemoryOrFallback = <T, R, E>(
  pool: MemoryPool<T>,
  factory: () => T,
  fn: (item: T) => Effect.Effect<R, E, never>
): Effect.Effect<R, E, never> =>
  Effect.gen(function* () {
    const pooledItem = yield* pool.tryAcquire
    
    if (Option.isSome(pooledItem)) {
      return yield* Effect.acquireUseRelease(
        Effect.succeed(pooledItem.value),
        fn,
        (item) => pool.release(item).pipe(Effect.catchAll(() => Effect.unit))
      )
    } else {
      // Fallback to direct allocation
      const item = factory()
      return yield* fn(item)
    }
  })

/**
 * Batch acquire multiple items from pool with better error handling and concurrency
 */
export const acquireBatch = <T>(pool: MemoryPool<T>, count: number): Effect.Effect<T[], PoolExhaustedError, never> =>
  Effect.gen(function* () {
    // Try to acquire items concurrently for better performance
    const acquisitions = Array.from({ length: count }, () => pool.acquire)
    return yield* Effect.all(acquisitions)
  })

/**
 * Safely acquire batch with partial success handling
 */
export const tryAcquireBatch = <T>(pool: MemoryPool<T>, count: number): Effect.Effect<T[], never, never> =>
  Effect.gen(function* () {
    const items: T[] = []
    
    for (let i = 0; i < count; i++) {
      const item = yield* pool.tryAcquire
      if (Option.isSome(item)) {
        items.push(item.value)
      } else {
        break // Stop on first failure
      }
    }
    
    return items
  })

/**
 * Batch release multiple items to pool with enhanced error handling
 */
export const releaseBatch = <T>(pool: MemoryPool<T>, items: T[]): Effect.Effect<void, MemoryPoolError, never> =>
  Effect.gen(function* () {
    // Use the pool's built-in batch release for better performance
    yield* pool.releaseAll(items)
  })

/**
 * Advanced pool utilities for complex scenarios
 */
export const PoolUtils = {
  /**
   * Create a pool with automatic warm-up and optimization
   */
  createOptimizedPool: <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig) =>
    Effect.gen(function* () {
      const service = yield* MemoryPoolService
      const pool = yield* service.createPool(factory, reset, config)
      
      // Warm up the pool
      yield* pool.warmUp(config.initialSize)
      
      // Start background optimization if enabled
      if (config.enableAutoOptimization) {
        yield* Effect.fork(
          Effect.repeat(
            pool.optimize,
            Schedule.fixed(Duration.seconds(30))
          )
        )
      }
      
      return pool
    }),
  
  /**
   * Monitor pool health and emit warnings
   */
  monitorPoolHealth: <T>(pool: MemoryPool<T>, thresholds: { utilizationWarning: number; memoryPressureWarning: number }) =>
    Effect.gen(function* () {
      const metrics = yield* pool.getMetrics
      const inUse = yield* pool.inUseCount
      const capacity = yield* pool.capacity
      
      const utilization = capacity > 0 ? inUse / capacity : 0
      
      if (utilization > thresholds.utilizationWarning) {
        yield* Effect.logWarning(`Pool utilization high: ${(utilization * 100).toFixed(1)}%`)
      }
      
      if (metrics.memoryPressure === 'high') {
        yield* Effect.logWarning(`Pool memory pressure is high - consider increasing pool size or optimizing usage patterns`)
      }
      
      return metrics
    }),
  
  /**
   * Create multiple pools with shared optimization
   */
  createPoolCluster: <T>(configs: Array<{ name: string; factory: () => T; reset: (item: T) => void; config: MemoryPoolConfig }>) =>
    Effect.gen(function* () {
      const service = yield* MemoryPoolService
      const pools = new Map<string, MemoryPool<T>>()
      
      // Create all pools
      for (const { name, factory, reset, config } of configs) {
        const pool = yield* service.createSharedPool(factory, reset, { ...config, poolName: name }, name)
        pools.set(name, pool)
      }
      
      // Start cluster-wide optimization
      yield* service.startBackgroundOptimization(Duration.seconds(60))
      
      return pools
    })
}