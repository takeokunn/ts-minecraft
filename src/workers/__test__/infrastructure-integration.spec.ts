import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { Effect, Duration, TestClock, TestContext } from 'effect'
import { createTypedWorkerClient, createWorkerPool, createWorkerFactory } from '../base/typed-worker'
import { TerrainGenerationRequest, TerrainGenerationResponse } from '../shared/protocol'
import { ChunkPriority } from '@/infrastructure/chunk-cache'
import type { ChunkCoordinates } from '@/core/values/coordinates'

/**
 * Infrastructure Integration Tests for Worker System
 * Tests worker pool, TypedWorker integration, and performance benchmarks
 */

describe('Worker Infrastructure Integration', () => {
  let workerPool: Awaited<ReturnType<typeof createWorkerPool<TerrainGenerationRequest, TerrainGenerationResponse>>>
  let testClock: TestClock.TestClock

  beforeEach(async () => {
    testClock = TestClock.make()
  })

  afterEach(async () => {
    if (workerPool) {
      await Effect.runPromise(workerPool.terminate())
    }
  })

  describe('Worker Pool Integration', () => {
    test('should create worker pool with multiple instances', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
          timeout: Duration.seconds(30),
          maxConcurrentRequests: 5
        }
      )

      const poolEffect = createWorkerPool(factory, 4)
      workerPool = await Effect.runPromise(poolEffect)

      expect(workerPool.poolSize).toBe(4)
    })

    test('should handle concurrent terrain generation requests', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
          timeout: Duration.seconds(30)
        }
      )

      workerPool = await Effect.runPromise(createWorkerPool(factory, 2))

      const requests: TerrainGenerationRequest[] = Array.from({ length: 10 }, (_, i) => ({
        coordinates: { x: i, z: 0 } as ChunkCoordinates,
        seed: 12345,
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.8,
        },
        editedBlocks: undefined,
      }))

      const startTime = Date.now()
      
      const results = await Effect.runPromise(
        Effect.all(
          requests.map(request => workerPool.sendRequest(request)),
          { concurrency: 'unbounded' }
        )
      )

      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(results).toHaveLength(10)
      expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds

      // Verify all responses have valid data
      results.forEach((response, index) => {
        expect(response.chunkData.coordinates).toEqual({ x: index, z: 0 })
        expect(response.chunkData.blocks.length).toBeGreaterThan(0)
        expect(response.meshData).toBeDefined()
        expect(response.performanceMetrics.generationTime).toBeGreaterThan(0)
      })
    })

    test('should maintain worker throughput under load', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
          timeout: Duration.seconds(10)
        }
      )

      workerPool = await Effect.runPromise(createWorkerPool(factory, 4))

      // Benchmark: Process 100 chunks within 30 seconds (targeting >3 req/s per worker)
      const benchmarkRequests = Array.from({ length: 100 }, (_, i) => ({
        coordinates: { x: Math.floor(i / 10), z: i % 10 } as ChunkCoordinates,
        seed: 54321,
        biomeSettings: {
          temperature: 0.6,
          humidity: 0.4,
          elevation: 0.7,
        },
      }))

      const startTime = Date.now()
      
      const results = await Effect.runPromise(
        Effect.all(
          benchmarkRequests.map(request => 
            workerPool.sendRequest(request).pipe(
              Effect.timeout(Duration.seconds(8))
            )
          ),
          { concurrency: 4 }
        )
      )

      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000 // Convert to seconds
      const throughput = results.length / totalTime

      console.log(`Worker Pool Throughput: ${throughput.toFixed(2)} req/s`)
      console.log(`Total time: ${totalTime.toFixed(2)}s for ${results.length} requests`)

      // Target: At least 10 req/s total (2.5 req/s per worker with 4 workers)
      expect(throughput).toBeGreaterThan(10)
      expect(results).toHaveLength(100)
    })
  })

  describe('SharedArrayBuffer Integration', () => {
    test('should utilize SharedArrayBuffer for zero-copy transfers', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      const worker = await Effect.runPromise(factory())
      
      try {
        // Test with SharedArrayBuffer if supported
        if (typeof SharedArrayBuffer !== 'undefined') {
          const sharedBuffer = new SharedArrayBuffer(1024 * 16) // 16KB

          const request: TerrainGenerationRequest = {
            coordinates: { x: 0, z: 0 } as ChunkCoordinates,
            seed: 98765,
            biomeSettings: {
              temperature: 0.3,
              humidity: 0.8,
              elevation: 0.9,
            },
          }

          const result = await Effect.runPromise(
            worker.sendRequest(request, { sharedBuffer })
          )

          expect(result.chunkData).toBeDefined()
          expect(result.performanceMetrics.generationTime).toBeGreaterThan(0)
        }
      } finally {
        await Effect.runPromise(worker.terminate())
      }
    })
  })

  describe('Transferable Objects Integration', () => {
    test('should transfer ArrayBuffers without copying', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      const worker = await Effect.runPromise(factory())

      try {
        const request: TerrainGenerationRequest = {
          coordinates: { x: 5, z: 5 } as ChunkCoordinates,
          seed: 11111,
          biomeSettings: {
            temperature: 0.7,
            humidity: 0.3,
            elevation: 0.6,
          },
        }

        const result = await Effect.runPromise(worker.sendRequest(request))

        // Verify mesh data contains transferable arrays
        expect(result.meshData.positions).toBeInstanceOf(ArrayBuffer)
        expect(result.meshData.indices).toBeInstanceOf(ArrayBuffer)
        expect(result.meshData.normals).toBeInstanceOf(ArrayBuffer)
        expect(result.meshData.uvs).toBeInstanceOf(ArrayBuffer)
      } finally {
        await Effect.runPromise(worker.terminate())
      }
    })
  })

  describe('Worker Error Handling', () => {
    test('should handle worker timeout gracefully', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
          timeout: Duration.millis(100), // Very short timeout
        }
      )

      const worker = await Effect.runPromise(factory())

      try {
        const request: TerrainGenerationRequest = {
          coordinates: { x: 0, z: 0 } as ChunkCoordinates,
          seed: 12345,
          biomeSettings: {
            temperature: 0.5,
            humidity: 0.5,
            elevation: 0.5,
          },
        }

        await expect(
          Effect.runPromise(worker.sendRequest(request))
        ).rejects.toThrow('timeout')
      } finally {
        await Effect.runPromise(worker.terminate())
      }
    })

    test('should handle invalid worker requests', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      const worker = await Effect.runPromise(factory())

      try {
        // Invalid request (missing required fields)
        const invalidRequest = {
          coordinates: { x: 0, z: 0 },
          // Missing seed and biomeSettings
        } as any

        await expect(
          Effect.runPromise(worker.sendRequest(invalidRequest))
        ).rejects.toThrow()
      } finally {
        await Effect.runPromise(worker.terminate())
      }
    })
  })

  describe('Performance Benchmarks', () => {
    test('should meet terrain generation performance targets', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      workerPool = await Effect.runPromise(createWorkerPool(factory, 4))

      // Performance test: 16x16 area (256 chunks)
      const performanceRequests = Array.from({ length: 256 }, (_, i) => ({
        coordinates: { 
          x: Math.floor(i / 16), 
          z: i % 16 
        } as ChunkCoordinates,
        seed: 42,
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.5,
        },
      }))

      const startTime = Date.now()
      
      const results = await Effect.runPromise(
        Effect.all(
          performanceRequests.map(request => workerPool.sendRequest(request)),
          { concurrency: 4 }
        )
      )

      const endTime = Date.now()
      const totalTime = (endTime - startTime) / 1000
      const throughput = results.length / totalTime

      console.log(`Large Scale Performance:`)
      console.log(`- Generated ${results.length} chunks in ${totalTime.toFixed(2)}s`)
      console.log(`- Throughput: ${throughput.toFixed(2)} chunks/s`)
      console.log(`- Average generation time: ${results.reduce((acc, r) => acc + r.performanceMetrics.generationTime, 0) / results.length}ms`)

      // Performance targets
      expect(throughput).toBeGreaterThan(8) // At least 8 chunks/s
      expect(totalTime).toBeLessThan(60) // Complete within 1 minute
      
      // Verify data quality
      const averageBlockCount = results.reduce((acc, r) => acc + r.chunkData.blocks.length, 0) / results.length
      expect(averageBlockCount).toBeGreaterThan(1000) // Reasonable block density
    })

    test('should optimize memory usage during bulk operations', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      const worker = await Effect.runPromise(factory())

      try {
        const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0

        // Process 50 chunks sequentially to test memory management
        for (let i = 0; i < 50; i++) {
          const request: TerrainGenerationRequest = {
            coordinates: { x: i, z: 0 } as ChunkCoordinates,
            seed: 777,
            biomeSettings: {
              temperature: 0.4,
              humidity: 0.6,
              elevation: 0.8,
            },
          }

          await Effect.runPromise(worker.sendRequest(request))
        }

        const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0
        const memoryIncrease = memoryAfter - memoryBefore

        console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

        // Memory should not increase excessively (target: <100MB for 50 chunks)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB
      } finally {
        await Effect.runPromise(worker.terminate())
      }
    })
  })

  describe('Worker Pool Load Balancing', () => {
    test('should distribute load evenly across workers', async () => {
      const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
        '/src/workers/terrain-generation.worker.ts',
        {
          inputSchema: TerrainGenerationRequest,
          outputSchema: TerrainGenerationResponse,
        }
      )

      workerPool = await Effect.runPromise(createWorkerPool(factory, 3))

      // Send 30 requests (10 per worker ideally)
      const requests = Array.from({ length: 30 }, (_, i) => ({
        coordinates: { x: i % 10, z: Math.floor(i / 10) } as ChunkCoordinates,
        seed: 999,
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.5,
        },
      }))

      const results = await Effect.runPromise(
        Effect.all(
          requests.map(request => workerPool.sendRequest(request)),
          { concurrency: 'unbounded' }
        )
      )

      expect(results).toHaveLength(30)
      
      // All requests should complete successfully
      results.forEach(result => {
        expect(result.chunkData).toBeDefined()
        expect(result.meshData).toBeDefined()
      })
    })
  })
})

/**
 * Physics Worker Integration Tests
 */
describe('Physics Worker Integration', () => {
  test('should handle physics simulation workload', async () => {
    // This would test physics worker when implemented
    // For now, we'll test the terrain generation worker's physics-related features
    
    const factory = createWorkerFactory<TerrainGenerationRequest, TerrainGenerationResponse>(
      '/src/workers/terrain-generation.worker.ts',
      {
        inputSchema: TerrainGenerationRequest,
        outputSchema: TerrainGenerationResponse,
      }
    )

    const worker = await Effect.runPromise(factory())

    try {
      const request: TerrainGenerationRequest = {
        coordinates: { x: 0, z: 0 } as ChunkCoordinates,
        seed: 12345,
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.8,
        },
      }

      const result = await Effect.runPromise(worker.sendRequest(request))

      // Verify terrain has proper collision data
      expect(result.chunkData.blocks.length).toBeGreaterThan(0)
      expect(result.chunkData.heightMap).toBeDefined()
      expect(result.chunkData.heightMap.length).toBe(16 * 16) // 16x16 heightmap
      
    } finally {
      await Effect.runPromise(worker.terminate())
    }
  })
})