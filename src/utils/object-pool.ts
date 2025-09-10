/**
 * Object Pool Implementation
 * Reduces garbage collection pressure by reusing objects
 */

/**
 * Generic object pool for reusable objects
 */
export class ObjectPool<T> {
  private pool: T[] = []
  private inUse = new Set<T>()
  private maxSize: number
  
  constructor(
    private readonly factory: () => T,
    private readonly reset: (obj: T) => void,
    options: {
      initialSize?: number
      maxSize?: number
      growthFactor?: number
    } = {}
  ) {
    const { initialSize = 10, maxSize = 1000 } = options
    this.maxSize = maxSize
    
    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory())
    }
  }
  
  /**
   * Get an object from the pool
   */
  acquire(): T {
    let obj = this.pool.pop()
    
    if (!obj) {
      // Pool is empty, create new object if under max size
      if (this.inUse.size < this.maxSize) {
        obj = this.factory()
      } else {
        throw new Error(`Object pool exhausted (max size: ${this.maxSize})`)
      }
    }
    
    this.inUse.add(obj)
    return obj
  }
  
  /**
   * Return an object to the pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('Attempting to release object not from this pool')
      return
    }
    
    this.inUse.delete(obj)
    this.reset(obj)
    
    // Only return to pool if we haven't exceeded max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj)
    }
  }
  
  /**
   * Release all objects back to the pool
   */
  releaseAll(): void {
    for (const obj of this.inUse) {
      this.reset(obj)
      if (this.pool.length < this.maxSize) {
        this.pool.push(obj)
      }
    }
    this.inUse.clear()
  }
  
  /**
   * Clear the pool and release all objects
   */
  clear(): void {
    this.pool.length = 0
    this.inUse.clear()
  }
  
  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      total: this.pool.length + this.inUse.size,
      maxSize: this.maxSize,
    }
  }
}

/**
 * Specialized pool for Vector3-like objects
 */
export class Vector3Pool {
  private pool: Array<{ x: number; y: number; z: number }> = []
  private readonly maxSize = 1000
  
  constructor(initialSize = 100) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push({ x: 0, y: 0, z: 0 })
    }
  }
  
  acquire(x = 0, y = 0, z = 0): { x: number; y: number; z: number } {
    const vec = this.pool.pop() || { x: 0, y: 0, z: 0 }
    vec.x = x
    vec.y = y
    vec.z = z
    return vec
  }
  
  release(vec: { x: number; y: number; z: number }): void {
    if (this.pool.length < this.maxSize) {
      vec.x = 0
      vec.y = 0
      vec.z = 0
      this.pool.push(vec)
    }
  }
}

/**
 * Pool for typed arrays
 */
export class TypedArrayPool<T extends Float32Array | Uint32Array | Uint16Array> {
  private pools = new Map<number, T[]>()
  
  constructor(
    private readonly ArrayConstructor: new (length: number) => T,
    private readonly maxPoolSize = 10
  ) {}
  
  acquire(length: number): T {
    const pool = this.pools.get(length) || []
    const array = pool.pop()
    
    if (array) {
      return array
    }
    
    return new this.ArrayConstructor(length)
  }
  
  release(array: T): void {
    const length = array.length
    let pool = this.pools.get(length)
    
    if (!pool) {
      pool = []
      this.pools.set(length, pool)
    }
    
    if (pool.length < this.maxPoolSize) {
      // Clear the array before returning to pool
      array.fill(0 as any)
      pool.push(array)
    }
  }
  
  clear(): void {
    this.pools.clear()
  }
}

/**
 * Global pools for common objects
 */
export const globalPools = {
  vector3: new Vector3Pool(),
  float32: new TypedArrayPool(Float32Array),
  uint32: new TypedArrayPool(Uint32Array),
  uint16: new TypedArrayPool(Uint16Array),
}

/**
 * Pool manager for automatic cleanup
 */
export class PoolManager {
  private pools = new Set<ObjectPool<any>>()
  
  register<T>(pool: ObjectPool<T>): void {
    this.pools.add(pool)
  }
  
  unregister<T>(pool: ObjectPool<T>): void {
    this.pools.delete(pool)
  }
  
  releaseAll(): void {
    for (const pool of this.pools) {
      pool.releaseAll()
    }
  }
  
  clearAll(): void {
    for (const pool of this.pools) {
      pool.clear()
    }
  }
  
  getStats() {
    const stats: Array<{
      pool: ObjectPool<any>
      stats: ReturnType<ObjectPool<any>['getStats']>
    }> = []
    
    for (const pool of this.pools) {
      stats.push({
        pool,
        stats: pool.getStats(),
      })
    }
    
    return stats
  }
}

// Global pool manager instance
export const poolManager = new PoolManager()

/**
 * Usage examples:
 * 
 * // Create a pool for custom objects
 * const bulletPool = new ObjectPool(
 *   () => ({ x: 0, y: 0, z: 0, velocity: 0, active: false }),
 *   (bullet) => {
 *     bullet.x = 0
 *     bullet.y = 0
 *     bullet.z = 0
 *     bullet.velocity = 0
 *     bullet.active = false
 *   },
 *   { initialSize: 50, maxSize: 200 }
 * )
 * 
 * // Use the pool
 * const bullet = bulletPool.acquire()
 * bullet.active = true
 * bullet.velocity = 100
 * // ... use bullet
 * bulletPool.release(bullet)
 * 
 * // Use global vector pool
 * const pos = globalPools.vector3.acquire(10, 20, 30)
 * // ... use position
 * globalPools.vector3.release(pos)
 */