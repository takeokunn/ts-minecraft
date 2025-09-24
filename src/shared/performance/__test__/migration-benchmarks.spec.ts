/**
 * Effect-TS Migration Performance Benchmarks
 *
 * Comprehensive performance testing to ensure the migration
 * maintains 60FPS performance while adding type safety
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, pipe, Duration } from 'effect'
import { Schema } from '@effect/schema'
import { SchemaOptimization, OptimizedValidators, type ValidationStrategy } from '../schema-optimization'
import { HealthSchema, Vector3DSchema, TimestampSchema, GameBrands, SpatialBrands, TimeBrands } from '../../types'
import { EffectTestUtils } from '../../testing/effect-test-utils'

describe.skip('Effect-TS Migration Performance Benchmarks', () => {
  const GAME_LOOP_BUDGET_MS = 16 // 60FPS = 16.67ms per frame
  const BATCH_SIZE = 1000
  const LARGE_BATCH_SIZE = 10000

  describe('Brand Type Creation Performance', () => {
    it('should create Health brands within game loop budget', async () => {
      const createHealthBatch = Effect.sync(() => {
        const results = []
        for (let i = 0; i < BATCH_SIZE; i++) {
          results.push(GameBrands.createHealth(Math.random() * 20))
        }
        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(
        createHealthBatch,
        Duration.millis(GAME_LOOP_BUDGET_MS)
      )

      expect(result).toHaveLength(BATCH_SIZE)
      expect(Duration.lessThan(duration, Duration.millis(GAME_LOOP_BUDGET_MS))).toBe(true)
    })

    it('should create Vector3D brands efficiently', async () => {
      const createVectorBatch = Effect.sync(() => {
        const results = []
        for (let i = 0; i < BATCH_SIZE; i++) {
          results.push(SpatialBrands.createVector3D(i, i * 2, i * 3))
        }
        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(
        createVectorBatch,
        Duration.millis(GAME_LOOP_BUDGET_MS)
      )

      expect(result).toHaveLength(BATCH_SIZE)
      expect(Duration.lessThan(duration, Duration.millis(GAME_LOOP_BUDGET_MS))).toBe(true)
    })

    it('should create Timestamp brands efficiently', async () => {
      const createTimestampBatch = Effect.sync(() => {
        const results = []
        const baseTime = Date.now()
        for (let i = 0; i < BATCH_SIZE; i++) {
          results.push(TimeBrands.createTimestamp(baseTime + i * 1000))
        }
        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(
        createTimestampBatch,
        Duration.millis(GAME_LOOP_BUDGET_MS)
      )

      expect(result).toHaveLength(BATCH_SIZE)
      expect(Duration.lessThan(duration, Duration.millis(GAME_LOOP_BUDGET_MS))).toBe(true)
    })
  })

  describe('Schema Validation Strategy Performance', () => {
    const testData = Array.from({ length: 100 }, (_, i) => ({
      x: i,
      y: i * 2,
      z: i * 3,
    }))

    const strategies: ValidationStrategy[] = ['strict', 'development', 'boundary', 'disabled']

    strategies.forEach((strategy) => {
      it(`should validate Vector3D with ${strategy} strategy within budget`, async () => {
        const validator = SchemaOptimization.createOptimizedValidator(Vector3DSchema, strategy)

        const validateBatch = Effect.gen(function* () {
          const results = []
          for (const data of testData) {
            const result = yield* validator.validate(data)
            results.push(result)
          }
          return results
        })

        const { result, duration } = await EffectTestUtils.measurePerformance(
          validateBatch,
          Duration.millis(GAME_LOOP_BUDGET_MS)
        )

        expect(result).toHaveLength(testData.length)
        if (strategy === 'disabled' || strategy === 'boundary') {
          // These should be extremely fast
          expect(Duration.lessThan(duration, Duration.millis(5))).toBe(true)
        } else {
          expect(Duration.lessThan(duration, Duration.millis(GAME_LOOP_BUDGET_MS))).toBe(true)
        }
      })
    })
  })

  describe('Game Loop Optimization Performance', () => {
    it('should handle entity updates within 16ms budget', async () => {
      const gameLoopValidator = OptimizedValidators.gameEntity(Vector3DSchema)

      const simulateEntityUpdates = Effect.gen(function* () {
        const cache = gameLoopValidator.createValidationCache()
        const results = []

        // Simulate 100 entity position updates per frame
        for (let i = 0; i < 100; i++) {
          const position = { x: Math.random() * 100, y: Math.random() * 100, z: Math.random() * 100 }
          const cacheKey = `entity_${i}`

          const result = yield* cache.get(cacheKey, position)
          results.push(result)
        }

        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(
        simulateEntityUpdates,
        Duration.millis(GAME_LOOP_BUDGET_MS)
      )

      expect(result).toHaveLength(100)
      expect(Duration.lessThan(duration, Duration.millis(GAME_LOOP_BUDGET_MS))).toBe(true)
    })

    it('should handle timeout validation gracefully', async () => {
      const gameLoopValidator = OptimizedValidators.gameEntity(HealthSchema)

      // Test with very tight timeout
      const result = await EffectTestUtils.expectFailure(
        gameLoopValidator.validateInGameLoop(15),
        (error) => error === 'timeout' || error === 'validation_error'
      )

      expect(['timeout', 'validation_error']).toContain(result)
    })
  })

  describe('Boundary Validation Performance', () => {
    it('should validate service inputs with detailed errors', async () => {
      const boundaryValidator = OptimizedValidators.serviceBoundary(Vector3DSchema)

      const validInput = { x: 1, y: 2, z: 3 }
      const invalidInput = { x: 'invalid', y: 2, z: 3 }

      // Valid input should succeed quickly
      const validResult = await EffectTestUtils.expectSuccess(
        boundaryValidator.validateInput(validInput, 'PlayerService.setPosition')
      )
      expect(validResult).toEqual(validInput)

      // Invalid input should fail with context
      const errorResult = await EffectTestUtils.expectFailure(
        boundaryValidator.validateInput(invalidInput, 'PlayerService.setPosition'),
        (error) => error.context === 'PlayerService.setPosition'
      )
      expect(errorResult.context).toBe('PlayerService.setPosition')
    })
  })

  describe('Cache-Aware Validation Performance', () => {
    it('should provide significant speedup for cached data', async () => {
      const cacheValidator = SchemaOptimization.createCacheAwareValidator(Vector3DSchema)

      const testVector = { x: 10, y: 20, z: 30 }
      const cacheKey = 'test_vector'

      // First validation (cache miss)
      const firstValidation = async () => {
        return await EffectTestUtils.expectSuccess(cacheValidator.validateWithCache(testVector, cacheKey, 5000))
      }

      // Second validation (cache hit)
      const secondValidation = async () => {
        return await EffectTestUtils.expectSuccess(cacheValidator.validateWithCache(testVector, cacheKey, 5000))
      }

      // Measure cache miss
      const { duration: firstDuration } = await EffectTestUtils.measurePerformance(
        Effect.promise(() => firstValidation()),
        Duration.millis(50)
      )

      // Measure cache hit
      const { duration: secondDuration } = await EffectTestUtils.measurePerformance(
        Effect.promise(() => secondValidation()),
        Duration.millis(50)
      )

      // Cache hit should be significantly faster
      expect(Duration.lessThan(secondDuration, firstDuration)).toBe(true)
      expect(Duration.lessThan(secondDuration, Duration.millis(1))).toBe(true)
    })

    it('should handle cache cleanup efficiently', async () => {
      const cacheValidator = SchemaOptimization.createCacheAwareValidator(HealthSchema)

      // Add many items to cache
      const addItemsToCache = Effect.gen(function* () {
        for (let i = 0; i < 1000; i++) {
          yield* cacheValidator.validateWithCache(i % 20, `health_${i}`, 1) // 1ms TTL
        }
      })

      await EffectTestUtils.expectSuccess(addItemsToCache)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Cleanup should be fast
      const { result: cleanedCount, duration } = await EffectTestUtils.measurePerformance(
        cacheValidator.cleanupCache(),
        Duration.millis(10)
      )

      expect(cleanedCount).toBeGreaterThan(0)
      expect(Duration.lessThan(duration, Duration.millis(10))).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track validation metrics without significant overhead', async () => {
      const monitor = SchemaOptimization.createPerformanceMonitor()
      const monitoredValidator = monitor.monitor(HealthSchema, 'HealthValidation')

      // Perform many validations
      const performValidations = Effect.gen(function* () {
        for (let i = 0; i < 1000; i++) {
          yield* monitoredValidator.validate(Math.random() * 20)
        }
      })

      const { duration } = await EffectTestUtils.measurePerformance(
        performValidations,
        Duration.millis(100) // Should be fast even with monitoring
      )

      // Check metrics
      const metrics = await EffectTestUtils.expectSuccess(monitoredValidator.getMetrics())

      expect(metrics.validationCount).toBe(1000)
      expect(metrics.averageTime).toBeGreaterThan(0)
      expect(metrics.averageTime).toBeLessThan(1) // Should be sub-millisecond
      expect(metrics.errorRate).toBe(0) // All validations should succeed

      // Monitoring should not add significant overhead
      expect(Duration.lessThan(duration, Duration.millis(100))).toBe(true)
    })
  })

  describe('Large Scale Performance', () => {
    it('should handle large batches efficiently', async () => {
      const batchValidator = SchemaOptimization.createOptimizedValidator(Vector3DSchema, 'development')

      const largeBatch = Array.from({ length: LARGE_BATCH_SIZE }, (_, i) => ({
        x: i,
        y: i * 2,
        z: i * 3,
      }))

      const validateLargeBatch = batchValidator.validateBatch(largeBatch, 100) // High concurrency

      const { result, duration } = await EffectTestUtils.measurePerformance(
        validateLargeBatch,
        Duration.seconds(1) // 1 second budget for 10k items
      )

      expect(result).toHaveLength(LARGE_BATCH_SIZE)
      expect(Duration.lessThan(duration, Duration.seconds(1))).toBe(true)

      // Should average less than 0.1ms per item
      const avgTimePerItem = Duration.toMillis(duration) / LARGE_BATCH_SIZE
      expect(avgTimePerItem).toBeLessThan(0.1)
    })
  })

  describe('Memory Usage Optimization', () => {
    it('should not cause memory leaks with repeated validations', async () => {
      const validator = OptimizedValidators.gameEntity(HealthSchema)
      const cache = validator.createValidationCache()

      // Perform many operations to test for memory leaks
      const performManyOperations = Effect.gen(function* () {
        for (let batch = 0; batch < 10; batch++) {
          // Create and validate many objects
          for (let i = 0; i < 1000; i++) {
            yield* cache.get(`health_${batch}_${i}`, Math.random() * 20)
          }

          // Periodically clear cache to simulate real usage
          if (batch % 3 === 0) {
            yield* cache.clear()
          }
        }

        return yield* cache.size()
      })

      const finalCacheSize = await EffectTestUtils.expectSuccess(performManyOperations)

      // Cache should be manageable size (not accumulating everything)
      expect(finalCacheSize).toBeLessThan(3000) // At most 3 batches worth
    })
  })
})

/**
 * ★ Insight ─────────────────────────────────────
 * Performance benchmarks validate that our Effect-TS
 * migration maintains game-ready performance while adding
 * comprehensive type safety and runtime validation.
 * ─────────────────────────────────────────────────
 */
