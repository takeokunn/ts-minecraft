/**
 * Effect-TS Testing Utilities
 *
 * Provides standardized testing helpers for Effect-based code
 * with proper error handling and type safety
 */

import { Effect, Either, Option, pipe, Layer, Context, Duration } from 'effect'
import { Schema } from '@effect/schema'
import { expect } from 'vitest'

/**
 * Test execution helpers for Effect-based code
 */
export const EffectTestUtils = {
  /**
   * Run an Effect and expect it to succeed
   */
  expectSuccess: async <A, E>(
    effect: Effect.Effect<A, E>,
    timeout: Duration.Duration = Duration.seconds(5)
  ): Promise<A> => {
    const result = await Effect.runPromise(pipe(effect, Effect.timeout(timeout), Effect.either))

    if (Either.isLeft(result)) {
      throw new Error(`Expected success but got error: ${String(result.left)}`)
    }

    return result.right
  },

  /**
   * Run an Effect and expect it to fail with specific error type
   */
  expectFailure: async <A, E>(
    effect: Effect.Effect<A, E>,
    errorMatcher?: (error: E) => boolean,
    timeout: Duration.Duration = Duration.seconds(5)
  ): Promise<E> => {
    const result = await Effect.runPromise(pipe(effect, Effect.timeout(timeout), Effect.either))

    if (Either.isRight(result)) {
      throw new Error(`Expected failure but got success: ${String(result.right)}`)
    }

    const error = result.left as E
    if (errorMatcher && !errorMatcher(error)) {
      throw new Error(`Error did not match expected pattern: ${String(error)}`)
    }

    return error
  },

  /**
   * Test schema validation with Effect
   */
  expectSchemaSuccess: async <I, A>(schema: Schema.Schema<A, I>, input: I): Promise<A> => {
    return EffectTestUtils.expectSuccess(Schema.decodeUnknown(schema)(input))
  },

  /**
   * Test schema validation failure
   */
  expectSchemaFailure: async <I, A>(schema: Schema.Schema<A, I>, input: unknown): Promise<any> => {
    return EffectTestUtils.expectFailure(Schema.decodeUnknown(schema)(input))
  },

  /**
   * Create a test layer for dependency injection
   */
  createTestLayer: <R, E, A>(tag: Context.Tag<R, A>, implementation: A): Layer.Layer<R, E, never> => {
    return Layer.succeed(tag, implementation)
  },

  /**
   * Run Effect with test dependencies
   */
  runWithTestDeps: async <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    testLayer: Layer.Layer<R, E, never>,
    timeout: Duration.Duration = Duration.seconds(5)
  ): Promise<A> => {
    return Effect.runPromise(pipe(effect, Effect.provide(testLayer), Effect.timeout(timeout)))
  },

  /**
   * Assert Option is Some with expected value
   */
  expectSome: <A>(option: Option.Option<A>, expectedValue?: A): A => {
    if (Option.isNone(option)) {
      throw new Error('Expected Some but got None')
    }

    if (expectedValue !== undefined) {
      expect(option.value).toEqual(expectedValue)
    }

    return option.value
  },

  /**
   * Assert Option is None
   */
  expectNone: <A>(option: Option.Option<A>): void => {
    if (Option.isSome(option)) {
      throw new Error(`Expected None but got Some: ${String(option.value)}`)
    }
  },

  /**
   * Create mock service implementation
   */
  createMockService: <T>(
    serviceTag: Context.Tag<any, T>,
    mockImplementation: Partial<T>
  ): Layer.Layer<any, never, never> => {
    return Layer.succeed(serviceTag, mockImplementation as T)
  },

  /**
   * Performance testing helper
   */
  measurePerformance: async <A, E>(
    effect: Effect.Effect<A, E>,
    maxDuration: Duration.Duration = Duration.seconds(1)
  ): Promise<{ result: A; duration: Duration.Duration }> => {
    const start = Date.now()
    const result = await EffectTestUtils.expectSuccess(effect)
    const end = Date.now()
    const duration = Duration.millis(end - start)

    if (Duration.greaterThan(duration, maxDuration)) {
      throw new Error(
        `Operation took ${Duration.toMillis(duration)}ms, expected max ${Duration.toMillis(maxDuration)}ms`
      )
    }

    return { result, duration }
  },

  /**
   * Batch testing helper for multiple scenarios
   */
  testScenarios: async <A, E>(
    scenarios: Array<{
      name: string
      effect: Effect.Effect<A, E>
      expectSuccess?: boolean
      errorMatcher?: (error: E) => boolean
    }>
  ): Promise<void> => {
    for (const scenario of scenarios) {
      try {
        if (scenario.expectSuccess !== false) {
          await EffectTestUtils.expectSuccess(scenario.effect)
        } else {
          await EffectTestUtils.expectFailure(scenario.effect, scenario.errorMatcher)
        }
      } catch (error) {
        throw new Error(`Scenario '${scenario.name}' failed: ${String(error)}`)
      }
    }
  },
}

/**
 * Property-based testing helpers for Schema validation
 */
export const PropertyTestUtils = {
  /**
   * Generate test cases for schema validation
   */
  generateValidationTests: <I, A>(schema: Schema.Schema<A, I>, validInputs: I[], invalidInputs: unknown[]) => ({
    testValid: async () => {
      for (const input of validInputs) {
        await EffectTestUtils.expectSchemaSuccess(schema, input)
      }
    },
    testInvalid: async () => {
      for (const input of invalidInputs) {
        await EffectTestUtils.expectSchemaFailure(schema, input)
      }
    },
  }),

  /**
   * Test Brand type creation and validation
   */
  testBrandType: async <T>(schema: Schema.Schema<T, unknown>, validValues: unknown[], invalidValues: unknown[]) => {
    // Test valid values
    for (const value of validValues) {
      const result = await EffectTestUtils.expectSchemaSuccess(schema, value)
      expect(result).toBeDefined()
    }

    // Test invalid values
    for (const value of invalidValues) {
      await EffectTestUtils.expectSchemaFailure(schema, value)
    }
  },
}

/**
 * Integration testing helpers
 */
export const IntegrationTestUtils = {
  /**
   * Test service integration with proper dependency injection
   */
  testServiceIntegration: async <ServiceType, Dependencies = never>(
    serviceTag: Context.Tag<any, ServiceType>,
    dependencies: Layer.Layer<Dependencies, never, never>,
    testEffect: (service: ServiceType) => Effect.Effect<void, any, Exclude<any, Dependencies>>
  ): Promise<void> => {
    await Effect.runPromise(
      pipe(serviceTag, Effect.flatMap(testEffect), Effect.provide(dependencies)) as Effect.Effect<void, any, never>
    )
  },

  /**
   * Test complex workflow with multiple services
   */
  testWorkflow: async <R, E>(
    workflow: Effect.Effect<void, E, R>,
    testLayers: Layer.Layer<R, E, never>
  ): Promise<void> => {
    await Effect.runPromise(pipe(workflow, Effect.provide(testLayers)))
  },
}

/**
 * Error testing utilities
 */
export const ErrorTestUtils = {
  /**
   * Test error serialization and deserialization
   */
  testErrorSerialization: async <E>(errorSchema: Schema.Schema<E>, error: E): Promise<void> => {
    // Serialize to JSON
    const serialized = JSON.stringify(error)
    expect(serialized).toBeDefined()

    // Deserialize and validate
    const parsed = JSON.parse(serialized)
    const result = await EffectTestUtils.expectSchemaSuccess(errorSchema, parsed)
    expect(result).toEqual(error)
  },

  /**
   * Test error hierarchy and type guards
   */
  testErrorTypeGuards: <E>(errors: E[], typeGuard: (error: unknown) => error is E): void => {
    for (const error of errors) {
      expect(typeGuard(error)).toBe(true)
      expect(typeGuard(null)).toBe(false)
      expect(typeGuard(undefined)).toBe(false)
      expect(typeGuard({})).toBe(false)
      expect(typeGuard('string')).toBe(false)
    }
  },
}
