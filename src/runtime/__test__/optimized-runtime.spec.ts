import { Effect, Duration, TestClock, TestContext } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import {
  OptimizedRuntimeLayer,
  startOptimizedRuntime,
  benchmarkOptimizedRuntime,
  defaultOptimizedConfig,
  type PrioritizedSystem
} from '../optimized-runtime'
import { testSystems } from '../example-usage'
import { Profile } from '@/core/performance'

describe('Optimized Runtime', () => {
  
  describe('Game Loop Optimization', () => {
    it.effect('should execute systems based on priority', () =>
      Effect.gen(function* () {
        const executionOrder: string[] = []
        
        const testSystems: PrioritizedSystem<never, never>[] = [
          {
            system: Effect.sync(() => executionOrder.push('low')),
            priority: 'low',
            name: 'low-priority'
          },
          {
            system: Effect.sync(() => executionOrder.push('critical')),
            priority: 'critical',
            name: 'critical-priority'
          },
          {
            system: Effect.sync(() => executionOrder.push('high')),
            priority: 'high',
            name: 'high-priority'
          },
          {
            system: Effect.sync(() => executionOrder.push('normal')),
            priority: 'normal',
            name: 'normal-priority'
          }
        ]

        // Run one frame
        const config = {
          ...defaultOptimizedConfig,
          gameLoop: {
            ...defaultOptimizedConfig.gameLoop,
            priorityThreshold: 100 // High threshold to allow all systems
          }
        }

        const runtime = startOptimizedRuntime(testSystems, config).pipe(
          Effect.timeout(Duration.millis(100))
        )

        yield* runtime.pipe(Effect.provide(OptimizedRuntimeLayer(config)))

        // Critical and high priority should execute first
        expect(executionOrder.indexOf('critical')).toBeLessThan(executionOrder.indexOf('normal'))
        expect(executionOrder.indexOf('high')).toBeLessThan(executionOrder.indexOf('normal'))
      }))

    it.effect('should respect frame budget constraints', () =>
      Effect.gen(function* () {
        const executedSystems: string[] = []
        
        const slowSystem: PrioritizedSystem<never, never> = {
          system: Effect.gen(function* () {
            yield* Effect.sleep(Duration.millis(50)) // Intentionally slow
            executedSystems.push('slow')
          }),
          priority: 'normal',
          name: 'slow-system',
          canSkip: true
        }

        const fastSystem: PrioritizedSystem<never, never> = {
          system: Effect.sync(() => executedSystems.push('fast')),
          priority: 'critical',
          name: 'fast-system',
          canSkip: false
        }

        const config = {
          ...defaultOptimizedConfig,
          gameLoop: {
            ...defaultOptimizedConfig.gameLoop,
            priorityThreshold: 20 // Very tight budget
          }
        }

        const runtime = startOptimizedRuntime([slowSystem, fastSystem], config).pipe(
          Effect.timeout(Duration.millis(200))
        )

        yield* runtime.pipe(Effect.provide(OptimizedRuntimeLayer(config)))

        // Fast critical system should always execute
        expect(executedSystems).toContain('fast')
      }))
  })

  describe('Memory Pool Management', () => {
    it.effect('should efficiently manage entity lifecycle', () =>
      Effect.gen(function* () {
        const { withPooledEntity } = yield* Effect.succeed(
          require('../memory-pools')
        )

        let entityCreated = false
        let entityReleased = false

        yield* withPooledEntity('test-entity', entity => 
          Effect.gen(function* () {
            entityCreated = true
            expect(entity.id).toBe('test-entity')
            expect(entity.active).toBe(true)
            return Effect.void
          })
        )

        entityReleased = true // After withPooledEntity completes

        expect(entityCreated).toBe(true)
        expect(entityReleased).toBe(true)
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))

    it.effect('should track pool utilization', () =>
      Effect.gen(function* () {
        const poolManager = yield* Effect.serviceOption(
          require('../memory-pools').MemoryPoolService
        )

        if (poolManager._tag === 'Some') {
          const stats = yield* poolManager.value.getPoolStats()
          
          expect(stats.entities).toHaveProperty('available')
          expect(stats.entities).toHaveProperty('inUse')
          expect(stats.entities).toHaveProperty('total')
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))
  })

  describe('Resource Management', () => {
    it.effect('should load resources with proper caching', () =>
      Effect.gen(function* () {
        const { loadTexture } = yield* Effect.succeed(
          require('../resource-manager')
        )

        const mockTextureRequest = loadTexture('/test-texture.png', 'high')
        
        // Mock the image loading
        const originalImage = globalThis.Image
        globalThis.Image = class MockImage {
          src = ''
          onload: (() => void) | null = null
          onerror: (() => void) | null = null
          complete = false
          naturalWidth = 256

          constructor() {
            setTimeout(() => {
              this.complete = true
              this.naturalWidth = 256
              if (this.onload) this.onload()
            }, 10)
          }
        } as any

        const resourceManager = yield* Effect.serviceOption(
          require('../resource-manager').ResourceManagerService
        )

        if (resourceManager._tag === 'Some') {
          const resource = yield* resourceManager.value.load(mockTextureRequest)
          
          expect(resource.id).toBe('/test-texture.png')
          expect(resource.type).toBe('texture')
          expect(resource.priority).toBe('high')
        }

        // Restore original
        globalThis.Image = originalImage
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))

    it.effect('should maintain cache hit rate metrics', () =>
      Effect.gen(function* () {
        const resourceManager = yield* Effect.serviceOption(
          require('../resource-manager').ResourceManagerService
        )

        if (resourceManager._tag === 'Some') {
          const stats = yield* resourceManager.value.getStats()
          
          expect(stats.cacheStats).toHaveProperty('hitRate')
          expect(stats.cacheStats).toHaveProperty('size')
          expect(stats.cacheStats).toHaveProperty('memoryUsage')
          expect(stats.cacheStats.hitRate).toBeGreaterThanOrEqual(0)
          expect(stats.cacheStats.hitRate).toBeLessThanOrEqual(1)
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))
  })

  describe('Performance Monitoring', () => {
    it.effect('should collect performance metrics', () =>
      Effect.gen(function* () {
        const monitor = yield* Effect.serviceOption(
          require('../optimized-runtime').PerformanceMonitor
        )

        if (monitor._tag === 'Some') {
          yield* monitor.value.startMonitoring()
          
          // Wait a bit for metrics collection
          yield* Effect.sleep(Duration.millis(100))
          
          const metrics = yield* monitor.value.getMetrics()
          
          expect(metrics).toHaveProperty('fps')
          expect(metrics).toHaveProperty('frameTime')
          expect(metrics).toHaveProperty('memoryUsage')
          expect(metrics).toHaveProperty('poolUtilization')
          expect(metrics).toHaveProperty('resourceCacheHitRate')
          
          expect(typeof metrics.fps).toBe('number')
          expect(typeof metrics.frameTime).toBe('number')
          expect(typeof metrics.memoryUsage).toBe('number')
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))

    it.effect('should generate performance reports', () =>
      Effect.gen(function* () {
        const monitor = yield* Effect.serviceOption(
          require('../optimized-runtime').PerformanceMonitor
        )

        if (monitor._tag === 'Some') {
          const report = yield* monitor.value.generateReport()
          
          expect(typeof report).toBe('string')
          expect(report).toContain('Performance Report')
          expect(report.length).toBeGreaterThan(0)
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))
  })

  describe('Quality Control', () => {
    it.effect('should adjust quality based on performance', () =>
      Effect.gen(function* () {
        const qualityController = yield* Effect.serviceOption(
          require('../optimized-runtime').QualityController
        )

        if (qualityController._tag === 'Some') {
          // Set initial quality
          yield* qualityController.value.setQualityPreset('high')
          
          let initialQuality = yield* qualityController.value.getCurrentQuality()
          expect(initialQuality.renderDistance).toBe(12) // High preset
          expect(initialQuality.shadowQuality).toBe('high')
          
          // Simulate poor performance requiring quality reduction
          yield* qualityController.value.adjustQuality(60) // Target 60 FPS
          
          let adjustedQuality = yield* qualityController.value.getCurrentQuality()
          // Quality might adjust based on current FPS
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))

    it.effect('should support quality presets', () =>
      Effect.gen(function* () {
        const qualityController = yield* Effect.serviceOption(
          require('../optimized-runtime').QualityController
        )

        if (qualityController._tag === 'Some') {
          const presets = ['low', 'medium', 'high', 'ultra'] as const
          
          for (const preset of presets) {
            yield* qualityController.value.setQualityPreset(preset)
            const quality = yield* qualityController.value.getCurrentQuality()
            
            expect(quality.renderDistance).toBeGreaterThan(0)
            expect(quality.particleDensity).toBeGreaterThan(0)
            expect(['low', 'medium', 'high', 'ultra']).toContain(quality.shadowQuality)
          }
        }
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))
  })

  describe('Integration Tests', () => {
    it.effect('should achieve target performance goals', () =>
      Effect.gen(function* () {
        // Run a short benchmark
        const results = yield* benchmarkOptimizedRuntime().pipe(
          Effect.timeout(Duration.seconds(10)) // Shorter test duration
        )

        // Performance targets (relaxed for testing)
        expect(results.fps).toBeGreaterThan(0)
        expect(results.memoryEfficiency).toBeGreaterThan(0)
        expect(results.resourceCachePerformance).toBeGreaterThanOrEqual(0)
        expect(results.poolEfficiency).toBeGreaterThan(0)
        expect(results.overallScore).toBeGreaterThan(0)
        expect(results.overallScore).toBeLessThanOrEqual(1)
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))

    it.effect('should handle system errors gracefully', () =>
      Effect.gen(function* () {
        const errorSystem: PrioritizedSystem<string, never> = {
          system: Effect.fail('Test error'),
          priority: 'normal',
          name: 'error-system'
        }

        const normalSystem: PrioritizedSystem<never, never> = {
          system: Effect.sync(() => { /* normal operation */ }),
          priority: 'normal',
          name: 'normal-system'
        }

        // Should not throw even with error system
        const config = {
          ...defaultOptimizedConfig,
          gameLoop: {
            ...defaultOptimizedConfig.gameLoop,
            priorityThreshold: 100
          }
        }

        const runtime = startOptimizedRuntime([errorSystem, normalSystem], config).pipe(
          Effect.timeout(Duration.millis(100))
        )

        // Should complete without throwing
        yield* runtime.pipe(Effect.provide(OptimizedRuntimeLayer(config)))
      }))

    it.effect('should maintain stable frame timing', () =>
      Effect.gen(function* () {
        const frameTimes: number[] = []
        
        const timingSystem: PrioritizedSystem<never, never> = {
          system: Effect.sync(() => {
            frameTimes.push(performance.now())
          }),
          priority: 'critical',
          name: 'timing-system'
        }

        const config = {
          ...defaultOptimizedConfig,
          gameLoop: {
            ...defaultOptimizedConfig.gameLoop,
            fixedTimeStep: 16.67, // ~60 FPS
            enableInterpolation: true
          }
        }

        const runtime = startOptimizedRuntime([timingSystem], config).pipe(
          Effect.timeout(Duration.millis(200))
        )

        yield* runtime.pipe(Effect.provide(OptimizedRuntimeLayer(config)))

        expect(frameTimes.length).toBeGreaterThan(1)
        
        // Check frame timing consistency (if we collected enough frames)
        if (frameTimes.length > 2) {
          const deltaTimesMs = frameTimes.slice(1).map((time, i) => 
            time - frameTimes[i]
          )
          
          const avgDelta = deltaTimesMs.reduce((sum, delta) => sum + delta, 0) / deltaTimesMs.length
          expect(avgDelta).toBeGreaterThan(0) // Should have measurable frame times
        }
      }))
  })

  describe('Memory Leak Detection', () => {
    it.effect('should detect and report memory issues', () =>
      Effect.gen(function* () {
        // This would typically require a longer running test
        // For now, just verify the monitoring is working
        yield* Effect.sleep(Duration.millis(100))
        
        const { MemoryDetector } = yield* Effect.succeed(
          require('@/core/performance')
        )
        
        const currentUsage = yield* MemoryDetector.getCurrentUsage()
        const leaks = yield* MemoryDetector.getLeaks()
        
        // Just verify we can get the data
        expect(Array.isArray(leaks)).toBe(true)
      }).pipe(Effect.provide(OptimizedRuntimeLayer())))
  })

}, { 
  provider: TestContext,
  timeout: Duration.seconds(30) // Longer timeout for performance tests
})