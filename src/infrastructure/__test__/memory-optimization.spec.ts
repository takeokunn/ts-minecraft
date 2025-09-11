import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { Effect, Layer, Duration, Ref } from 'effect'
import { ObjectPool, vector3Pool, matrix4Pool, aabbPool, createEffectPool } from '@/core/performance/object-pool'
import { ChunkCacheLive, ChunkPriority } from '../chunk-cache'
import type { Chunk } from '@/core/components/world/chunk'
import type { ChunkCoordinates } from '@/core/values/coordinates'

/**
 * Memory Optimization Integration Tests
 * Tests object pooling, chunk caching, and memory usage patterns
 */

describe('Memory Management Integration', () => {
  beforeEach(() => {
    // Clear all pools before each test
    vector3Pool.clear()
    matrix4Pool.clear()
    aabbPool.clear()
  })

  afterEach(() => {
    // Clean up after each test
    vector3Pool.releaseAll()
    matrix4Pool.releaseAll()
    aabbPool.releaseAll()
  })

  describe('Object Pooling', () => {
    test('should efficiently pool and reuse Vector3 objects', () => {
      const initialStats = vector3Pool.getStats()
      expect(initialStats.available).toBeGreaterThan(0)

      // Acquire objects
      const vectors = Array.from({ length: 50 }, () => vector3Pool.acquire())
      
      // Modify them
      vectors.forEach((vec, i) => {
        vec.set(i, i * 2, i * 3)
      })

      const afterAcquireStats = vector3Pool.getStats()
      expect(afterAcquireStats.inUse).toBe(50)
      expect(afterAcquireStats.available).toBe(initialStats.available - 50)

      // Release objects
      vectors.forEach(vec => vector3Pool.release(vec))

      const afterReleaseStats = vector3Pool.getStats()
      expect(afterReleaseStats.inUse).toBe(0)
      expect(afterReleaseStats.available).toBe(initialStats.available)

      // Verify reset worked
      const reusedVector = vector3Pool.acquire()
      expect(reusedVector.x).toBe(0)
      expect(reusedVector.y).toBe(0)
      expect(reusedVector.z).toBe(0)
      vector3Pool.release(reusedVector)
    })

    test('should handle pool exhaustion gracefully', () => {
      const testPool = new ObjectPool(
        () => ({ value: 0, reset: () => {} }),
        obj => obj.reset(),
        5 // Small max size
      )

      // Exhaust the pool
      const objects = Array.from({ length: 10 }, () => testPool.acquire())
      
      expect(objects.length).toBe(10)
      
      const stats = testPool.getStats()
      expect(stats.inUse).toBe(10)
      expect(stats.maxSize).toBe(5)

      // Release all
      objects.forEach(obj => testPool.release(obj))
      
      const finalStats = testPool.getStats()
      expect(finalStats.inUse).toBe(0)
      expect(finalStats.available).toBe(5) // Only max size kept in pool
    })

    test('should measure memory efficiency of pooling', async () => {
      const iterations = 1000
      const objectsPerIteration = 100

      // Test without pooling
      const startTimeNoPool = performance.now()
      const startMemoryNoPool = (performance as any).memory?.usedJSHeapSize || 0

      for (let i = 0; i < iterations; i++) {
        const objects = Array.from({ length: objectsPerIteration }, () => ({
          x: Math.random(),
          y: Math.random(), 
          z: Math.random()
        }))
        // Simulate some operations
        objects.forEach(obj => {
          obj.x += obj.y * obj.z
        })
      }

      const endTimeNoPool = performance.now()
      const endMemoryNoPool = (performance as any).memory?.usedJSHeapSize || 0

      // Force GC if available
      if ((globalThis as any).gc) {
        (globalThis as any).gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Test with pooling
      const startTimeWithPool = performance.now()
      const startMemoryWithPool = (performance as any).memory?.usedJSHeapSize || 0

      for (let i = 0; i < iterations; i++) {
        const objects = Array.from({ length: objectsPerIteration }, () => vector3Pool.acquire())
        
        // Simulate operations
        objects.forEach(obj => {
          obj.x = Math.random()
          obj.y = Math.random()
          obj.z = Math.random()
          obj.x += obj.y * obj.z
        })
        
        // Release back to pool
        objects.forEach(obj => vector3Pool.release(obj))
      }

      const endTimeWithPool = performance.now()
      const endMemoryWithPool = (performance as any).memory?.usedJSHeapSize || 0

      const nopoolTime = endTimeNoPool - startTimeNoPool
      const poolTime = endTimeWithPool - startTimeWithPool
      const nopoolMemory = endMemoryNoPool - startMemoryNoPool
      const poolMemory = endMemoryWithPool - startMemoryWithPool

      console.log(`Memory Pool Performance Comparison:`)
      console.log(`Without Pooling: ${nopoolTime.toFixed(2)}ms, ${(nopoolMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`With Pooling: ${poolTime.toFixed(2)}ms, ${(poolMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`Time improvement: ${((nopoolTime - poolTime) / nopoolTime * 100).toFixed(1)}%`)
      console.log(`Memory improvement: ${((nopoolMemory - poolMemory) / nopoolMemory * 100).toFixed(1)}%`)

      // Pooling should be more memory efficient
      expect(poolMemory).toBeLessThan(nopoolMemory)
    })

    test('should work correctly with Effect-based pools', async () => {
      class TestPoolObject {
        value: number = 0
        
        set(val: number) {
          this.value = val
          return this
        }
        
        reset() {
          this.value = 0
        }
      }

      const effectPool = await Effect.runPromise(
        createEffectPool(() => new TestPoolObject())
      )

      // Test acquisition and release
      const obj1 = await Effect.runPromise(effectPool.acquire)
      obj1.set(42)
      expect(obj1.value).toBe(42)

      await Effect.runPromise(effectPool.release(obj1))

      // Verify reset worked
      const obj2 = await Effect.runPromise(effectPool.acquire)
      expect(obj2.value).toBe(0)

      await Effect.runPromise(effectPool.release(obj2))

      const stats = await Effect.runPromise(effectPool.getStats)
      expect(stats.inUse).toBe(0)
      expect(stats.available).toBeGreaterThan(0)
    })
  })

  describe('Chunk Caching', () => {
    let chunkCache: any

    beforeEach(async () => {
      chunkCache = await Effect.runPromise(
        Effect.provide(Layer.mergeAll(ChunkCacheLive), Effect.gen(function* () {
          return yield* Effect.service(Effect.Tag<any>('ChunkManager'))
        }))
      )
    })

    test('should cache chunks with LRU eviction', async () => {
      // Create test chunks
      const createChunk = (x: number, z: number): Chunk => ({
        chunkX: x,
        chunkZ: z,
        blocks: Array(16 * 16 * 256).fill('stone'),
        entities: [],
        blockEntities: [],
        biome: 'plains',
        isLoaded: true,
        lightData: undefined,
      })

      // Fill cache beyond L1 capacity (512 chunks)
      const chunks = Array.from({ length: 600 }, (_, i) => 
        createChunk(Math.floor(i / 25), i % 25)
      )

      // Add all chunks
      for (const chunk of chunks) {
        await Effect.runPromise(
          chunkCache.setChunk(chunk, ChunkPriority.NORMAL)
        )
      }

      // Verify cache metrics
      const metrics = await Effect.runPromise(chunkCache.getCacheMetrics())
      
      console.log(`Chunk Cache Metrics:`)
      console.log(`- L1 Size: ${metrics.l1Size}`)
      console.log(`- L2 Size: ${metrics.l2Size}`)
      console.log(`- L3 Size: ${metrics.l3Size}`)
      console.log(`- Hit Rate: ${metrics.hitRate.toFixed(2)}%`)
      console.log(`- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`)

      expect(metrics.l1Size).toBeLessThanOrEqual(512) // Respects L1 limit
      expect(metrics.l2Size + metrics.l3Size).toBeGreaterThan(0) // LRU eviction to L2/L3
    })

    test('should demonstrate cache hit ratio under realistic usage patterns', async () => {
      const createChunk = (x: number, z: number): Chunk => ({
        chunkX: x,
        chunkZ: z,
        blocks: Array(16 * 16 * 256).fill('grass'),
        entities: [],
        blockEntities: [],
        biome: 'forest',
        isLoaded: true,
        lightData: undefined,
      })

      // Simulate player movement pattern - accessing chunks in a local area repeatedly
      const playerPath = [
        [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
      ]

      // Pre-load chunks in 5x5 area around player
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          const chunk = createChunk(x, z)
          await Effect.runPromise(chunkCache.setChunk(chunk))
        }
      }

      // Simulate player movement with repeated chunk access
      const accessResults = []
      
      for (let step = 0; step < 100; step++) {
        const [px, pz] = playerPath[step % playerPath.length]
        
        // Access chunks around current player position (3x3 area)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const result = await Effect.runPromise(
              chunkCache.getChunk(px + dx, pz + dz)
            )
            accessResults.push(result._tag === 'Some')
          }
        }
      }

      const metrics = await Effect.runPromise(chunkCache.getCacheMetrics())
      const hitCount = accessResults.filter(Boolean).length
      const hitRate = (hitCount / accessResults.length) * 100

      console.log(`Realistic Usage Pattern Results:`)
      console.log(`- Total chunk accesses: ${accessResults.length}`)
      console.log(`- Cache hits: ${hitCount}`)
      console.log(`- Hit rate: ${hitRate.toFixed(2)}%`)
      console.log(`- L1 Hits: ${metrics.l1Hits}`)
      console.log(`- L2 Hits: ${metrics.l2Hits}`)
      console.log(`- L3 Hits: ${metrics.l3Hits}`)
      console.log(`- Misses: ${metrics.misses}`)

      // Should achieve high hit rate for local movement pattern
      expect(hitRate).toBeGreaterThan(70) // Target: >70% cache hit rate
    })

    test('should compress chunk data effectively', async () => {
      // Create chunks with patterns that compress well
      const createCompressibleChunk = (x: number, z: number, blockType: string): Chunk => ({
        chunkX: x,
        chunkZ: z,
        blocks: Array(16 * 16 * 64).fill(blockType), // Highly compressible - same block
        entities: [],
        blockEntities: [],
        biome: 'plains',
        isLoaded: true,
        lightData: undefined,
      })

      const createRandomChunk = (x: number, z: number): Chunk => ({
        chunkX: x,
        chunkZ: z,
        blocks: Array.from({ length: 16 * 16 * 64 }, () => 
          ['stone', 'dirt', 'grass', 'sand', 'water'][Math.floor(Math.random() * 5)]
        ),
        entities: [],
        blockEntities: [],
        biome: 'plains',
        isLoaded: true,
        lightData: undefined,
      })

      // Add compressible chunks
      for (let i = 0; i < 20; i++) {
        const chunk = createCompressibleChunk(i, 0, 'stone')
        await Effect.runPromise(chunkCache.setChunk(chunk))
      }

      // Add random chunks
      for (let i = 0; i < 20; i++) {
        const chunk = createRandomChunk(i, 1)
        await Effect.runPromise(chunkCache.setChunk(chunk))
      }

      // Force some chunks to L2 (compressed cache)
      for (let i = 0; i < 100; i++) {
        const chunk = createCompressibleChunk(i + 20, 0, 'air')
        await Effect.runPromise(chunkCache.setChunk(chunk))
      }

      const metrics = await Effect.runPromise(chunkCache.getCacheMetrics())

      console.log(`Compression Results:`)
      console.log(`- Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
      console.log(`- L1 cache size: ${metrics.l1Size}`)
      console.log(`- L2 cache size: ${metrics.l2Size}`)
      console.log(`- Compression ratio: ${metrics.compressionRatio || 'N/A'}`)

      // Compressed cache should be in use
      expect(metrics.l2Size).toBeGreaterThan(0)
    })

    test('should optimize memory usage during intensive chunk operations', async () => {
      const startMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Simulate intensive chunk loading/unloading
      for (let batch = 0; batch < 20; batch++) {
        // Load a batch of chunks
        const chunks = Array.from({ length: 50 }, (_, i) => ({
          chunkX: batch * 50 + i,
          chunkZ: 0,
          blocks: Array(16 * 16 * 256).fill('stone'),
          entities: [],
          blockEntities: [],
          biome: 'mountains',
          isLoaded: true,
          lightData: undefined,
        }))

        // Add chunks
        for (const chunk of chunks) {
          await Effect.runPromise(chunkCache.setChunk(chunk))
        }

        // Remove older chunks
        if (batch > 5) {
          for (let i = 0; i < 25; i++) {
            const oldChunkX = (batch - 5) * 50 + i
            await Effect.runPromise(chunkCache.removeChunk(oldChunkX, 0))
          }
        }

        // Periodic optimization
        if (batch % 5 === 0) {
          await Effect.runPromise(chunkCache.optimize())
        }
      }

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = endMemory - startMemory
      const metrics = await Effect.runPromise(chunkCache.getCacheMetrics())

      console.log(`Intensive Operations Memory Test:`)
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log(`- Final cache size: L1=${metrics.l1Size}, L2=${metrics.l2Size}, L3=${metrics.l3Size}`)
      console.log(`- Final memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`)

      // Memory increase should be reasonable for the operations performed
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024) // Less than 200MB increase
    })
  })

  describe('Garbage Collection Pressure', () => {
    test('should minimize GC pressure during normal operations', async () => {
      const gcPressureTest = async (usePooling: boolean) => {
        const operations = 1000
        const objectsPerOperation = 50

        const startTime = performance.now()

        if (usePooling) {
          // Use object pooling
          for (let i = 0; i < operations; i++) {
            const objects = Array.from({ length: objectsPerOperation }, () => vector3Pool.acquire())
            
            // Simulate operations
            objects.forEach((obj, index) => {
              obj.set(index, index * 2, index * 3)
              obj.add({ x: 1, y: 1, z: 1 })
              obj.scale(0.5)
            })
            
            // Release objects
            objects.forEach(obj => vector3Pool.release(obj))
          }
        } else {
          // Regular object creation
          for (let i = 0; i < operations; i++) {
            const objects = Array.from({ length: objectsPerOperation }, (_, index) => ({
              x: index,
              y: index * 2, 
              z: index * 3
            }))
            
            // Simulate operations
            objects.forEach(obj => {
              obj.x += 1
              obj.y += 1 
              obj.z += 1
              obj.x *= 0.5
              obj.y *= 0.5
              obj.z *= 0.5
            })
            
            // Objects go out of scope - eligible for GC
          }
        }

        const endTime = performance.now()
        return endTime - startTime
      }

      // Test both approaches
      const regularTime = await gcPressureTest(false)
      const pooledTime = await gcPressureTest(true)

      console.log(`GC Pressure Comparison:`)
      console.log(`- Regular objects: ${regularTime.toFixed(2)}ms`)
      console.log(`- Pooled objects: ${pooledTime.toFixed(2)}ms`)
      console.log(`- Improvement: ${((regularTime - pooledTime) / regularTime * 100).toFixed(1)}%`)

      // Pooled version should perform better or at least comparably
      // (Actual GC measurements would require more sophisticated tooling)
      expect(pooledTime).toBeLessThan(regularTime * 1.5) // Allow 50% variance
    })

    test('should handle memory leaks prevention', async () => {
      // Test for common memory leak patterns
      const references: any[] = []

      // Create and hold references to pooled objects (potential leak)
      for (let i = 0; i < 100; i++) {
        const obj = vector3Pool.acquire()
        obj.set(i, i, i)
        references.push(obj)
      }

      let stats = vector3Pool.getStats()
      expect(stats.inUse).toBe(100)

      // Simulate application cleanup
      references.forEach(obj => vector3Pool.release(obj))
      references.length = 0 // Clear references

      stats = vector3Pool.getStats()
      expect(stats.inUse).toBe(0)

      // Test pool growth doesn't cause unbounded memory
      const manyObjects = Array.from({ length: 2000 }, () => vector3Pool.acquire())
      
      stats = vector3Pool.getStats()
      const totalObjects = stats.inUse + stats.available
      
      // Release all
      manyObjects.forEach(obj => vector3Pool.release(obj))
      
      const finalStats = vector3Pool.getStats()
      expect(finalStats.inUse).toBe(0)
      expect(finalStats.available).toBeLessThanOrEqual(stats.maxSize)
    })
  })

  describe('Memory Usage Patterns', () => {
    test('should achieve target memory efficiency for game scenarios', async () => {
      // Simulate a typical game scenario with multiple memory systems
      const scenario = async () => {
        // Use various memory systems together
        
        // 1. Object pools for frequent operations
        const vectors = Array.from({ length: 500 }, () => {
          const vec = vector3Pool.acquire()
          vec.set(Math.random(), Math.random(), Math.random())
          return vec
        })

        const matrices = Array.from({ length: 100 }, () => {
          const mat = matrix4Pool.acquire()
          return mat
        })

        const aabbs = Array.from({ length: 200 }, () => {
          const aabb = aabbPool.acquire()
          aabb.set(-1, -1, -1, 1, 1, 1)
          return aabb
        })

        // 2. Chunk caching
        if (chunkCache) {
          for (let i = 0; i < 50; i++) {
            const chunk: Chunk = {
              chunkX: i % 10,
              chunkZ: Math.floor(i / 10),
              blocks: Array(16 * 16 * 128).fill('stone'),
              entities: [],
              blockEntities: [],
              biome: 'plains',
              isLoaded: true,
              lightData: undefined,
            }
            await Effect.runPromise(chunkCache.setChunk(chunk))
          }
        }

        // 3. Simulate game loop operations
        for (let frame = 0; frame < 60; frame++) {
          // Update positions (using pooled vectors)
          vectors.forEach(vec => {
            vec.x += Math.sin(frame * 0.1) * 0.01
            vec.z += Math.cos(frame * 0.1) * 0.01
          })

          // Some objects are removed and new ones added
          if (frame % 10 === 0) {
            // Remove some objects
            const toRemove = vectors.splice(0, 10)
            toRemove.forEach(vec => vector3Pool.release(vec))

            // Add new objects
            for (let i = 0; i < 10; i++) {
              const vec = vector3Pool.acquire()
              vec.set(Math.random(), Math.random(), Math.random())
              vectors.push(vec)
            }
          }
        }

        // Cleanup
        vectors.forEach(vec => vector3Pool.release(vec))
        matrices.forEach(mat => matrix4Pool.release(mat))
        aabbs.forEach(aabb => aabbPool.release(aabb))
      }

      const startMemory = (performance as any).memory?.usedJSHeapSize || 0
      const startTime = performance.now()

      await scenario()

      const endTime = performance.now()
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0

      const executionTime = endTime - startTime
      const memoryIncrease = endMemory - startMemory

      // Get pool statistics
      const vectorStats = vector3Pool.getStats()
      const matrixStats = matrix4Pool.getStats()
      const aabbStats = aabbPool.getStats()

      console.log(`Game Scenario Memory Analysis:`)
      console.log(`- Execution time: ${executionTime.toFixed(2)}ms`)
      console.log(`- Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log(`- Vector3 pool efficiency: ${vectorStats.available}/${vectorStats.total} available`)
      console.log(`- Matrix4 pool efficiency: ${matrixStats.available}/${matrixStats.total} available`)
      console.log(`- AABB pool efficiency: ${aabbStats.available}/${aabbStats.total} available`)

      // Performance expectations
      expect(executionTime).toBeLessThan(1000) // Should complete quickly
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Memory increase should be minimal
      expect(vectorStats.inUse).toBe(0) // All objects should be returned to pool
      expect(matrixStats.inUse).toBe(0)
      expect(aabbStats.inUse).toBe(0)
    })
  })
})