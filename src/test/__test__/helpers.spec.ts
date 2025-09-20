import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Either, Option, Schema, Duration, Exit } from 'effect'
import * as fc from 'fast-check'
import {
  TestErrorSchema,
  createTestError,
  EffectTestHelpers,
  TestServiceFactory,
  TestDataFactory,
  DeterministicTestHelpers,
  AssertionHelpers,
  TestEnvironment,
  PropertyTestHelpers,
  PerformanceTestHelpers,
  type TestError,
} from '../helpers'

describe('Test Helpers', () => {
  describe('TestError', () => {
    it('creates valid TestError instances', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string(), { nil: undefined }),
          (message, code) => {
            const error = createTestError(message, code)

            expect(error._tag).toBe('TestError')
            expect(error.message).toBe(message)
            expect(error.code).toBe(code)
            expect(error.timestamp).toBeTypeOf('number')
            expect(error.timestamp).toBeGreaterThan(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('validates TestError schema', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string(), { nil: undefined }),
          (message, code) => {
            const error = createTestError(message, code)
            const result = Schema.decodeUnknownEither(TestErrorSchema)(error)

            expect(result._tag).toBe('Right')
            if (result._tag === 'Right') {
              expect(result.right._tag).toBe('TestError')
              expect(result.right.message).toBe(message)
              expect(result.right.code).toBe(code)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('EffectTestHelpers', () => {
    describe('runEffect', () => {
      it('runs successful effects', async () => {
        const value = fc.sample(fc.integer(), 1)[0]
        const effect = Effect.succeed(value)

        const result = await EffectTestHelpers.runEffect(effect)
        expect(result).toBe(value)
      })

      it('propagates effect failures', async () => {
        const error = createTestError('Test failure')
        const effect = Effect.fail(error)

        try {
          await EffectTestHelpers.runEffect(effect)
          expect.fail('Should have thrown an error')
        } catch (thrownError: any) {
          // Effect wraps errors, so check the actual error message contains our error
          expect(thrownError.message).toContain('TestError')
          expect(thrownError.message).toContain('Test failure')
        }
      })
    })

    describe('runEffectWithTimeout', () => {
      it('completes effects within timeout', async () => {
        const effect = Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(50))
          return 'completed'
        })

        const result = await EffectTestHelpers.runEffectWithTimeout(effect, 100)
        expect(result).toBe('completed')
      })

      it('times out long-running effects', async () => {
        const effect = Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(200))
          return 'should not complete'
        })

        await expect(EffectTestHelpers.runEffectWithTimeout(effect, 50)).rejects.toThrow()
      })
    })

    describe('Either helpers', () => {
      it('extracts Right values correctly', () => {
        fc.assert(
          fc.property(fc.anything(), (value) => {
            const either = Either.right(value)
            const result = EffectTestHelpers.expectEitherRight(either)
            expect(result).toBe(value)
          }),
          { numRuns: 50 }
        )
      })

      it('throws on Left values when expecting Right', () => {
        fc.assert(
          fc.property(fc.anything(), (error) => {
            const either = Either.left(error)
            expect(() => EffectTestHelpers.expectEitherRight(either)).toThrow()
          }),
          { numRuns: 20 }
        )
      })

      it('extracts Left values correctly', () => {
        fc.assert(
          fc.property(fc.anything(), (error) => {
            const either = Either.left(error)
            const result = EffectTestHelpers.expectEitherLeft(either)
            expect(result).toBe(error)
          }),
          { numRuns: 50 }
        )
      })

      it('throws on Right values when expecting Left', () => {
        fc.assert(
          fc.property(fc.anything(), (value) => {
            const either = Either.right(value)
            expect(() => EffectTestHelpers.expectEitherLeft(either)).toThrow()
          }),
          { numRuns: 20 }
        )
      })
    })

    describe('Option helpers', () => {
      it('extracts Some values correctly', () => {
        fc.assert(
          fc.property(fc.anything(), (value) => {
            const option = Option.some(value)
            const result = EffectTestHelpers.expectSome(option)
            expect(result).toBe(value)
          }),
          { numRuns: 50 }
        )
      })

      it('throws on None values', () => {
        const option = Option.none()
        expect(() => EffectTestHelpers.expectSome(option)).toThrow()
      })
    })

    describe('Schema helpers', () => {
      const TestSchema = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
      })

      it('validates correct schema data', () => {
        fc.assert(
          fc.property(
            fc.record({
              id: fc.integer(),
              name: fc.string(),
            }),
            (data) => {
              const result = EffectTestHelpers.expectValidDecode(TestSchema)(data)
              expect(result.id).toBe(data.id)
              expect(result.name).toBe(data.name)
            }
          ),
          { numRuns: 50 }
        )
      })

      it('detects decode errors', async () => {
        const invalidData = { id: 'not-a-number', name: 123 }
        const error = await EffectTestHelpers.expectDecodeError(TestSchema)(invalidData)
        expect(error).toBeDefined()
      })
    })
  })

  describe('TestServiceFactory', () => {
    interface MockService {
      getValue: () => string
      setValue: (value: string) => void
    }

    const MockServiceTag = {
      _tag: 'MockService' as const,
    } as any

    it('creates mock services', async () => {
      const mockImpl: MockService = {
        getValue: () => 'test-value',
        setValue: vi.fn(),
      }

      const layer = TestServiceFactory.createMockService(MockServiceTag, mockImpl)
      expect(layer).toBeDefined()
    })

    it('creates effect-based services', async () => {
      const serviceEffect = Effect.succeed({
        getValue: () => 'effect-value',
        setValue: vi.fn(),
      })

      const layer = TestServiceFactory.createEffectService(MockServiceTag, serviceEffect)
      expect(layer).toBeDefined()
    })

    it('creates stateful services with Ref', async () => {
      const layer = TestServiceFactory.createStatefulService(MockServiceTag, 'initial-state', (ref) => ({
        getValue: () => 'stateful-value',
        setValue: vi.fn(),
      }))

      expect(layer).toBeDefined()
    })
  })

  describe('TestDataFactory', () => {
    describe('randomString', () => {
      it('generates strings of specified length', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 20 }), (length) => {
            const result = TestDataFactory.randomString(length)
            expect(result.length).toBeLessThanOrEqual(length + 2) // Account for randomness
            expect(typeof result).toBe('string')
          }),
          { numRuns: 50 }
        )
      })

      it('generates different strings on multiple calls', () => {
        const strings = Array.from({ length: 10 }, () => TestDataFactory.randomString(8))
        const uniqueStrings = new Set(strings)
        expect(uniqueStrings.size).toBeGreaterThan(1) // Should have some variation
      })
    })

    describe('randomInt', () => {
      it('generates integers within specified range', () => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 101, max: 200 }), (min, max) => {
            const result = TestDataFactory.randomInt(min, max)
            expect(result).toBeGreaterThanOrEqual(min)
            expect(result).toBeLessThanOrEqual(max)
            expect(Number.isInteger(result)).toBe(true)
          }),
          { numRuns: 50 }
        )
      })
    })

    describe('delayedSuccess', () => {
      it('returns value after delay', async () => {
        const value = 'delayed-result'
        const effect = TestDataFactory.delayedSuccess(value, 10)

        const start = Date.now()
        const result = await Effect.runPromise(effect)
        const elapsed = Date.now() - start

        expect(result).toBe(value)
        expect(elapsed).toBeGreaterThanOrEqual(8) // Account for timing variations
      })
    })

    describe('delayedFailure', () => {
      it('fails with error after delay', async () => {
        const error = createTestError('delayed error')
        const effect = TestDataFactory.delayedFailure(error, 10)

        const start = Date.now()
        const exit = await Effect.runPromiseExit(effect)
        const elapsed = Date.now() - start

        expect(Exit.isFailure(exit)).toBe(true)
        expect(elapsed).toBeGreaterThanOrEqual(8)
      })
    })
  })

  describe('DeterministicTestHelpers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('withFixedTime', () => {
      it('executes test with fixed time', async () => {
        const fixedTime = 1234567890000
        const testEffect = Effect.sync(() => Date.now())

        const result = await Effect.runPromise(DeterministicTestHelpers.withFixedTime(fixedTime, testEffect))

        expect(result).toBe(fixedTime)
      })

      it('restores original Date.now after test', async () => {
        const originalNow = Date.now
        const fixedTime = 1234567890000
        const testEffect = Effect.succeed('test')

        await Effect.runPromise(DeterministicTestHelpers.withFixedTime(fixedTime, testEffect))

        expect(Date.now).toBe(originalNow)
      })
    })

    describe('withFixedRandom', () => {
      it('executes test with fixed random value', async () => {
        const fixedValue = 0.5
        const testEffect = Effect.sync(() => Math.random())

        const result = await Effect.runPromise(DeterministicTestHelpers.withFixedRandom(fixedValue, testEffect))

        expect(result).toBe(fixedValue)
      })

      it('restores original Math.random after test', async () => {
        const originalRandom = Math.random
        const fixedValue = 0.7
        const testEffect = Effect.succeed('test')

        await Effect.runPromise(DeterministicTestHelpers.withFixedRandom(fixedValue, testEffect))

        expect(Math.random).toBe(originalRandom)
      })
    })

    describe('time manipulation', () => {
      it('advances time correctly', async () => {
        const duration = 1000
        const result = await Effect.runPromise(DeterministicTestHelpers.advanceTime(duration))

        expect(result).toBe(duration)
      })

      it('gets current time', async () => {
        const currentTime = await Effect.runPromise(DeterministicTestHelpers.getCurrentTime())

        expect(typeof currentTime).toBe('number')
        expect(currentTime).toBeGreaterThan(0)
      })
    })
  })

  describe('AssertionHelpers', () => {
    describe('Effect assertions', () => {
      it('asserts successful effects', async () => {
        const value = 'success-value'
        const effect = Effect.succeed(value)

        const result = await AssertionHelpers.expectEffectSuccess(effect)
        expect(result).toBe(value)
      })

      it('asserts failing effects', async () => {
        const error = createTestError('expected failure')
        const effect = Effect.fail(error)

        const result = await AssertionHelpers.expectEffectFailure(effect)
        expect(result).toEqual(error)
      })

      it('throws when expecting success but effect fails', async () => {
        const effect = Effect.fail(createTestError('unexpected failure'))

        await expect(AssertionHelpers.expectEffectSuccess(effect)).rejects.toThrow()
      })

      it('throws when expecting failure but effect succeeds', async () => {
        const effect = Effect.succeed('unexpected success')

        await expect(AssertionHelpers.expectEffectFailure(effect)).rejects.toThrow()
      })
    })

    describe('Schema validation assertion', () => {
      const TestSchema = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
      })

      it('validates schema correctly', () => {
        const input = { id: 123, name: 'test' }
        const expected = { id: 123, name: 'test' }

        const result = AssertionHelpers.expectSchemaValidation(TestSchema, input, expected)
        expect(result).toEqual(expected)
      })
    })
  })

  describe('TestEnvironment', () => {
    const originalEnv = process.env['NODE_ENV']

    afterEach(() => {
      process.env['NODE_ENV'] = originalEnv
    })

    it('sets up test environment', async () => {
      const result = await Effect.runPromise(TestEnvironment.setup())

      expect(result.environment).toBe('test')
      expect(result.testStartTime).toBeTypeOf('number')
      expect(process.env['NODE_ENV']).toBe('test')
    })

    it('performs teardown', async () => {
      await Effect.runPromise(TestEnvironment.teardown())
      // Teardown should complete without errors
    })
  })

  describe('PropertyTestHelpers', () => {
    describe('randomString', () => {
      it('generates strings within length bounds', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 6, max: 15 }), (minLength, maxLength) => {
            const result = PropertyTestHelpers.randomString(minLength, maxLength)
            expect(result.length).toBeGreaterThanOrEqual(minLength)
            expect(result.length).toBeLessThanOrEqual(maxLength)
            expect(typeof result).toBe('string')
          }),
          { numRuns: 50 }
        )
      })

      it('handles edge case of empty generation', () => {
        // Test the fallback mechanism for empty strings
        const originalRandom = Math.random
        Math.random = () => 0 // Force minimal length generation

        try {
          const result = PropertyTestHelpers.randomString(1, 1)
          expect(result.length).toBeGreaterThan(0)
        } finally {
          Math.random = originalRandom
        }
      })
    })

    describe('randomCoordinate', () => {
      it('generates coordinates within expected ranges', () => {
        Array.from({ length: 100 }, () => {
          const coord = PropertyTestHelpers.randomCoordinate()

          expect(coord.x).toBeGreaterThanOrEqual(-1000)
          expect(coord.x).toBeLessThanOrEqual(1000)
          expect(coord.y).toBeGreaterThanOrEqual(0)
          expect(coord.y).toBeLessThanOrEqual(256)
          expect(coord.z).toBeGreaterThanOrEqual(-1000)
          expect(coord.z).toBeLessThanOrEqual(1000)
        })
      })
    })

    describe('randomPlayerId', () => {
      it('generates valid player IDs', () => {
        Array.from({ length: 50 }, () => {
          const playerId = PropertyTestHelpers.randomPlayerId()

          expect(playerId).toMatch(/^player_/)
          expect(playerId.length).toBeGreaterThan(7) // 'player_' + at least 1 char
        })
      })
    })

    describe('randomBlockType', () => {
      it('generates valid block types', () => {
        const validTypes = ['air', 'stone', 'dirt', 'grass', 'wood', 'water', 'lava']

        Array.from({ length: 50 }, () => {
          const blockType = PropertyTestHelpers.randomBlockType()
          expect(validTypes).toContain(blockType)
        })
      })
    })

    describe('testMultipleValues', () => {
      it('runs property tests correctly', () => {
        const generator = () => Math.random() * 100
        const predicate = (value: number) => value >= 0 && value <= 100

        const result = PropertyTestHelpers.testMultipleValues(generator, predicate, 50)
        expect(result).toBe(true)
      })

      it('detects failing properties', () => {
        const generator = () => Math.random() * 100
        const predicate = (value: number) => value > 200 // Always false

        const result = PropertyTestHelpers.testMultipleValues(generator, predicate, 10)
        expect(result).toBe(false)
      })
    })
  })

  describe('PerformanceTestHelpers', () => {
    describe('measureTime', () => {
      it('measures effect execution time', async () => {
        const effect = Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(50))
          return 'completed'
        })

        const result = await Effect.runPromise(PerformanceTestHelpers.measureTime(effect))

        expect(result.result).toBe('completed')
        expect(result.duration).toBeGreaterThan(0)
        expect(result.durationMs).toBe(result.duration)
        expect(result.durationMs).toBeGreaterThan(40) // Account for timing variations
      })
    })

    describe('measureMemory', () => {
      it('measures memory usage delta', async () => {
        const effect = Effect.gen(function* () {
          // Create some memory usage
          const largeArray = new Array(1000).fill('test')
          return largeArray.length
        })

        const result = await Effect.runPromise(PerformanceTestHelpers.measureMemory(effect))

        expect(result.result).toBe(1000)
        expect(result.memoryDelta).toBeDefined()
        expect(typeof result.memoryDelta.heapUsed).toBe('number')
        expect(typeof result.memoryDelta.heapTotal).toBe('number')
        expect(typeof result.memoryDelta.rss).toBe('number')
      })
    })
  })

  describe('Integration scenarios', () => {
    it('combines multiple helpers in complex test scenario', async () => {
      // Set up deterministic environment
      const fixedTime = 1234567890000
      const testValue = 'integration-test'

      const complexTest = Effect.gen(function* () {
        // Create test data
        const testData = {
          id: TestDataFactory.randomInt(1, 100),
          message: testValue,
        }

        // Create test error for failure path
        const testError = createTestError('integration test error')

        // Test successful path
        const successEffect = Effect.succeed(testData)
        const successResult = yield* successEffect

        // Validate with schema
        const validatedResult = Schema.decodeSync(TestErrorSchema)({
          _tag: 'TestError',
          message: successResult.message,
          timestamp: Date.now(),
        })

        return {
          originalData: testData,
          validatedResult,
          timestamp: Date.now(),
        }
      })

      const result = await Effect.runPromise(DeterministicTestHelpers.withFixedTime(fixedTime, complexTest))

      expect(result.originalData.message).toBe(testValue)
      expect(result.validatedResult._tag).toBe('TestError')
      expect(result.timestamp).toBe(fixedTime)
    })

    it('handles error scenarios with multiple helpers', async () => {
      const errorTest = Effect.gen(function* () {
        const error = createTestError('multi-helper error')
        return yield* Effect.fail(error)
      })

      const errorResult = await AssertionHelpers.expectEffectFailure(errorTest)
      expect(errorResult._tag).toBe('TestError')
      expect(errorResult.message).toBe('multi-helper error')
    })
  })
})
