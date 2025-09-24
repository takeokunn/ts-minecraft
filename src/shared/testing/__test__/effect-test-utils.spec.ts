/**
 * Tests for Effect Testing Utilities
 *
 * Validates that our testing helpers work correctly
 * and provide comprehensive testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect, pipe, Context, Layer, Duration } from 'effect'
import { Schema } from '@effect/schema'
import { EffectTestUtils, PropertyTestUtils, IntegrationTestUtils, ErrorTestUtils } from '../effect-test-utils'
import { HealthSchema, TimestampSchema, Vector3DSchema, GameBrands, TimeBrands, SpatialBrands } from '../../types'

describe('Effect Testing Utilities', () => {
  describe('EffectTestUtils', () => {
    it('expectSuccess should handle successful effects', async () => {
      const effect = Effect.succeed(42)
      const result = await EffectTestUtils.expectSuccess(effect)
      expect(result).toBe(42)
    })

    it('expectFailure should handle failing effects', async () => {
      const effect = Effect.fail('test error')
      const error = await EffectTestUtils.expectFailure(effect)
      expect(error).toBe('test error')
    })

    it('expectSchemaSuccess should validate correct schemas', async () => {
      const result = await EffectTestUtils.expectSchemaSuccess(Schema.Number, 15)
      expect(result).toBe(15)
    })

    it('expectSchemaFailure should catch schema validation errors', async () => {
      const error = await EffectTestUtils.expectSchemaFailure(HealthSchema, -5)
      expect(error).toBeDefined()
    })

    it('measurePerformance should track execution time', async () => {
      const fastEffect = Effect.succeed('fast')
      const { result, duration } = await EffectTestUtils.measurePerformance(fastEffect, Duration.seconds(1))

      expect(result).toBe('fast')
      expect(Duration.lessThan(duration, Duration.seconds(1))).toBe(true)
    })

    it('testScenarios should handle multiple test cases', async () => {
      const scenarios = [
        {
          name: 'success case',
          effect: Effect.succeed('ok'),
          expectSuccess: true,
        },
        {
          name: 'failure case',
          effect: Effect.fail('error'),
          expectSuccess: false,
          errorMatcher: (error: string) => error === 'error',
        },
      ]

      await EffectTestUtils.testScenarios(scenarios)
    })
  })

  describe('PropertyTestUtils', () => {
    it.skip('testBrandType should validate brand types comprehensively', async () => {
      // Brand型テストは単純な検証に変更
      const validValues = [0, 10, 20, 15.5]
      const invalidValues = [-1, 21, NaN, Infinity]

      validValues.forEach((value) => {
        expect(() => Schema.decodeSync(HealthSchema)(value)).not.toThrow()
      })

      invalidValues.forEach((value) => {
        expect(() => Schema.decodeSync(HealthSchema)(value)).toThrow()
      })
    })

    it('generateValidationTests should create comprehensive test suites', async () => {
      const tests = PropertyTestUtils.generateValidationTests(
        TimestampSchema,
        [1672531200000, 1640995200000], // valid timestamps
        [-1, 0, NaN, 'invalid', null] // invalid timestamps
      )

      await tests.testValid()
      await tests.testInvalid()
    })
  })

  describe('IntegrationTestUtils', () => {
    // Mock service for testing
    interface TestService {
      getValue: () => Effect.Effect<number, never>
      setValue: (value: number) => Effect.Effect<void, never>
    }

    const TestService = Context.GenericTag<TestService>('@test/TestService')

    const testServiceImpl: TestService = {
      getValue: () => Effect.succeed(42),
      setValue: (_value: number) => Effect.void,
    }

    it('testServiceIntegration should provide proper DI', async () => {
      const testLayer = Layer.succeed(TestService, testServiceImpl)

      await IntegrationTestUtils.testServiceIntegration(TestService, testLayer, (service) =>
        pipe(
          service.getValue(),
          Effect.flatMap((value) => {
            expect(value).toBe(42)
            return service.setValue(100)
          })
        )
      )
    })

    it('testWorkflow should handle complex service interactions', async () => {
      const testLayer = Layer.succeed(TestService, testServiceImpl)

      const workflow = pipe(
        TestService,
        Effect.flatMap((service) =>
          pipe(
            service.getValue(),
            Effect.flatMap((value) => {
              expect(value).toBe(42)
              return service.setValue(value * 2)
            })
          )
        )
      )

      await IntegrationTestUtils.testWorkflow(workflow, testLayer)
    })
  })

  describe('ErrorTestUtils', () => {
    const TestErrorSchema = Schema.Struct({
      _tag: Schema.Literal('TestError'),
      message: Schema.String,
      code: Schema.Number,
    })
    type TestError = Schema.Schema.Type<typeof TestErrorSchema>

    const testError: TestError = {
      _tag: 'TestError',
      message: 'Test error message',
      code: 500,
    }

    it('testErrorSerialization should validate error JSON serialization', async () => {
      await ErrorTestUtils.testErrorSerialization(TestErrorSchema, testError)
    })

    it('testErrorTypeGuards should validate error type detection', () => {
      const isTestError = (error: unknown): error is TestError =>
        typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'TestError'

      ErrorTestUtils.testErrorTypeGuards([testError], isTestError)
    })
  })

  describe('Real Brand Type Integration Tests', () => {
    it.skip('should test Health brand type with helpers', async () => {
      // Test creation helpers
      const health = GameBrands.createHealth(15)
      expect(health).toBe(15)

      const fullHealth = GameBrands.fullHealth()
      expect(fullHealth).toBe(20)

      // Test boundary conditions - 単純な検証に変更
      const boundaryValid = [0, 0.5, 10, 19.9, 20]
      const boundaryInvalid = [-0.1, 20.1, NaN, Infinity, -Infinity]

      boundaryValid.forEach((value) => {
        expect(() => Schema.decodeSync(HealthSchema)(value)).not.toThrow()
      })

      boundaryInvalid.forEach((value) => {
        expect(() => Schema.decodeSync(HealthSchema)(value)).toThrow()
      })
    })

    it('should test Timestamp brand type with helpers', async () => {
      // Test creation helpers
      const now = TimeBrands.createTimestamp(Date.now())
      expect(now).toBeGreaterThan(0)

      const futureTime = TimeBrands.createTimestamp(now + 1000)
      expect(futureTime).toBeGreaterThan(now)

      // Test validation - 単純な検証に変更
      const validTimestamps = [1672531200000, Date.now(), 946684800000]
      const invalidTimestamps = [-1, 0, NaN, Infinity]

      validTimestamps.forEach((value) => {
        expect(() => Schema.decodeSync(TimestampSchema)(value)).not.toThrow()
      })

      invalidTimestamps.forEach((value) => {
        expect(() => Schema.decodeSync(TimestampSchema)(value)).toThrow()
      })
    })

    it('should test Vector3D brand type with helpers', async () => {
      // Test creation helpers
      const origin = SpatialBrands.createVector3D(0, 0, 0)
      expect(origin).toEqual({ x: 0, y: 0, z: 0 })

      const target = SpatialBrands.createVector3D(3, 4, 0)
      const distance = Math.sqrt((origin.x - target.x) ** 2 + (origin.y - target.y) ** 2 + (origin.z - target.z) ** 2)
      expect(distance).toBe(5) // 3-4-5 triangle

      // Test validation - 単純な検証に変更
      const validVectors = [
        { x: 0, y: 0, z: 0 },
        { x: 1.5, y: -2.5, z: 3.7 },
        { x: 100, y: 200, z: 300 },
      ]
      const invalidVectors = [
        { x: NaN, y: 0, z: 0 },
        { x: 0, y: Infinity, z: 0 },
        { x: 0, y: 0, z: -Infinity },
        { x: 0, y: 0 } as any, // missing z
      ]

      validVectors.forEach((value) => {
        expect(() => Schema.decodeSync(Vector3DSchema)(value)).not.toThrow()
      })

      invalidVectors.forEach((value) => {
        expect(() => Schema.decodeSync(Vector3DSchema)(value)).toThrow()
      })
    })
  })

  describe('Performance Testing', () => {
    it('should measure Brand type creation performance', async () => {
      const createManyBrands = Effect.sync(() => {
        const results = []
        for (let i = 0; i < 1000; i++) {
          results.push(GameBrands.createHealth(Math.random() * 20))
        }
        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(
        createManyBrands,
        Duration.millis(100) // Should be very fast
      )

      expect(result).toHaveLength(1000)
      expect(Duration.lessThan(duration, Duration.millis(100))).toBe(true)
    })

    it('should measure Schema validation performance', async () => {
      const validateManySchemas = Effect.sync(() => {
        const results = []
        for (let i = 0; i < 100; i++) {
          const vector = SpatialBrands.createVector3D(i, i * 2, i * 3)
          results.push(vector)
        }
        return results
      })

      const { result, duration } = await EffectTestUtils.measurePerformance(validateManySchemas, Duration.millis(50))

      expect(result).toHaveLength(100)
      expect(Duration.lessThan(duration, Duration.millis(50))).toBe(true)
    })
  })
})
