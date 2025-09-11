/**
 * Test Utils - Comprehensive Testing Infrastructure
 * 
 * This module provides a complete testing toolkit for the TypeScript Minecraft project,
 * including property-based testing, mocking, fixtures, builders, and test harness.
 * 
 * ## Architecture
 * 
 * The test infrastructure is built around Effect-TS patterns and includes:
 * - TestHarness: Central orchestration with Layer pattern
 * - MockGenerator: Automatic service mocking with call tracking
 * - Builders: Fluent APIs for test data construction
 * - Fixtures: Predefined test data scenarios
 * - Arbitraries: Property-based testing generators
 * 
 * ## Usage
 * 
 * ```typescript
 * import { TestHarness, entityBuilder, PlayerFixtures } from '@/test-utils'
 * import { it } from '@effect/vitest'
 * 
 * it.effect('should handle player movement', () => {
 *   const harness = TestHarness.create()
 *   const player = pipe(
 *     entityBuilder.create(),
 *     entityBuilder.withPosition(0, 64, 0),
 *     entityBuilder.asPlayer(),
 *     entityBuilder.build
 *   )
 *   
 *   return harness.runEffect(
 *     Effect.gen(function* () {
 *       const world = yield* World
 *       yield* world.addArchetype(player)
 *       // Test logic here
 *     })
 *   )
 * })
 * ```
 */

// Core test infrastructure
export { TestHarness, withTestHarness, testEffect, TestBuilder } from './test-harness'

// Mock system
export { 
  MockFactory, 
  MockService, 
  MockSpy, 
  MockAssert,
  MockConfigs,
  createMockLayer
} from './mocks/mock-generator'

export { 
  WorldMockLive,
  RendererMockLive,
  InputManagerMockLive,
  ClockMockLive,
  StatsMockLive,
  SpatialGridMockLive
} from './mocks/layers/test-layers'

// Builders
export { entityBuilder, presets } from './builders/entity.builder'
export { worldBuilder } from './builders/world.builder'
export { 
  componentBuilder,
  PositionBuilder,
  VelocityBuilder,
  PlayerBuilder,
  InputStateBuilder,
  CameraStateBuilder,
  HotbarBuilder,
  ColliderBuilder,
  RenderableBuilder,
  TargetBuilder,
  ComponentComposer
} from './builders/component.builder'
export { 
  scenarioBuilder, 
  ScenarioTemplates, 
  ScenarioValidator 
} from './builders/scenario.builder'

// Fixtures
export { 
  PlayerFixtures,
  BlockFixtures,
  CameraFixtures,
  ChunkFixtures,
  ScenarioFixtures,
  EdgeCaseFixtures,
  PerformanceFixtures,
  FixtureUtils
} from './fixtures/entity-fixtures'

export {
  BasicWorlds,
  ScenarioWorlds,
  EdgeCaseWorlds,
  PerformanceWorlds,
  FixtureUtils as WorldFixtureUtils
} from './fixtures/world-fixtures'

// Arbitraries (Property-based testing)
export * from './arbitraries/arbitraries'
export * from './arbitraries/enhanced-arbitraries'

// Setup utilities
export { testReversibility } from './setup/test-utils'

/**
 * Common test patterns and utilities
 */
export const TestPatterns = {
  /**
   * Standard player-in-world test setup
   */
  playerInWorld: () => {
    const harness = TestHarness.create()
    const world = pipe(
      worldBuilder.create(),
      worldBuilder.withPlayer({ x: 0, y: 64, z: 0 }),
      worldBuilder.withBlockGrid({ x: -2, y: 63, z: -2 }, 5, 5, 'STONE')
    )
    
    return {
      harness,
      world,
      runTest: <T>(effect: any) => harness.runEffect(
        Effect.gen(function* () {
          yield* worldBuilder.build(world)
          return yield* effect
        })
      )
    }
  },

  /**
   * Mock service integration test
   */
  withMockedServices: (...serviceNames: string[]) => {
    const harness = TestHarness.create()
    
    // Configure specific service mocks if needed
    serviceNames.forEach(serviceName => {
      const config = (MockConfigs as any)[serviceName]
      if (config) {
        MockFactory.forService(serviceName, Object.keys(config))
          .reset()
      }
    })

    return {
      harness,
      runTest: <T>(effect: any) => harness.runEffect(effect),
      verifyMock: (serviceName: string, method: string, times?: number) => {
        const mock = MockFactory.forService(serviceName, [])
        MockAssert.wasCalled(mock, method as any, times)
      }
    }
  },

  /**
   * Property-based test with custom generator
   */
  propertyTest: <T>(
    arbitrary: any,
    testName: string = 'property test'
  ) => {
    const harness = TestHarness.create()
    
    return {
      assert: (predicate: (value: T) => any) => 
        harness.runProperty(arbitrary, predicate),
      
      withSetup: (setupEffect: any) => ({
        assert: (predicate: (value: T) => any) =>
          harness.runProperty(arbitrary, (value: T) =>
            Effect.gen(function* () {
              yield* setupEffect
              return yield* predicate(value)
            })
          )
      })
    }
  },

  /**
   * Performance benchmark test
   */
  benchmarkTest: (
    testName: string,
    iterations: number = 100
  ) => {
    const harness = TestHarness.create()
    
    return {
      measure: <T>(effect: any) => 
        harness.perf.benchmark(effect, iterations),
      
      expectMaxDuration: (maxMs: number) => <T>(effect: any) =>
        Effect.gen(function* () {
          const results = yield* harness.perf.benchmark(effect, iterations)
          if (results.avg > maxMs) {
            throw new Error(`Performance test failed: average ${results.avg}ms exceeds limit ${maxMs}ms`)
          }
          return results
        })
    }
  },

  /**
   * Time-travel test with clock control
   */
  timeBasedTest: () => {
    const harness = TestHarness.create()
    
    return {
      harness,
      advance: (ms: number) => harness.time.advance(ms),
      setTime: (time: number) => harness.time.setTime(time),
      runOverTime: <T>(effect: any, duration: number, steps: number = 10) =>
        Effect.gen(function* () {
          const stepDuration = duration / steps
          const results = []
          
          for (let i = 0; i < steps; i++) {
            yield* harness.time.advance(stepDuration)
            const result = yield* effect
            results.push(result)
          }
          
          return results
        })
    }
  }
}

/**
 * Type utilities for test assertions
 */
export const TestTypes = {
  /**
   * Assert that a type has specific properties
   */
  assertHasProperties: <T, K extends keyof T>(
    obj: T,
    ...keys: K[]
  ): obj is T & Record<K, NonNullable<T[K]>> => {
    return keys.every(key => obj[key] != null)
  },

  /**
   * Type-safe component checker
   */
  hasComponent: <C extends string>(
    entity: any,
    componentName: C
  ): entity is { components: Record<C, any> } => {
    return entity?.components?.[componentName] != null
  },

  /**
   * Safe archetype validator
   */
  isValidArchetype: (obj: any): obj is { components: Record<string, any> } => {
    return obj != null && 
           typeof obj === 'object' && 
           'components' in obj &&
           typeof obj.components === 'object'
  }
}

/**
 * Test assertion helpers
 */
export const TestAssert = {
  /**
   * Assert entity has expected components
   */
  hasComponents: (entity: any, ...componentNames: string[]) => {
    if (!TestTypes.isValidArchetype(entity)) {
      throw new Error('Entity is not a valid archetype')
    }
    
    const missing = componentNames.filter(name => 
      !(name in entity.components)
    )
    
    if (missing.length > 0) {
      throw new Error(`Entity missing components: ${missing.join(', ')}`)
    }
  },

  /**
   * Assert position is within bounds
   */
  positionInBounds: (
    position: { x: number; y: number; z: number },
    bounds: {
      minX: number; maxX: number;
      minY: number; maxY: number;
      minZ: number; maxZ: number;
    }
  ) => {
    if (position.x < bounds.minX || position.x > bounds.maxX ||
        position.y < bounds.minY || position.y > bounds.maxY ||
        position.z < bounds.minZ || position.z > bounds.maxZ) {
      throw new Error(
        `Position (${position.x}, ${position.y}, ${position.z}) is outside bounds ` +
        `(${bounds.minX}-${bounds.maxX}, ${bounds.minY}-${bounds.maxY}, ${bounds.minZ}-${bounds.maxZ})`
      )
    }
  },

  /**
   * Assert approximately equal for floating point
   */
  approximately: (actual: number, expected: number, tolerance: number = 0.001) => {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${actual} to be approximately ${expected} (tolerance: ${tolerance})`)
    }
  },

  /**
   * Assert array contains expected values
   */
  arrayContains: <T>(array: T[], ...values: T[]) => {
    const missing = values.filter(value => !array.includes(value))
    if (missing.length > 0) {
      throw new Error(`Array missing values: ${missing.join(', ')}`)
    }
  }
}

/**
 * Quick test helpers for common scenarios
 */
export const QuickTest = {
  /**
   * Test entity creation and validation
   */
  entity: <T extends { components: any }>(
    builder: () => T,
    ...expectedComponents: string[]
  ) => {
    const entity = builder()
    TestAssert.hasComponents(entity, ...expectedComponents)
    return entity
  },

  /**
   * Test world state modification
   */
  worldState: <T>(
    initialState: () => T,
    modifications: Array<(state: T) => T>,
    validator: (state: T) => void
  ) => {
    let state = initialState()
    
    for (const modification of modifications) {
      state = modification(state)
    }
    
    validator(state)
    return state
  },

  /**
   * Test effect execution with automatic cleanup
   */
  effect: <T, E, R>(
    effect: any,
    setup?: () => any
  ) => {
    const harness = TestHarness.create()
    
    return harness.runEffect(
      Effect.gen(function* () {
        if (setup) yield* setup()
        return yield* effect
      })
    )
  }
}

/**
 * Development utilities for test debugging
 */
export const DebugUtils = {
  /**
   * Pretty print entity structure
   */
  printEntity: (entity: any) => {
    console.log('Entity:', JSON.stringify(entity, null, 2))
  },

  /**
   * Trace effect execution
   */
  traceEffect: <T, E, R>(effect: any, label: string = 'Effect') => {
    return Effect.gen(function* () {
      console.log(`[${label}] Starting`)
      const start = Date.now()
      const result = yield* effect
      const duration = Date.now() - start
      console.log(`[${label}] Completed in ${duration}ms`)
      return result
    })
  },

  /**
   * Mock call inspector
   */
  inspectMockCalls: (serviceName: string, methodName?: string) => {
    const mock = MockFactory.forService(serviceName, [])
    const calls = methodName ? mock.getCalls(methodName as any) : mock.getCalls()
    console.table(calls)
    return calls
  }
}

// Helper function for pipe operations (internal use)
function pipe<A>(value: A): A
function pipe<A, B>(value: A, fn1: (a: A) => B): B
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D
function pipe<A, B, C, D, E>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E): E
function pipe(value: any, ...fns: Array<(a: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}

// Re-export Effect utilities commonly used in tests
export { Effect, pipe } from 'effect'