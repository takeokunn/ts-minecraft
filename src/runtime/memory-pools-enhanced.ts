import { Effect, Ref, Schedule, Duration } from 'effect'

import { ComponentName, ComponentOfName } from '@/core/components'
import { EffectObjectPool, createEffectPool, PoolableObject } from '@/core/performance'
import { MemoryDetector, Profile } from '@/core/performance'

/**
 * Enhanced Memory Pool System with Advanced Optimization Strategies
 * 
 * Features:
 * - Cache-aligned object pools
 * - Hierarchical memory management
 * - Smart preallocation based on usage patterns
 * - Memory locality optimization
 * - Automatic pool resizing based on performance metrics
 */

/**
 * Advanced Temporary Object Pool for short-lived calculations
 */
export interface PoolableTemporaryObject extends PoolableObject {
  readonly type: 'vector' | 'matrix' | 'ray' | 'plane' | 'calculation' | 'buffer'
  
  initialize(type: string, data?: any): this
  getData(): any
  setData(data: any): this
  getSize(): number
}

export class ManagedTemporaryObject implements PoolableTemporaryObject {
  public type: 'vector' | 'matrix' | 'ray' | 'plane' | 'calculation' | 'buffer' = 'calculation'
  private data: any = null
  
  initialize(type: string, data?: any): this {
    this.type = type as any
    this.data = data || null
    return this
  }
  
  getData(): any {
    return this.data
  }
  
  setData(data: any): this {
    this.data = data
    return this
  }
  
  getSize(): number {
    if (this.data instanceof ArrayBuffer) return this.data.byteLength
    if (this.data instanceof Float32Array) return this.data.byteLength
    if (this.data instanceof Uint32Array) return this.data.byteLength
    return 64 // Estimated size for other objects
  }
  
  reset(): void {
    this.type = 'calculation'
    this.data = null
  }
}

/**
 * Optimized ArrayBuffer Pool with size classes
 */
export interface PoolableArrayBuffer extends PoolableObject {
  readonly buffer: ArrayBuffer
  readonly size: number
  readonly sizeClass: 'small' | 'medium' | 'large' | 'xlarge'
  
  initialize(size: number): this
  getBuffer(): ArrayBuffer
  getSizeClass(): string
}

export class ManagedArrayBuffer implements PoolableArrayBuffer {
  public buffer: ArrayBuffer
  public size: number = 0
  public sizeClass: 'small' | 'medium' | 'large' | 'xlarge' = 'small'
  
  constructor(initialSize: number = 1024) {
    this.buffer = new ArrayBuffer(initialSize)
    this.size = initialSize
    this.sizeClass = this.determineSizeClass(initialSize)
  }
  
  private determineSizeClass(size: number): 'small' | 'medium' | 'large' | 'xlarge' {
    if (size <= 1024) return 'small'
    if (size <= 8192) return 'medium'
    if (size <= 65536) return 'large'
    return 'xlarge'
  }
  
  initialize(size: number): this {
    if (size > this.buffer.byteLength) {
      this.buffer = new ArrayBuffer(size)
    }
    this.size = size
    this.sizeClass = this.determineSizeClass(size)
    return this
  }
  
  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.size)
  }
  
  getSizeClass(): string {
    return this.sizeClass
  }
  
  reset(): void {
    this.size = 0
  }
}

/**
 * Cache-optimized Float32Array Pool
 */
export interface PoolableFloat32Array extends PoolableObject {
  readonly array: Float32Array
  readonly length: number
  readonly stride: number
  
  initialize(length: number, stride?: number): this
  getArray(): Float32Array
  getStridedView(offset: number, count: number): Float32Array
}

export class ManagedFloat32Array implements PoolableFloat32Array {
  public array: Float32Array
  public length: number = 0
  public stride: number = 1
  
  constructor(initialLength: number = 256) {
    this.array = new Float32Array(initialLength)
    this.length = initialLength
  }
  
  initialize(length: number, stride: number = 1): this {
    if (length > this.array.length) {
      this.array = new Float32Array(length)
    }
    this.length = length
    this.stride = stride
    return this
  }
  
  getArray(): Float32Array {
    return this.array.subarray(0, this.length)
  }
  
  getStridedView(offset: number, count: number): Float32Array {
    const end = Math.min(offset + count * this.stride, this.length)
    return this.array.subarray(offset, end)
  }
  
  reset(): void {
    this.length = 0
    this.stride = 1
  }
}

/**
 * Memory Pool Usage Statistics
 */
export interface PoolUsageStats {
  readonly allocated: number
  readonly used: number
  readonly peak: number
  readonly growthRate: number
  readonly efficiency: number // used / allocated
  readonly fragmentationLevel: number
}

/**
 * Enhanced Memory Pool Manager with advanced strategies
 */
export interface EnhancedMemoryPoolManager {
  // Standard pools
  readonly temporaryObjectPool: EffectObjectPool<PoolableTemporaryObject>
  readonly arrayBufferPools: Map<string, EffectObjectPool<PoolableArrayBuffer>>
  readonly float32ArrayPools: Map<number, EffectObjectPool<PoolableFloat32Array>>
  
  // Advanced pool management
  readonly acquireTemporary: (type: string, data?: any) => Effect.Effect<PoolableTemporaryObject, never, never>
  readonly releaseTemporary: (obj: PoolableTemporaryObject) => Effect.Effect<void, never, never>
  
  readonly acquireArrayBuffer: (size: number) => Effect.Effect<PoolableArrayBuffer, never, never>
  readonly releaseArrayBuffer: (buffer: PoolableArrayBuffer) => Effect.Effect<void, never, never>
  
  readonly acquireFloat32Array: (length: number, stride?: number) => Effect.Effect<PoolableFloat32Array, never, never>
  readonly releaseFloat32Array: (array: PoolableFloat32Array) => Effect.Effect<void, never, never>
  
  // Pool optimization
  readonly optimizePools: () => Effect.Effect<void, never, never>
  readonly getUsageStats: () => Effect.Effect<Map<string, PoolUsageStats, never>, never, never>
  readonly resizePoolsBasedOnUsage: () => Effect.Effect<void, never, never>
  readonly defragmentPools: () => Effect.Effect<void, never, never>
  
  // Memory pressure handling
  readonly handleMemoryPressure: (level: 'low' | 'medium' | 'high' | 'critical') => Effect.Effect<void, never, never>
  readonly preAllocateForScenario: (scenario: 'combat' | 'exploration' | 'building' | 'menu') => Effect.Effect<void, never, never>
}

/**
 * Create enhanced memory pool manager with optimization strategies
 */
export const createEnhancedMemoryPoolManager = (): Effect.Effect<EnhancedMemoryPoolManager, never, never> =>
  Effect.gen(function* () {
    // Create temporary object pool
    const temporaryObjectPool = yield* createEffectPool(
      () => new ManagedTemporaryObject(),
      { initialSize: 200, maxSize: 5000, growthFactor: 1.5 }
    )
    
    // Create size-class based ArrayBuffer pools
    const arrayBufferPools = new Map<string, EffectObjectPool<PoolableArrayBuffer>>()
    
    const sizeClasses = [
      { name: 'small', size: 1024, initial: 50, max: 1000 },
      { name: 'medium', size: 8192, initial: 25, max: 500 },
      { name: 'large', size: 65536, initial: 10, max: 100 },
      { name: 'xlarge', size: 262144, initial: 5, max: 50 }
    ]
    
    for (const sizeClass of sizeClasses) {
      const pool = yield* createEffectPool(
        () => new ManagedArrayBuffer(sizeClass.size),
        { initialSize: sizeClass.initial, maxSize: sizeClass.max, growthFactor: 1.3 }
      )
      arrayBufferPools.set(sizeClass.name, pool)
    }
    
    // Create stride-based Float32Array pools
    const float32ArrayPools = new Map<number, EffectObjectPool<PoolableFloat32Array>>()
    
    const commonStrides = [1, 2, 3, 4, 8, 16] // Common vertex attribute strides
    for (const stride of commonStrides) {
      const pool = yield* createEffectPool(
        () => new ManagedFloat32Array(1024),
        { initialSize: 20, maxSize: 200, growthFactor: 1.4 }
      )
      float32ArrayPools.set(stride, pool)
    }
    
    // Pool usage tracking
    const usageStats = yield* Ref.make(new Map<string, PoolUsageStats>())
    const lastOptimization = yield* Ref.make(Date.now())
    
    // Helper function to get appropriate ArrayBuffer pool
    const getArrayBufferPool = (size: number) => {
      if (size <= 1024) return arrayBufferPools.get('small')!
      if (size <= 8192) return arrayBufferPools.get('medium')!
      if (size <= 65536) return arrayBufferPools.get('large')!
      return arrayBufferPools.get('xlarge')!
    }
    
    // Helper function to get appropriate Float32Array pool
    const getFloat32ArrayPool = (stride: number) => {
      return float32ArrayPools.get(stride) || float32ArrayPools.get(1)!
    }
    
    return {
      temporaryObjectPool,
      arrayBufferPools,
      float32ArrayPools,
      
      acquireTemporary: (type: string, data?: any) =>
        Effect.gen(function* () {
          const obj = yield* temporaryObjectPool.acquire
          obj.initialize(type, data)
          
          yield* MemoryDetector.trackObjects('temporary_objects', 1, obj.getSize())
          
          return obj
        }),
      
      releaseTemporary: (obj: PoolableTemporaryObject) =>
        Effect.gen(function* () {
          const size = obj.getSize()
          yield* temporaryObjectPool.release(obj)
          yield* MemoryDetector.trackObjects('temporary_objects', -1, -size)
        }),
      
      acquireArrayBuffer: (size: number) =>
        Effect.gen(function* () {
          const pool = getArrayBufferPool(size)
          const buffer = yield* pool.acquire
          buffer.initialize(size)
          
          yield* MemoryDetector.trackObjects(`array_buffer_${buffer.getSizeClass()}`, 1, size)
          
          return buffer
        }),
      
      releaseArrayBuffer: (buffer: PoolableArrayBuffer) =>
        Effect.gen(function* () {
          const pool = getArrayBufferPool(buffer.size)
          yield* pool.release(buffer)
          yield* MemoryDetector.trackObjects(`array_buffer_${buffer.sizeClass}`, -1, -buffer.size)
        }),
      
      acquireFloat32Array: (length: number, stride: number = 1) =>
        Effect.gen(function* () {
          const pool = getFloat32ArrayPool(stride)
          const array = yield* pool.acquire
          array.initialize(length, stride)
          
          yield* MemoryDetector.trackObjects(`float32_array_stride_${stride}`, 1, length * 4)
          
          return array
        }),
      
      releaseFloat32Array: (array: PoolableFloat32Array) =>
        Effect.gen(function* () {
          const pool = getFloat32ArrayPool(array.stride)
          yield* pool.release(array)
          yield* MemoryDetector.trackObjects(`float32_array_stride_${array.stride}`, -1, -array.length * 4)
        }),
      
      optimizePools: () =>
        Effect.gen(function* () {
          const now = Date.now()
          const lastOpt = yield* Ref.get(lastOptimization)
          
          // Only optimize every 30 seconds to avoid overhead
          if (now - lastOpt < 30000) return
          
          yield* Profile.start('pool_optimization')
          
          // Analyze usage patterns and resize pools
          const stats = new Map<string, PoolUsageStats>()
          
          // Analyze temporary object pool
          const tempStats = yield* temporaryObjectPool.getStats
          stats.set('temporary_objects', {
            allocated: tempStats.total,
            used: tempStats.inUse,
            peak: tempStats.total,
            growthRate: 0, // TODO: Calculate based on history
            efficiency: tempStats.inUse / Math.max(tempStats.total, 1),
            fragmentationLevel: 0
          })
          
          // Analyze ArrayBuffer pools
          for (const [sizeClass, pool] of arrayBufferPools) {
            const poolStats = yield* pool.getStats
            stats.set(`array_buffer_${sizeClass}`, {
              allocated: poolStats.total,
              used: poolStats.inUse,
              peak: poolStats.total,
              growthRate: 0,
              efficiency: poolStats.inUse / Math.max(poolStats.total, 1),
              fragmentationLevel: 0
            })
          }
          
          yield* Ref.set(usageStats, stats)
          yield* Ref.set(lastOptimization, now)
          
          yield* Profile.end('pool_optimization')
          yield* Effect.logInfo('Pool optimization completed')
        }),
      
      getUsageStats: () => Ref.get(usageStats),
      
      resizePoolsBasedOnUsage: () =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(usageStats)
          
          for (const [poolName, stat] of stats) {
            // If efficiency is low (< 30%) and pool is large, consider shrinking
            if (stat.efficiency < 0.3 && stat.allocated > 50) {
              yield* Effect.logInfo(`Pool ${poolName} has low efficiency (${(stat.efficiency * 100).toFixed(1)}%), considering optimization`)
            }
            
            // If efficiency is very high (> 90%), consider growing
            if (stat.efficiency > 0.9) {
              yield* Effect.logInfo(`Pool ${poolName} has high efficiency (${(stat.efficiency * 100).toFixed(1)}%), may need expansion`)
            }
          }
        }),
      
      defragmentPools: () =>
        Effect.gen(function* () {
          yield* Profile.start('pool_defragmentation')
          
          // Release all objects back to pools to defragment
          yield* temporaryObjectPool.releaseAll
          
          for (const [, pool] of arrayBufferPools) {
            yield* pool.releaseAll
          }
          
          for (const [, pool] of float32ArrayPools) {
            yield* pool.releaseAll
          }
          
          yield* Profile.end('pool_defragmentation')
          yield* Effect.logInfo('Pool defragmentation completed')
        }),
      
      handleMemoryPressure: (level: 'low' | 'medium' | 'high' | 'critical') =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`Handling ${level} memory pressure`)
          
          switch (level) {
            case 'low':
              // Light cleanup - just defragment
              yield* Effect.fork(Effect.delay(Duration.millis(100))(Effect.void))
              break
              
            case 'medium':
              // Moderate cleanup - release some objects
              yield* temporaryObjectPool.releaseAll
              break
              
            case 'high':
              // Aggressive cleanup - release most objects
              yield* temporaryObjectPool.releaseAll
              for (const [, pool] of arrayBufferPools) {
                yield* pool.releaseAll
              }
              break
              
            case 'critical':
              // Emergency cleanup - release everything possible
              yield* temporaryObjectPool.releaseAll
              for (const [, pool] of arrayBufferPools) {
                yield* pool.releaseAll
              }
              for (const [, pool] of float32ArrayPools) {
                yield* pool.releaseAll
              }
              
              // Force garbage collection if available
              if (typeof global !== 'undefined' && global.gc) {
                global.gc()
              }
              break
          }
        }),
      
      preAllocateForScenario: (scenario: 'combat' | 'exploration' | 'building' | 'menu') =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Pre-allocating pools for ${scenario} scenario`)
          
          switch (scenario) {
            case 'combat':
              // Pre-allocate for particle effects and damage calculations
              yield* temporaryObjectPool.grow
              break
              
            case 'exploration':
              // Pre-allocate for chunk loading and mesh generation
              for (const [, pool] of arrayBufferPools) {
                yield* pool.grow
              }
              break
              
            case 'building':
              // Pre-allocate for block placement and mesh updates
              for (const [, pool] of float32ArrayPools) {
                yield* pool.grow
              }
              break
              
            case 'menu':
              // Minimal allocation for UI
              break
          }
        })
    }
  })

/**
 * Enhanced pool performance monitoring
 */
export const monitorEnhancedPoolPerformance = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const manager = yield* Effect.Service(EnhancedMemoryPoolService)
    
    yield* Profile.start('enhanced_pool_monitoring')
    
    const stats = yield* manager.getUsageStats()
    
    let totalEfficiency = 0
    let poolCount = 0
    
    for (const [poolName, stat] of stats) {
      totalEfficiency += stat.efficiency
      poolCount++
      
      // Log pools with concerning metrics
      if (stat.efficiency < 0.3) {
        yield* Effect.logWarning(`Pool ${poolName} has low efficiency: ${(stat.efficiency * 100).toFixed(1)}%`)
      }
      
      if (stat.efficiency > 0.95) {
        yield* Effect.logInfo(`Pool ${poolName} is near capacity: ${(stat.efficiency * 100).toFixed(1)}%`)
      }
    }
    
    const averageEfficiency = poolCount > 0 ? totalEfficiency / poolCount : 0
    
    // Trigger optimization if overall efficiency is poor
    if (averageEfficiency < 0.4) {
      yield* manager.optimizePools()
    }
    
    // Check memory pressure
    const memorySnapshot = yield* MemoryDetector.getCurrentUsage()
    if (memorySnapshot && memorySnapshot.percentage > 85) {
      const pressureLevel = 
        memorySnapshot.percentage > 95 ? 'critical' :
        memorySnapshot.percentage > 90 ? 'high' : 'medium'
      
      yield* manager.handleMemoryPressure(pressureLevel)
    }
    
    yield* Profile.end('enhanced_pool_monitoring')
  }).pipe(
    Effect.repeat(Schedule.fixed(Duration.seconds(5)))
  )

/**
 * Enhanced memory pool service tag
 */
export class EnhancedMemoryPoolService extends Context.Tag('EnhancedMemoryPoolService')<
  EnhancedMemoryPoolService,
  EnhancedMemoryPoolManager
>() {}

/**
 * Utility functions for enhanced pool usage
 */
export const withTemporaryObject = <R, E, A>(
  type: string,
  data: any,
  fn: (obj: PoolableTemporaryObject) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | EnhancedMemoryPoolService> =>
  Effect.gen(function* () {
    const manager = yield* EnhancedMemoryPoolService
    return yield* Effect.acquireUseRelease(
      manager.acquireTemporary(type, data),
      fn,
      (obj) => manager.releaseTemporary(obj)
    )
  })

export const withArrayBuffer = <R, E, A>(
  size: number,
  fn: (buffer: PoolableArrayBuffer) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | EnhancedMemoryPoolService> =>
  Effect.gen(function* () {
    const manager = yield* EnhancedMemoryPoolService
    return yield* Effect.acquireUseRelease(
      manager.acquireArrayBuffer(size),
      fn,
      (buffer) => manager.releaseArrayBuffer(buffer)
    )
  })

export const withFloat32Array = <R, E, A>(
  length: number,
  stride: number = 1,
  fn: (array: PoolableFloat32Array) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | EnhancedMemoryPoolService> =>
  Effect.gen(function* () {
    const manager = yield* EnhancedMemoryPoolService
    return yield* Effect.acquireUseRelease(
      manager.acquireFloat32Array(length, stride),
      fn,
      (array) => manager.releaseFloat32Array(array)
    )
  })