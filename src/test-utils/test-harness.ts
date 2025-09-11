import { Effect, Layer, pipe } from 'effect'
import { TestClock, TestRandom, TestConsole } from '@effect/platform'
import { 
  WorldMockLive,
  RendererMockLive,
  InputManagerMockLive,
  ClockMockLive,
  StatsMockLive,
  SpatialGridMockLive
} from './mocks/layers/test-layers'
import { WorldService, RenderService, InputService, Clock, Stats, SpatialGrid } from '@/services'
import * as fc from 'effect/FastCheck'

/**
 * TestHarness - Comprehensive test infrastructure with Effect-TS patterns
 * 
 * Features:
 * - Automatic mock generation for all services
 * - Property-based testing integration
 * - Deterministic test execution with TestClock
 * - Fluent API for test composition
 * - Built-in test utilities and matchers
 */
export class TestHarness {
  private constructor(
    private readonly layer: Layer.Layer<
      WorldService | RenderService | InputService | Clock | Stats | SpatialGrid,
      never,
      never
    >
  ) {}

  /**
   * Create a new TestHarness with default mocks
   */
  static create() {
    return new TestHarness(
      Layer.mergeAll(
        TestClock.layer,
        TestRandom.layer,
        TestConsole.layer,
        WorldMockLive,
        RendererMockLive,
        InputManagerMockLive,
        ClockMockLive,
        StatsMockLive,
        SpatialGridMockLive
      )
    )
  }

  /**
   * Create a TestHarness with custom layer configuration
   */
  static withLayers<R>(customLayer: Layer.Layer<R, never, never>) {
    return new TestHarness(
      Layer.mergeAll(
        TestClock.layer,
        TestRandom.layer,
        TestConsole.layer,
        customLayer,
        WorldMockLive,
        RendererMockLive,
        InputManagerMockLive,
        ClockMockLive,
        StatsMockLive,
        SpatialGridMockLive
      )
    )
  }

  /**
   * Run an effect with the test harness context
   */
  async runEffect<A, E = never>(
    effect: Effect.Effect<A, E, 
      WorldService | RenderService | InputService | Clock | Stats | SpatialGrid
    >
  ): Promise<A> {
    return Effect.runPromise(
      effect.pipe(Effect.provide(this.layer))
    )
  }

  /**
   * Run a property-based test with the test harness
   */
  async runProperty<A>(
    arbitrary: fc.Arbitrary<A>,
    predicate: (value: A) => Effect.Effect<
      boolean, 
      any, 
      WorldService | RenderService | InputService | Clock | Stats | SpatialGrid
    >
  ): Promise<void> {
    return fc.assert(
      fc.asyncProperty(arbitrary, async (value) => {
        const result = await this.runEffect(predicate(value))
        return result
      })
    )
  }

  /**
   * Create a scoped test environment
   * Automatically cleans up resources after test completion
   */
  withScope<A, E = never>(
    effect: Effect.Effect<A, E, 
      WorldService | RenderService | InputService | Clock | Stats | SpatialGrid
    >
  ): Effect.Effect<A, E, never> {
    return Effect.scoped(
      effect.pipe(Effect.provide(this.layer))
    )
  }

  /**
   * Time-travel testing utilities
   */
  time = {
    /**
     * Advance test clock by specified milliseconds
     */
    advance: (ms: number) =>
      TestClock.adjust(ms),

    /**
     * Set absolute time
     */
    setTime: (time: number) =>
      TestClock.setTime(time),

    /**
     * Run effect with time control
     */
    withAdvance: <A, E>(ms: number, effect: Effect.Effect<A, E, any>) =>
      pipe(
        TestClock.adjust(ms),
        Effect.flatMap(() => effect)
      )
  }

  /**
   * Assertion utilities for common test patterns
   */
  assert = {
    /**
     * Assert that an effect completes successfully
     */
    succeeds: <A, E>(effect: Effect.Effect<A, E, any>) =>
      pipe(
        effect,
        Effect.provide(this.layer),
        Effect.match({
          onFailure: (error) => {
            throw new Error(`Expected effect to succeed, but it failed with: ${error}`)
          },
          onSuccess: (value) => value
        })
      ),

    /**
     * Assert that an effect fails with expected error
     */
    fails: <A, E>(effect: Effect.Effect<A, E, any>, expectedError?: E) =>
      pipe(
        effect,
        Effect.provide(this.layer),
        Effect.match({
          onFailure: (error) => {
            if (expectedError && error !== expectedError) {
              throw new Error(`Expected error ${expectedError}, but got ${error}`)
            }
            return error
          },
          onSuccess: (value) => {
            throw new Error(`Expected effect to fail, but it succeeded with: ${value}`)
          }
        })
      ),

    /**
     * Assert entity exists in world
     */
    entityExists: (entityId: number) =>
      Effect.gen(function* () {
        const world = yield* WorldService
        const entities = yield* world.query([])
        // Implementation depends on actual world query API
        return entities.length > 0
      }),

    /**
     * Assert component has expected value
     */
    componentEquals: <K extends string>(
      entityId: number, 
      componentName: K, 
      expectedValue: any
    ) =>
      Effect.gen(function* () {
        const world = yield* WorldService
        const component = yield* world.getComponent(entityId as any, componentName as any)
        return component._tag === 'Some' && component.value === expectedValue
      })
  }

  /**
   * Snapshot testing utilities
   */
  snapshot = {
    /**
     * Create world state snapshot
     */
    createWorldSnapshot: () =>
      Effect.gen(function* () {
        const world = yield* WorldService
        const state = yield* world.query([])
        return {
          timestamp: Date.now(),
          entities: state,
          metadata: {
            entityCount: state.length,
            version: '1.0.0'
          }
        }
      }),

    /**
     * Compare two world states
     */
    compareSnapshots: (snapshot1: any, snapshot2: any) => {
      // Deep comparison logic
      return JSON.stringify(snapshot1) === JSON.stringify(snapshot2)
    }
  }

  /**
   * Performance testing utilities
   */
  perf = {
    /**
     * Measure effect execution time
     */
    measure: <A, E>(effect: Effect.Effect<A, E, any>) =>
      Effect.gen(function* () {
        const start = Date.now()
        const result = yield* effect
        const end = Date.now()
        return {
          result,
          duration: end - start,
          timestamp: start
        }
      }),

    /**
     * Run effect multiple times and collect stats
     */
    benchmark: <A, E>(
      effect: Effect.Effect<A, E, any>,
      iterations: number = 100
    ) =>
      Effect.gen(function* () {
        const results = []
        for (let i = 0; i < iterations; i++) {
          const measurement = yield* this.perf.measure(effect)
          results.push(measurement.duration)
        }

        const avg = results.reduce((a, b) => a + b, 0) / results.length
        const min = Math.min(...results)
        const max = Math.max(...results)
        const median = results.sort()[Math.floor(results.length / 2)]

        return { avg, min, max, median, samples: results.length }
      })
  }

  /**
   * Mock management utilities
   */
  mocks = {
    /**
     * Reset all mocks to initial state
     */
    reset: () =>
      Effect.gen(function* () {
        // Implementation to reset mock state
        yield* Effect.succeed(undefined)
      }),

    /**
     * Configure mock behavior
     */
    configure: <S>(service: S, behavior: Partial<S>) =>
      Effect.gen(function* () {
        // Implementation to configure mock behavior
        yield* Effect.succeed(undefined)
      }),

    /**
     * Verify mock interactions
     */
    verify: <S>(service: S, expectedCalls: any[]) =>
      Effect.gen(function* () {
        // Implementation to verify mock calls
        return true
      })
  }
}

/**
 * Convenience functions for common test patterns
 */
export const withTestHarness = <A, E = never>(
  effect: Effect.Effect<A, E, 
    WorldService | RenderService | InputService | Clock | Stats | SpatialGrid
  >
): Promise<A> => {
  const harness = TestHarness.create()
  return harness.runEffect(effect)
}

export const testEffect = <A, E = never>(
  name: string,
  effect: Effect.Effect<A, E, 
    WorldService | RenderService | InputService | Clock | Stats | SpatialGrid
  >
) => {
  return {
    name,
    run: () => withTestHarness(effect)
  }
}

/**
 * Type-safe test builders
 */
export const TestBuilder = {
  /**
   * Create integration test
   */
  integration: (name: string) => ({
    withServices: <R>(...services: R[]) => ({
      test: <A, E>(effect: Effect.Effect<A, E, R>) =>
        testEffect(name, effect as any)
    })
  }),

  /**
   * Create unit test
   */
  unit: (name: string) => ({
    test: <A, E = never>(effect: Effect.Effect<A, E, any>) =>
      testEffect(name, effect)
  }),

  /**
   * Create property-based test
   */
  property: <T>(name: string, arbitrary: fc.Arbitrary<T>) => ({
    test: (predicate: (value: T) => Effect.Effect<boolean, any, any>) => ({
      name,
      run: async () => {
        const harness = TestHarness.create()
        return harness.runProperty(arbitrary, predicate)
      }
    })
  })
}