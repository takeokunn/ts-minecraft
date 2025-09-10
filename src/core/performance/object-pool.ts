import { Effect, Ref, Queue, Option, pipe } from 'effect'

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

export class ObjectPool<T extends PoolableObject> {
  private readonly available: T[] = []
  private readonly inUse = new Set<T>()
  
  constructor(
    private readonly factory: () => T,
    private readonly config: ObjectPoolConfig = {
      initialSize: 10,
      maxSize: 1000,
      growthFactor: 2
    }
  ) {
    // Pre-allocate initial objects
    for (let i = 0; i < config.initialSize; i++) {
      this.available.push(factory())
    }
  }
  
  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T
    
    if (this.available.length > 0) {
      obj = this.available.pop()!
    } else if (this.inUse.size < this.config.maxSize) {
      // Create new object if under max size
      obj = this.factory()
    } else {
      // Pool exhausted, forcefully create (may cause GC pressure)
      console.warn(`Object pool exhausted (size: ${this.config.maxSize})`)
      obj = this.factory()
    }
    
    this.inUse.add(obj)
    return obj
  }
  
  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('Attempting to release object not from this pool')
      return
    }
    
    this.inUse.delete(obj)
    obj.reset()
    
    // Only keep up to maxSize objects in available pool
    if (this.available.length < this.config.maxSize) {
      this.available.push(obj)
    }
  }
  
  /**
   * Release all objects back to the pool
   */
  releaseAll(): void {
    this.inUse.forEach(obj => {
      obj.reset()
      if (this.available.length < this.config.maxSize) {
        this.available.push(obj)
      }
    })
    this.inUse.clear()
  }
  
  /**
   * Grow the pool by the growth factor
   */
  grow(): void {
    const currentSize = this.available.length + this.inUse.size
    const targetSize = Math.min(
      Math.floor(currentSize * this.config.growthFactor),
      this.config.maxSize
    )
    
    const toAdd = targetSize - currentSize
    for (let i = 0; i < toAdd; i++) {
      this.available.push(this.factory())
    }
  }
  
  /**
   * Get pool statistics
   */
  getStats(): {
    available: number
    inUse: number
    total: number
    maxSize: number
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.config.maxSize
    }
  }
  
  /**
   * Clear the pool (for cleanup)
   */
  clear(): void {
    this.available.length = 0
    this.inUse.clear()
  }
}

/**
 * Effect-based object pool with managed lifecycle
 */
export interface EffectObjectPool<T extends PoolableObject> {
  readonly acquire: Effect.Effect<T, never, never>
  readonly release: (obj: T) => Effect.Effect<void, never, never>
  readonly releaseAll: Effect.Effect<void, never, never>
  readonly grow: Effect.Effect<void, never, never>
  readonly getStats: Effect.Effect<{
    available: number
    inUse: number
    total: number
    maxSize: number
  }, never, never>
}

export const createEffectPool = <T extends PoolableObject>(
  factory: () => T,
  config: ObjectPoolConfig = {
    initialSize: 10,
    maxSize: 1000,
    growthFactor: 2
  }
): Effect.Effect<EffectObjectPool<T>, never, never> =>
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
          yield* Ref.update(inUse, set => {
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
          yield* Ref.update(inUse, set => {
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
          
          yield* Ref.update(inUse, set => {
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
        
        const targetSize = Math.min(
          Math.floor(currentSize * config.growthFactor),
          config.maxSize
        )
        
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
          maxSize: config.maxSize
        }
      })
    }
  })

/**
 * Specialized pools for common objects
 */

// Vector3 pool
export class PooledVector3 implements PoolableObject {
  x: number = 0
  y: number = 0
  z: number = 0
  
  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }
  
  copy(other: { x: number; y: number; z: number }): this {
    this.x = other.x
    this.y = other.y
    this.z = other.z
    return this
  }
  
  add(other: { x: number; y: number; z: number }): this {
    this.x += other.x
    this.y += other.y
    this.z += other.z
    return this
  }
  
  sub(other: { x: number; y: number; z: number }): this {
    this.x -= other.x
    this.y -= other.y
    this.z -= other.z
    return this
  }
  
  scale(scalar: number): this {
    this.x *= scalar
    this.y *= scalar
    this.z *= scalar
    return this
  }
  
  reset(): void {
    this.x = 0
    this.y = 0
    this.z = 0
  }
}

// Matrix4 pool
export class PooledMatrix4 implements PoolableObject {
  elements: Float32Array = new Float32Array(16)
  
  constructor() {
    this.identity()
  }
  
  identity(): this {
    const e = this.elements
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1
    return this
  }
  
  copy(other: { elements: Float32Array }): this {
    this.elements.set(other.elements)
    return this
  }
  
  reset(): void {
    this.identity()
  }
}

// AABB pool
export class PooledAABB implements PoolableObject {
  minX: number = 0
  minY: number = 0
  minZ: number = 0
  maxX: number = 0
  maxY: number = 0
  maxZ: number = 0
  
  set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this {
    this.minX = minX
    this.minY = minY
    this.minZ = minZ
    this.maxX = maxX
    this.maxY = maxY
    this.maxZ = maxZ
    return this
  }
  
  copy(other: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }): this {
    this.minX = other.minX
    this.minY = other.minY
    this.minZ = other.minZ
    this.maxX = other.maxX
    this.maxY = other.maxY
    this.maxZ = other.maxZ
    return this
  }
  
  reset(): void {
    this.minX = 0
    this.minY = 0
    this.minZ = 0
    this.maxX = 0
    this.maxY = 0
    this.maxZ = 0
  }
}

// Pre-configured pools
export const vector3Pool = new ObjectPool(
  () => new PooledVector3(),
  { initialSize: 100, maxSize: 10000, growthFactor: 2 }
)

export const matrix4Pool = new ObjectPool(
  () => new PooledMatrix4(),
  { initialSize: 20, maxSize: 1000, growthFactor: 2 }
)

export const aabbPool = new ObjectPool(
  () => new PooledAABB(),
  { initialSize: 50, maxSize: 5000, growthFactor: 2 }
)

/**
 * Utility function to use pooled object temporarily
 */
export const withPooled = <T extends PoolableObject, R>(
  pool: ObjectPool<T>,
  fn: (obj: T) => R
): R => {
  const obj = pool.acquire()
  try {
    return fn(obj)
  } finally {
    pool.release(obj)
  }
}

/**
 * Effect version of withPooled
 */
export const withPooledEffect = <T extends PoolableObject, R, E>(
  pool: EffectObjectPool<T>,
  fn: (obj: T) => Effect.Effect<R, E, never>
): Effect.Effect<R, E, never> =>
  Effect.acquireUseRelease(
    pool.acquire,
    fn,
    obj => pool.release(obj)
  )