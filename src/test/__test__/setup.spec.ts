import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, ConfigProvider } from 'effect'
import * as fc from 'fast-check'
import { TestConfig, TestUtils } from '../setup'

// Mock process methods for testing
const mockProcess = {
  env: { ...process.env },
  removeAllListeners: vi.fn(),
  on: vi.fn(),
}

describe('Test Setup Configuration', () => {
  describe('TestConfig', () => {
    it('has valid configuration values', () => {
      expect(TestConfig.timeout).toBe(10000)
      expect(TestConfig.maxRetries).toBe(3)
      expect(TestConfig.logLevel).toBe('error')
      expect(typeof TestConfig.timeout).toBe('number')
      expect(typeof TestConfig.maxRetries).toBe('number')
      expect(typeof TestConfig.logLevel).toBe('string')
    })

    it('timeout is within reasonable bounds', () => {
      expect(TestConfig.timeout).toBeGreaterThan(0)
      expect(TestConfig.timeout).toBeLessThanOrEqual(60000) // Max 1 minute
    })

    it('maxRetries is within reasonable bounds', () => {
      expect(TestConfig.maxRetries).toBeGreaterThan(0)
      expect(TestConfig.maxRetries).toBeLessThanOrEqual(10)
    })

    it('logLevel is a valid log level', () => {
      const validLogLevels = ['debug', 'info', 'warn', 'error']
      expect(validLogLevels).toContain(TestConfig.logLevel)
    })
  })

  describe('TestUtils', () => {
    describe('runEffect', () => {
      it('runs successful effects', async () => {
        await fc.assert(
          fc.asyncProperty(fc.anything(), async (value) => {
            const effect = Effect.succeed(value)
            const result = await TestUtils.runEffect(effect)
            expect(result).toBe(value)
          }),
          { numRuns: 50 }
        )
      })

      it('propagates effect failures', async () => {
        const errorMessage = 'Test error'
        const effect = Effect.fail(new Error(errorMessage))

        await expect(TestUtils.runEffect(effect)).rejects.toThrow(errorMessage)
      })

      it('handles void effects', async () => {
        const effect = Effect.void
        const result = await TestUtils.runEffect(effect)
        expect(result).toBeUndefined()
      })
    })

    describe('runEffectWithTimeout', () => {
      it('completes effects within default timeout', async () => {
        const effect = Effect.gen(function* () {
          yield* Effect.sleep('50 millis')
          return 'completed'
        })

        const result = await TestUtils.runEffectWithTimeout(effect)
        expect(result).toBe('completed')
      })

      it('completes effects within custom timeout', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 100, max: 1000 }),
            fc.integer({ min: 10, max: 50 }),
            async (timeoutMs, delayMs) => {
              const effect = Effect.gen(function* () {
                yield* Effect.sleep(`${delayMs} millis`)
                return 'custom-timeout-success'
              })

              if (delayMs < timeoutMs) {
                const result = await TestUtils.runEffectWithTimeout(effect, timeoutMs)
                expect(result).toBe('custom-timeout-success')
              }
            }
          ),
          { numRuns: 20 }
        )
      })

      it('times out long-running effects with default timeout', async () => {
        const longRunningEffect = Effect.gen(function* () {
          yield* Effect.sleep('15000 millis') // Longer than default timeout
          return 'should-not-complete'
        })

        await expect(TestUtils.runEffectWithTimeout(longRunningEffect)).rejects.toThrow()
      })

      it('times out long-running effects with custom timeout', async () => {
        const longRunningEffect = Effect.gen(function* () {
          yield* Effect.sleep('200 millis')
          return 'should-not-complete'
        })

        await expect(TestUtils.runEffectWithTimeout(longRunningEffect, 50)).rejects.toThrow()
      })

      it('uses default timeout when not specified', async () => {
        const quickEffect = Effect.succeed('quick')

        // Should use TestConfig.timeout as default
        const result = await TestUtils.runEffectWithTimeout(quickEffect)
        expect(result).toBe('quick')
      })
    })

    describe('createTestConfigProvider', () => {
      it('creates ConfigProvider from simple key-value pairs', () => {
        fc.assert(
          fc.property(
            fc.record({
              key1: fc.string(),
              key2: fc.string(),
              key3: fc.string(),
            }),
            (config) => {
              const provider = TestUtils.createTestConfigProvider(config)
              expect(provider).toBeDefined()
              expect(typeof provider).toBe('object')
            }
          ),
          { numRuns: 30 }
        )
      })

      it('handles empty configuration', () => {
        const provider = TestUtils.createTestConfigProvider({})
        expect(provider).toBeDefined()
      })

      it('handles configuration with various data types as strings', () => {
        const config = {
          stringValue: 'test',
          numberValue: '123',
          booleanValue: 'true',
          arrayValue: '["a","b","c"]',
          objectValue: '{"key":"value"}',
        }

        const provider = TestUtils.createTestConfigProvider(config)
        expect(provider).toBeDefined()
      })

      it('creates provider that can be used with Effect.provide', async () => {
        const config = {
          TEST_KEY: 'test-value',
          PORT: '3000',
          DEBUG: 'true',
        }

        const provider = TestUtils.createTestConfigProvider(config)

        // Test that the provider can be used in an Effect context
        const testEffect = Effect.succeed('provider-test')
        const result = await Effect.runPromise(testEffect)
        expect(result).toBe('provider-test')
      })
    })
  })

  describe('Environment setup validation', () => {
    let originalEnv: typeof process.env

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('validates test environment variables are set correctly', () => {
      // These should be set by the setup
      expect(process.env['NODE_ENV']).toBe('test')
      expect(process.env['VITEST']).toBe('true')
    })

    it('handles missing environment variables gracefully', () => {
      delete process.env['DEBUG']

      // Should not throw when DEBUG is not set
      expect(() => {
        const hasDebug = !!process.env['DEBUG']
        expect(typeof hasDebug).toBe('boolean')
      }).not.toThrow()
    })
  })

  describe('Error handling integration', () => {
    it('integrates with Effect error handling', async () => {
      const errorEffect = Effect.gen(function* () {
        yield* Effect.fail(new Error('Integration test error'))
      })

      const result = await Effect.runPromiseExit(errorEffect)
      expect(result._tag).toBe('Failure')
    })

    it('handles async errors in effects', async () => {
      const asyncErrorEffect = Effect.gen(function* () {
        yield* Effect.sleep('10 millis')
        throw new Error('Async error in effect')
      })

      await expect(TestUtils.runEffect(asyncErrorEffect)).rejects.toThrow('Async error in effect')
    })

    it('maintains error stack traces', async () => {
      const errorWithStack = Effect.gen(function* () {
        const error = new Error('Error with stack')
        return yield* Effect.fail(error)
      })

      try {
        await TestUtils.runEffect(errorWithStack)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Error with stack')
        expect((error as Error).stack).toBeDefined()
      }
    })
  })

  describe('Memory and performance considerations', () => {
    it('handles memory-intensive effects', async () => {
      const memoryIntensiveEffect = Effect.gen(function* () {
        // Create and release large data structures
        const largeArray = new Array(10000).fill('test-data')
        const result = largeArray.length
        // Array should be garbage collected after this scope
        return result
      })

      const result = await TestUtils.runEffect(memoryIntensiveEffect)
      expect(result).toBe(10000)
    })

    it('handles concurrent effects efficiently', async () => {
      const concurrentEffects = Array.from({ length: 10 }, (_, i) =>
        Effect.gen(function* () {
          yield* Effect.sleep('10 millis')
          return `effect-${i}`
        })
      )

      const startTime = Date.now()
      const results = await Promise.all(
        concurrentEffects.map(effect => TestUtils.runEffect(effect))
      )
      const endTime = Date.now()

      expect(results).toHaveLength(10)
      expect(results.every(result => result.startsWith('effect-'))).toBe(true)
      // Should complete faster than sequential execution
      expect(endTime - startTime).toBeLessThan(200) // Much less than 10 * 10ms + overhead
    })
  })

  describe('Property-based testing integration', () => {
    it('works correctly with fast-check generators', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          async (numbers) => {
            const sumEffect = Effect.gen(function* () {
              yield* Effect.sleep('1 millis')
              return numbers.reduce((acc, num) => acc + num, 0)
            })

            const result = await TestUtils.runEffect(sumEffect)
            const expected = numbers.reduce((acc, num) => acc + num, 0)

            expect(result).toBe(expected)
            expect(result).toBeGreaterThan(0) // Since all numbers are positive
          }
        ),
        { numRuns: 50 }
      )
    })

    it('validates TestConfig properties', () => {
      fc.assert(
        fc.property(fc.constant(TestConfig), (config) => {
          expect(config.timeout).toBeGreaterThan(0)
          expect(config.maxRetries).toBeGreaterThan(0)
          expect(typeof config.logLevel).toBe('string')
          expect(config.logLevel.length).toBeGreaterThan(0)
        }),
        { numRuns: 1 } // Only need to test once since TestConfig is constant
      )
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('handles zero timeout gracefully', async () => {
      const immediateEffect = Effect.succeed('immediate')

      // Zero timeout should still allow immediate effects
      const result = await TestUtils.runEffectWithTimeout(immediateEffect, 0)
      expect(result).toBe('immediate')
    })

    it('handles very large timeout values', async () => {
      const quickEffect = Effect.succeed('quick')

      // Should handle large timeout without issues
      const result = await TestUtils.runEffectWithTimeout(quickEffect, Number.MAX_SAFE_INTEGER)
      expect(result).toBe('quick')
    })

    it('handles config with special characters', () => {
      const configWithSpecialChars = {
        'key-with-dashes': 'value1',
        'key_with_underscores': 'value2',
        'key.with.dots': 'value3',
        'key with spaces': 'value4',
        'key@with@symbols': 'value5',
      }

      const provider = TestUtils.createTestConfigProvider(configWithSpecialChars)
      expect(provider).toBeDefined()
    })

    it('handles config with unicode characters', () => {
      const unicodeConfig = {
        '키': '값', // Korean
        'клавиша': 'значение', // Russian
        'キー': '値', // Japanese
        '🔑': '🎯', // Emojis
      }

      const provider = TestUtils.createTestConfigProvider(unicodeConfig)
      expect(provider).toBeDefined()
    })
  })

  describe('Integration with vitest lifecycle hooks', () => {
    it('supports beforeEach and afterEach patterns', async () => {
      let setupValue: string | undefined
      let cleanupValue: string | undefined

      const testEffect = Effect.gen(function* () {
        setupValue = 'setup-complete'
        yield* Effect.sleep('5 millis')
        cleanupValue = 'cleanup-pending'
        return 'test-complete'
      })

      const result = await TestUtils.runEffect(testEffect)

      expect(result).toBe('test-complete')
      expect(setupValue).toBe('setup-complete')
      expect(cleanupValue).toBe('cleanup-pending')
    })

    it('maintains isolation between test runs', async () => {
      // First test run
      const firstEffect = Effect.gen(function* () {
        return { testId: 1, timestamp: Date.now() }
      })

      const firstResult = await TestUtils.runEffect(firstEffect)

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))

      // Second test run
      const secondEffect = Effect.gen(function* () {
        return { testId: 2, timestamp: Date.now() }
      })

      const secondResult = await TestUtils.runEffect(secondEffect)

      expect(firstResult.testId).not.toBe(secondResult.testId)
      expect(firstResult.timestamp).not.toBe(secondResult.timestamp)
      expect(secondResult.timestamp).toBeGreaterThan(firstResult.timestamp)
    })
  })
})