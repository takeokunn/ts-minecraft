import { Effect, Ref, Queue, Option, Context, Layer } from 'effect'

/**
 * Generic object pool for reusable objects
 * Reduces garbage collection pressure by reusing objects
 */

export interface PoolableObject {
  reset(): void
}

export interface ObjectPoolConfig {
  readonly initialSize: number
  readonly maxSize: number
  readonly growthFactor: number
}

/**
 * Object pool service interface
 */
export interface ObjectPool<T extends PoolableObject> {
  readonly acquire: Effect.Effect<T, never, never>
  readonly release: (obj: T) => Effect.Effect<void, never, never>
  readonly releaseAll: Effect.Effect<void, never, never>
  readonly grow: Effect.Effect<void, never, never>
  readonly getStats: Effect.Effect<
    {
      available: number
      inUse: number
      total: number
      maxSize: number
    },
    never,
    never
  >
  readonly clear: Effect.Effect<void, never, never>
}

/**
 * Object pool service for dependency injection
 */
export const ObjectPoolService = Context.GenericTag<{
  readonly createPool: <T extends PoolableObject>(factory: () => T, config?: ObjectPoolConfig) => Effect.Effect<ObjectPool<T>, never, never>
}>('ObjectPoolService')

/**
 * Create an object pool implementation
 */
const createObjectPoolImpl = <T extends PoolableObject>(
  factory: () => T,
  config: ObjectPoolConfig = {
    initialSize: 10,
    maxSize: 1000,
    growthFactor: 2,
  },
): Effect.Effect<ObjectPool<T>, never, never> =>
  Effect.gen(function* () {
    const available = yield* Queue.unbounded<T>()
    const inUse = yield* Ref.make(new Set<T>())

    // Pre-allocate initial objects
    for (let i = 0; i < config.initialSize; i++) {
      yield* Queue.offer(available, factory())
    }

    return {
      acquire: Effect.gen(function* () {
        const fromQueue = yield* Queue.poll(available)

        if (Option.isSome(fromQueue)) {
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(fromQueue.value)
            return newSet
          })
          return fromQueue.value
        }

        // Check if we can create new object
        const currentInUse = yield* Ref.get(inUse)
        if (currentInUse.size < config.maxSize) {
          const obj = factory()
          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.add(obj)
            return newSet
          })
          return obj
        }

        // Pool exhausted, create anyway with warning
        yield* Effect.logWarning(`Object pool exhausted (size: ${config.maxSize})`)
        return factory()
      }),

      release: (obj: T) =>
        Effect.gen(function* () {
          const currentInUse = yield* Ref.get(inUse)

          if (!currentInUse.has(obj)) {
            yield* Effect.logWarning('Attempting to release object not from this pool')
            return
          }

          yield* Ref.update(inUse, (set) => {
            const newSet = new Set(set)
            newSet.delete(obj)
            return newSet
          })

          obj.reset()

          const queueSize = yield* Queue.size(available)
          if (queueSize < config.maxSize) {
            yield* Queue.offer(available, obj)
          }
        }),

      releaseAll: Effect.gen(function* () {
        const currentInUse = yield* Ref.get(inUse)

        for (const obj of currentInUse) {
          obj.reset()
          const queueSize = yield* Queue.size(available)
          if (queueSize < config.maxSize) {
            yield* Queue.offer(available, obj)
          }
        }

        yield* Ref.set(inUse, new Set())
      }),

      grow: Effect.gen(function* () {
        const queueSize = yield* Queue.size(available)
        const inUseSize = (yield* Ref.get(inUse)).size
        const currentSize = queueSize + inUseSize

        const targetSize = Math.min(Math.floor(currentSize * config.growthFactor), config.maxSize)

        const toAdd = targetSize - currentSize
        for (let i = 0; i < toAdd; i++) {
          yield* Queue.offer(available, factory())
        }
      }),

      getStats: Effect.gen(function* () {
        const queueSize = yield* Queue.size(available)
        const inUseSize = (yield* Ref.get(inUse)).size

        return {
          available: queueSize,
          inUse: inUseSize,
          total: queueSize + inUseSize,
          maxSize: config.maxSize,
        }
      }),

      clear: Effect.gen(function* () {
        // Clear available queue
        yield* Queue.takeAll(available)
        // Clear in-use set
        yield* Ref.set(inUse, new Set())
      }),
    }
  })

/**
 * Object Pool Service Layer implementation
 */
export const ObjectPoolServiceLive = Layer.succeed(
  ObjectPoolService,
  ObjectPoolService.of({
    createPool: createObjectPoolImpl,
  }),
)

/**
 * Specialized pools for common objects
 */

// Vector3 pool functional implementation
export interface PooledVector3 extends PoolableObject {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): this
  copy(other: { x: number; y: number; z: number }): this
  add(other: { x: number; y: number; z: number }): this
  sub(other: { x: number; y: number; z: number }): this
  scale(scalar: number): this
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

    reset() {
      this.x = 0
      this.y = 0
      this.z = 0
    },
  }
  return vector3
}

// Matrix4 pool functional implementation
export interface PooledMatrix4 extends PoolableObject {
  elements: Float32Array
  identity(): this
  copy(other: { elements: Float32Array }): this
}

export const createPooledMatrix4 = (): PooledMatrix4 => {
  const matrix4 = {
    elements: new Float32Array(16),

    identity() {
      const e = this.elements
      e[0] = 1
      e[4] = 0
      e[8] = 0
      e[12] = 0
      e[1] = 0
      e[5] = 1
      e[9] = 0
      e[13] = 0
      e[2] = 0
      e[6] = 0
      e[10] = 1
      e[14] = 0
      e[3] = 0
      e[7] = 0
      e[11] = 0
      e[15] = 1
      return this
    },

    copy(other: { elements: Float32Array }) {
      this.elements.set(other.elements)
      return this
    },

    reset() {
      this.identity()
    },
  }

  matrix4.identity()
  return matrix4
}

// AABB pool functional implementation
export interface PooledAABB extends PoolableObject {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this
  copy(other: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }): this
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
}

export const matrix4PoolConfig: ObjectPoolConfig = {
  initialSize: 20,
  maxSize: 1000,
  growthFactor: 2,
}

export const aabbPoolConfig: ObjectPoolConfig = {
  initialSize: 50,
  maxSize: 5000,
  growthFactor: 2,
}

/**
 * Pre-configured pools as Effects
 */
export const createVector3Pool = Effect.gen(function* () {
  const service = yield* ObjectPoolService
  return yield* service.createPool(createPooledVector3, vector3PoolConfig)
})

export const createMatrix4Pool = Effect.gen(function* () {
  const service = yield* ObjectPoolService
  return yield* service.createPool(createPooledMatrix4, matrix4PoolConfig)
})

export const createAABBPool = Effect.gen(function* () {
  const service = yield* ObjectPoolService
  return yield* service.createPool(createPooledAABB, aabbPoolConfig)
})

/**
 * Effect version of withPooled - use pooled object with automatic cleanup
 */
export const withPooledEffect = <T extends PoolableObject, R, E>(pool: ObjectPool<T>, fn: (obj: T) => Effect.Effect<R, E, never>): Effect.Effect<R, E, never> =>
  Effect.acquireUseRelease(pool.acquire, fn, (obj) => pool.release(obj))

/**
 * Convenience function to create and use a temporary pool
 */
export const withTemporaryPool = <T extends PoolableObject, R, E>(
  factory: () => T,
  config: ObjectPoolConfig,
  fn: (pool: ObjectPool<T>) => Effect.Effect<R, E, never>,
): Effect.Effect<R, E, ObjectPoolService> =>
  Effect.gen(function* () {
    const service = yield* ObjectPoolService
    const pool = yield* service.createPool(factory, config)
    return yield* fn(pool)
  })
