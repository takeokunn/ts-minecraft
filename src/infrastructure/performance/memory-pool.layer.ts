import { Effect, Queue, Ref, Context, Layer } from 'effect'

/**
 * Generic memory pool interface for managing reusable memory structures
 */
export interface MemoryPool<T> {
  readonly acquire: Effect.Effect<T, never, never>
  readonly release: (item: T) => Effect.Effect<void, never, never>
  readonly size: Effect.Effect<number, never, never>
  readonly clear: Effect.Effect<void, never, never>
}

/**
 * Memory pool configuration
 */
export interface MemoryPoolConfig {
  readonly maxSize: number
  readonly initialSize: number
  readonly enableMetrics: boolean
}

/**
 * Memory pool metrics
 */
export interface MemoryPoolMetrics {
  readonly totalAllocated: number
  readonly currentInUse: number
  readonly peakUsage: number
  readonly hitRate: number
  readonly missCount: number
}

/**
 * Memory Pool Service for dependency injection
 */
export const MemoryPoolService = Context.GenericTag<{
  readonly createPool: <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig) => Effect.Effect<MemoryPool<T>, never, never>
  readonly createTypedArrayPool: (
    type: 'Float32' | 'Float64' | 'Int32' | 'Uint32' | 'Int16' | 'Uint16',
    length: number,
    config: MemoryPoolConfig,
  ) => Effect.Effect<MemoryPool<ArrayBuffer>, never, never>
  readonly createBufferPool: (size: number, config: MemoryPoolConfig) => Effect.Effect<MemoryPool<ArrayBuffer>, never, never>
}>('MemoryPoolService')

/**
 * Create a memory pool implementation
 */
const createMemoryPoolImpl = <T>(factory: () => T, reset: (item: T) => void, config: MemoryPoolConfig): Effect.Effect<MemoryPool<T>, never, never> =>
  Effect.gen(function* () {
    const available = yield* Queue.unbounded<T>()
    const metrics = yield* Ref.make<MemoryPoolMetrics>({
      totalAllocated: 0,
      currentInUse: 0,
      peakUsage: 0,
      hitRate: 0,
      missCount: 0,
    })

    // Pre-allocate initial objects
    for (let i = 0; i < config.initialSize; i++) {
      const item = factory()
      yield* Queue.offer(available, item)
    }

    yield* Ref.update(metrics, (m) => ({ ...m, totalAllocated: config.initialSize }))

    return {
      acquire: Effect.gen(function* () {
        const item = yield* Queue.poll(available)

        if (item._tag === 'Some') {
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              currentInUse: m.currentInUse + 1,
              peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
            }))
          }
          return item.value
        } else {
          // Pool miss - create new item
          const newItem = factory()
          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              totalAllocated: m.totalAllocated + 1,
              currentInUse: m.currentInUse + 1,
              peakUsage: Math.max(m.peakUsage, m.currentInUse + 1),
              missCount: m.missCount + 1,
              hitRate: m.totalAllocated > 0 ? (m.totalAllocated - m.missCount - 1) / m.totalAllocated : 0,
            }))
          }
          return newItem
        }
      }),

      release: (item: T) =>
        Effect.gen(function* () {
          reset(item)
          const currentSize = yield* Queue.size(available)

          if (currentSize < config.maxSize) {
            yield* Queue.offer(available, item)
          }

          if (config.enableMetrics) {
            yield* Ref.update(metrics, (m) => ({
              ...m,
              currentInUse: Math.max(0, m.currentInUse - 1),
            }))
          }
        }),

      size: Queue.size(available),

      clear: Effect.gen(function* () {
        yield* Queue.takeAll(available)
        yield* Ref.set(metrics, {
          totalAllocated: 0,
          currentInUse: 0,
          peakUsage: 0,
          hitRate: 0,
          missCount: 0,
        })
      }),
    }
  })

/**
 * Create a typed array pool
 */
const createTypedArrayPoolImpl = (
  type: 'Float32' | 'Float64' | 'Int32' | 'Uint32' | 'Int16' | 'Uint16',
  length: number,
  config: MemoryPoolConfig,
): Effect.Effect<MemoryPool<ArrayBuffer>, never, never> => {
  const typeMap = {
    Float32: Float32Array,
    Float64: Float64Array,
    Int32: Int32Array,
    Uint32: Uint32Array,
    Int16: Int16Array,
    Uint16: Uint16Array,
  }

  const TypedArrayConstructor = typeMap[type]

  return createMemoryPoolImpl(
    () => new TypedArrayConstructor(length).buffer,
    (buffer) => {
      // Reset buffer to zeros
      new Uint8Array(buffer).fill(0)
    },
    config,
  )
}

/**
 * Create a buffer pool
 */
const createBufferPoolImpl = (size: number, config: MemoryPoolConfig): Effect.Effect<MemoryPool<ArrayBuffer>, never, never> =>
  createMemoryPoolImpl(
    () => new ArrayBuffer(size),
    (buffer) => {
      // Reset buffer to zeros
      new Uint8Array(buffer).fill(0)
    },
    config,
  )

/**
 * Memory Pool Service Layer implementation
 */
export const MemoryPoolServiceLive = Layer.succeed(
  MemoryPoolService,
  MemoryPoolService.of({
    createPool: createMemoryPoolImpl,
    createTypedArrayPool: createTypedArrayPoolImpl,
    createBufferPool: createBufferPoolImpl,
  }),
)

/**
 * Pre-configured memory pools for common use cases
 */
export const defaultMemoryPoolConfig: MemoryPoolConfig = {
  maxSize: 1000,
  initialSize: 10,
  enableMetrics: true,
}

/**
 * Create common memory pools
 */
export const createFloat32Pool = (length: number = 16) =>
  Effect.gen(function* () {
    const service = yield* MemoryPoolService
    return yield* service.createTypedArrayPool('Float32', length, defaultMemoryPoolConfig)
  })

export const createMatrix4Pool = () => createFloat32Pool(16)
export const createVector3Pool = () => createFloat32Pool(3)
export const createVector4Pool = () => createFloat32Pool(4)
export const createQuaternionPool = () => createFloat32Pool(4)

export const createBufferPool = (size: number = 1024) =>
  Effect.gen(function* () {
    const service = yield* MemoryPoolService
    return yield* service.createBufferPool(size, defaultMemoryPoolConfig)
  })

/**
 * Memory pool utilities
 */
export const withPooledMemory = <T, R, E>(pool: MemoryPool<T>, fn: (item: T) => Effect.Effect<R, E, never>): Effect.Effect<R, E, never> =>
  Effect.acquireUseRelease(pool.acquire, fn, (item) => pool.release(item))

/**
 * Batch acquire multiple items from pool
 */
export const acquireBatch = <T>(pool: MemoryPool<T>, count: number): Effect.Effect<T[], never, never> =>
  Effect.gen(function* () {
    const items: T[] = []
    for (let i = 0; i < count; i++) {
      const item = yield* pool.acquire
      items.push(item)
    }
    return items
  })

/**
 * Batch release multiple items to pool
 */
export const releaseBatch = <T>(pool: MemoryPool<T>, items: T[]): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    for (const item of items) {
      yield* pool.release(item)
    }
  })
