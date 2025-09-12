/**
 * Performance Baseline Tests
 *
 * This test suite establishes performance baselines for the DDD migration
 * and measures Effect-TS overhead to ensure the architecture doesn't
 * negatively impact performance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer, Duration, Clock, TestClock, Ref } from 'effect'

// Import layers and services
import { TestLayer, AppLayer, DomainLayer, InfrastructureLayer } from '@/layers'

// Import domain services and ports
import { WorldDomainService, PhysicsDomainService, EntityDomainService } from '@/layers'

import { MathPort, RenderPort, PerformanceMonitorPort } from '@domain/ports'

// Performance tracking utilities
interface PerformanceMetric {
  operation: string
  duration: number
  memoryUsed: number
  timestamp: number
}

// Functional PerformanceTracker using Effect-TS patterns
interface PerformanceTracker {
  readonly measure: <T>(operation: string, fn: () => Promise<T>) => Effect.Effect<T, never, never>
  readonly getMetrics: Effect.Effect<PerformanceMetric[], never, never>
  readonly getAverageFor: (operation: string) => Effect.Effect<{ avgDuration: number; avgMemory: number }, never, never>
  readonly clear: Effect.Effect<void, never, never>
}

const createPerformanceTracker = Effect.gen(function* () {
  const metricsRef = yield* Ref.make<PerformanceMetric[]>([])

  const measure = <T>(operation: string, fn: () => Promise<T>): Effect.Effect<T, never, never> =>
    Effect.gen(function* () {
      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()

      const result = yield* Effect.promise(() => fn())

      const endTime = performance.now()
      const endMemory = process.memoryUsage().heapUsed

      const metric: PerformanceMetric = {
        operation,
        duration: endTime - startTime,
        memoryUsed: endMemory - startMemory,
        timestamp: Date.now(),
      }

      yield* Ref.update(metricsRef, (metrics) => [...metrics, metric])

      return result
    })

  const getMetrics: Effect.Effect<PerformanceMetric[], never, never> = Effect.gen(function* () {
    const metrics = yield* Ref.get(metricsRef)
    return [...metrics]
  })

  const getAverageFor = (operation: string): Effect.Effect<{ avgDuration: number; avgMemory: number }, never, never> =>
    Effect.gen(function* () {
      const metrics = yield* Ref.get(metricsRef)
      const operationMetrics = metrics.filter((m) => m.operation === operation)

      if (operationMetrics.length === 0) {
        return { avgDuration: 0, avgMemory: 0 }
      }

      const avgDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0) / operationMetrics.length
      const avgMemory = operationMetrics.reduce((sum, m) => sum + m.memoryUsed, 0) / operationMetrics.length

      return { avgDuration, avgMemory }
    })

  const clear: Effect.Effect<void, never, never> = Ref.set(metricsRef, [])

  return {
    measure,
    getMetrics,
    getAverageFor,
    clear,
  } satisfies PerformanceTracker
})

describe('Performance Baseline Tests', () => {
  let performanceTracker: PerformanceTracker

  beforeAll(async () => {
    performanceTracker = await Effect.runPromise(createPerformanceTracker)
  })

  afterAll(async () => {
    // Log final performance summary
    const metrics = await Effect.runPromise(performanceTracker.getMetrics)
    console.log('\n=== Performance Summary ===')

    const operations = [...new Set(metrics.map((m) => m.operation))]
    for (const op of operations) {
      const { avgDuration, avgMemory } = await Effect.runPromise(performanceTracker.getAverageFor(op))
      console.log(`${op}: ${avgDuration.toFixed(2)}ms avg, ${(avgMemory / 1024).toFixed(2)}KB avg memory`)
    }
  })

  describe('Memory Usage Patterns', () => {
    it('should not have excessive memory usage in Effect operations', async () => {
      const memoryTest = async () => {
        const result = await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const mathPort = yield* MathPort

              // Perform many operations to test memory patterns
              const vectors = []
              for (let i = 0; i < 1000; i++) {
                const vector = yield* mathPort.vector3.create(i, i + 1, i + 2)
                vectors.push(vector)
              }

              // Perform calculations
              let sum = vectors[0]
              for (let i = 1; i < vectors.length; i++) {
                sum = yield* mathPort.vector3.add(sum, vectors[i])
              }

              return sum
            }),
            TestLayer,
          ),
        )
        return result
      }

      const finalSum = await Effect.runPromise(Effect.runPromise(performanceTracker.measure('memory-heavy-operations', memoryTest)))

      expect(finalSum).toBeDefined()

      const { avgMemory } = await Effect.runPromise(performanceTracker.getAverageFor('memory-heavy-operations'))

      // Memory usage should be reasonable (less than 10MB for 1000 operations)
      expect(avgMemory).toBeLessThan(10 * 1024 * 1024)
    })

    it('should properly clean up resources', async () => {
      const cleanupTest = async () => {
        const initialMemory = process.memoryUsage().heapUsed

        // Create and destroy many objects
        await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const renderPort = yield* RenderPort

              // Simulate creating and destroying meshes
              for (let i = 0; i < 100; i++) {
                const meshId = `test-mesh-${i}`
                yield* renderPort.createMesh(meshId, {
                  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
                  indices: new Uint16Array([0, 1, 2]),
                  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
                })
                yield* renderPort.destroyMesh(meshId)
              }

              return true
            }),
            TestLayer,
          ),
        )

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const finalMemory = process.memoryUsage().heapUsed
        return finalMemory - initialMemory
      }

      const memoryDiff = await Effect.runPromise(performanceTracker.measure('resource-cleanup', cleanupTest))

      // Memory difference should be minimal after cleanup
      expect(Math.abs(memoryDiff)).toBeLessThan(5 * 1024 * 1024) // 5MB tolerance
    })

    it('should have stable memory usage over time', async () => {
      const stableMemoryTest = async () => {
        const measurements = []

        for (let iteration = 0; iteration < 10; iteration++) {
          const startMemory = process.memoryUsage().heapUsed

          await Effect.runPromise(
            Effect.provide(
              Effect.gen(function* () {
                const worldService = yield* WorldDomainService
                const physicsService = yield* PhysicsDomainService

                // Perform consistent operations
                for (let i = 0; i < 100; i++) {
                  yield* worldService.validatePosition({ x: i, y: i, z: i })
                }

                return true
              }),
              TestLayer,
            ),
          )

          const endMemory = process.memoryUsage().heapUsed
          measurements.push(endMemory - startMemory)
        }

        return measurements
      }

      const measurements = await Effect.runPromise(performanceTracker.measure('memory-stability', stableMemoryTest))

      // Memory usage should be relatively stable across iterations
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
      const variance = measurements.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / measurements.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be less than 20% of average
      expect(stdDev).toBeLessThan(Math.abs(avg) * 0.2)
    })
  })

  describe('Async Operation Performance', () => {
    it('should have reasonable Effect composition overhead', async () => {
      const compositionTest = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const mathPort = yield* MathPort

              // Complex Effect composition
              const result = yield* Effect.gen(function* () {
                const v1 = yield* mathPort.vector3.create(1, 2, 3)
                const v2 = yield* mathPort.vector3.create(4, 5, 6)
                const v3 = yield* mathPort.vector3.add(v1, v2)
                const v4 = yield* mathPort.vector3.multiply(v3, 2)
                const magnitude = yield* mathPort.vector3.magnitude(v4)
                return magnitude
              })

              return result
            }),
            TestLayer,
          ),
        )
      }

      // Run multiple times to get average
      for (let i = 0; i < 100; i++) {
        await Effect.runPromise(performanceTracker.measure('effect-composition', compositionTest))
      }

      const { avgDuration } = await Effect.runPromise(performanceTracker.getAverageFor('effect-composition'))

      // Effect composition should be fast (less than 1ms on average)
      expect(avgDuration).toBeLessThan(1)
    })

    it('should handle concurrent operations efficiently', async () => {
      const concurrencyTest = async () => {
        const promises = Array.from({ length: 50 }, (_, i) =>
          Effect.runPromise(
            Effect.provide(
              Effect.gen(function* () {
                const mathPort = yield* MathPort
                const worldService = yield* WorldDomainService

                // Concurrent operations
                const vector = yield* mathPort.vector3.create(i, i + 1, i + 2)
                const isValid = yield* worldService.validatePosition(vector)

                return { vector, isValid }
              }),
              TestLayer,
            ),
          ),
        )

        const results = await Promise.all(promises)
        return results
      }

      const results = await Effect.runPromise(performanceTracker.measure('concurrent-operations', concurrencyTest))

      expect(results).toHaveLength(50)

      const { avgDuration } = await Effect.runPromise(performanceTracker.getAverageFor('concurrent-operations'))

      // Concurrent operations should complete reasonably fast
      expect(avgDuration).toBeLessThan(100) // 100ms for 50 concurrent operations
    })

    it('should have efficient error handling paths', async () => {
      const errorHandlingTest = async () => {
        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < 100; i++) {
          try {
            await Effect.runPromise(
              Effect.provide(
                Effect.gen(function* () {
                  const mathPort = yield* MathPort

                  // Some operations that might fail
                  if (i % 10 === 0) {
                    // Simulate error condition
                    throw new Error('Simulated error')
                  }

                  const vector = yield* mathPort.vector3.create(i, i, i)
                  const normalized = yield* mathPort.vector3.normalize(vector)

                  return normalized
                }),
                TestLayer,
              ),
            )
            successCount++
          } catch (error) {
            errorCount++
          }
        }

        return { successCount, errorCount }
      }

      const results = await Effect.runPromise(performanceTracker.measure('error-handling', errorHandlingTest))

      expect(results.successCount + results.errorCount).toBe(100)
      expect(results.errorCount).toBe(10) // Every 10th operation should fail

      const { avgDuration } = await Effect.runPromise(performanceTracker.getAverageFor('error-handling'))

      // Error handling should not significantly slow down operations
      expect(avgDuration).toBeLessThan(50)
    })
  })

  describe('Effect-TS Overhead Measurement', () => {
    it('should measure pure Effect overhead vs native operations', async () => {
      // Native operations baseline
      const nativeTest = async () => {
        const vectors = []
        for (let i = 0; i < 1000; i++) {
          vectors.push({ x: i, y: i + 1, z: i + 2 })
        }

        let sum = vectors[0]
        for (let i = 1; i < vectors.length; i++) {
          sum = {
            x: sum.x + vectors[i].x,
            y: sum.y + vectors[i].y,
            z: sum.z + vectors[i].z,
          }
        }

        return sum
      }

      // Effect-TS operations
      const effectTest = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const mathPort = yield* MathPort

              const vectors = []
              for (let i = 0; i < 1000; i++) {
                const vector = yield* mathPort.vector3.create(i, i + 1, i + 2)
                vectors.push(vector)
              }

              let sum = vectors[0]
              for (let i = 1; i < vectors.length; i++) {
                sum = yield* mathPort.vector3.add(sum, vectors[i])
              }

              return sum
            }),
            TestLayer,
          ),
        )
      }

      // Measure both approaches
      const nativeResult = await Effect.runPromise(performanceTracker.measure('native-operations', nativeTest))
      const effectResult = await Effect.runPromise(performanceTracker.measure('effect-operations', effectTest))

      expect(nativeResult).toBeDefined()
      expect(effectResult).toBeDefined()

      const nativeMetrics = await Effect.runPromise(performanceTracker.getAverageFor('native-operations'))
      const effectMetrics = await Effect.runPromise(performanceTracker.getAverageFor('effect-operations'))

      // Effect overhead should be reasonable (less than 10x native performance)
      const overhead = effectMetrics.avgDuration / nativeMetrics.avgDuration
      expect(overhead).toBeLessThan(10)

      console.log(`Effect-TS overhead: ${overhead.toFixed(2)}x native performance`)
    })

    it('should measure layer initialization overhead', async () => {
      const layerInitTest = async () => {
        // Measure time to initialize test layer
        const startTime = performance.now()

        await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const worldService = yield* WorldDomainService
              const physicsService = yield* PhysicsDomainService
              const entityService = yield* EntityDomainService
              const mathPort = yield* MathPort

              // Ensure services are initialized
              expect(worldService).toBeDefined()
              expect(physicsService).toBeDefined()
              expect(entityService).toBeDefined()
              expect(mathPort).toBeDefined()

              return true
            }),
            TestLayer,
          ),
        )

        const endTime = performance.now()
        return endTime - startTime
      }

      const initTime = await Effect.runPromise(performanceTracker.measure('layer-initialization', layerInitTest))

      // Layer initialization should be fast (less than 100ms)
      expect(initTime).toBeLessThan(100)
    })

    it('should measure service lookup performance', async () => {
      const lookupTest = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              // Perform many service lookups
              for (let i = 0; i < 1000; i++) {
                const worldService = yield* WorldDomainService
                const mathPort = yield* MathPort

                expect(worldService).toBeDefined()
                expect(mathPort).toBeDefined()
              }

              return true
            }),
            TestLayer,
          ),
        )
      }

      await Effect.runPromise(performanceTracker.measure('service-lookup', lookupTest))

      const { avgDuration } = await Effect.runPromise(performanceTracker.getAverageFor('service-lookup'))

      // Service lookups should be efficient
      expect(avgDuration).toBeLessThan(50) // 50ms for 1000 lookups
    })
  })

  describe('Performance Baselines Establishment', () => {
    it('should establish vector operation baselines', async () => {
      const vectorBaseline = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const mathPort = yield* MathPort

              const operations = {
                create: 0,
                add: 0,
                multiply: 0,
                magnitude: 0,
                normalize: 0,
              }

              const iterations = 1000

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* mathPort.vector3.create(i, i + 1, i + 2)
                operations.create += performance.now() - start
              }

              const v1 = yield* mathPort.vector3.create(1, 2, 3)
              const v2 = yield* mathPort.vector3.create(4, 5, 6)

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* mathPort.vector3.add(v1, v2)
                operations.add += performance.now() - start
              }

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* mathPort.vector3.multiply(v1, 2)
                operations.multiply += performance.now() - start
              }

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* mathPort.vector3.magnitude(v1)
                operations.magnitude += performance.now() - start
              }

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* mathPort.vector3.normalize(v1)
                operations.normalize += performance.now() - start
              }

              // Return averages
              return Object.fromEntries(Object.entries(operations).map(([key, total]) => [key, total / iterations]))
            }),
            TestLayer,
          ),
        )
      }

      const baselines = await Effect.runPromise(performanceTracker.measure('vector-baselines', vectorBaseline))

      // Establish baseline expectations (these can be adjusted based on hardware)
      expect(baselines.create).toBeLessThan(0.1) // 0.1ms per create
      expect(baselines.add).toBeLessThan(0.1) // 0.1ms per add
      expect(baselines.multiply).toBeLessThan(0.1) // 0.1ms per multiply
      expect(baselines.magnitude).toBeLessThan(0.1) // 0.1ms per magnitude
      expect(baselines.normalize).toBeLessThan(0.1) // 0.1ms per normalize

      console.log('Vector operation baselines:', baselines)
    })

    it('should establish domain service baselines', async () => {
      const domainBaseline = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const worldService = yield* WorldDomainService
              const physicsService = yield* PhysicsDomainService

              const operations = {
                validatePosition: 0,
                calculateGravity: 0,
              }

              const iterations = 1000

              for (let i = 0; i < iterations; i++) {
                const start = performance.now()
                yield* worldService.validatePosition({ x: i, y: i, z: i })
                operations.validatePosition += performance.now() - start
              }

              if (physicsService.calculateGravity) {
                for (let i = 0; i < iterations; i++) {
                  const start = performance.now()
                  yield* physicsService.calculateGravity({ x: 0, y: 0, z: 0 })
                  operations.calculateGravity += performance.now() - start
                }
              }

              return Object.fromEntries(Object.entries(operations).map(([key, total]) => [key, total / iterations]))
            }),
            TestLayer,
          ),
        )
      }

      const baselines = await Effect.runPromise(performanceTracker.measure('domain-baselines', domainBaseline))

      // Domain operations should be very fast
      expect(baselines.validatePosition).toBeLessThan(0.5) // 0.5ms per validation

      console.log('Domain service baselines:', baselines)
    })

    it('should establish overall system performance baseline', async () => {
      const systemBaseline = async () => {
        return await Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              const worldService = yield* WorldDomainService
              const physicsService = yield* PhysicsDomainService
              const mathPort = yield* MathPort

              // Simulate a complete game tick operation
              const tickOperations = []

              for (let i = 0; i < 100; i++) {
                const start = performance.now()

                // Simulate entity updates
                const position = yield* mathPort.vector3.create(i, i + 1, i + 2)
                const velocity = yield* mathPort.vector3.create(0.1, -0.98, 0.1)
                const newPosition = yield* mathPort.vector3.add(position, velocity)

                yield* worldService.validatePosition(newPosition)

                const tickTime = performance.now() - start
                tickOperations.push(tickTime)
              }

              const avgTickTime = tickOperations.reduce((a, b) => a + b, 0) / tickOperations.length
              const maxTickTime = Math.max(...tickOperations)
              const minTickTime = Math.min(...tickOperations)

              return { avgTickTime, maxTickTime, minTickTime }
            }),
            TestLayer,
          ),
        )
      }

      const systemMetrics = await Effect.runPromise(performanceTracker.measure('system-baseline', systemBaseline))

      // System should maintain 60fps (16.67ms per frame budget)
      expect(systemMetrics.avgTickTime).toBeLessThan(16) // Average tick under 16ms
      expect(systemMetrics.maxTickTime).toBeLessThan(50) // Max tick under 50ms

      console.log('System performance baseline:', systemMetrics)

      // Store baselines for future comparison
      expect(systemMetrics).toBeDefined()
    })
  })
})
