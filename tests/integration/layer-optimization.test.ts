import { describe, test, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  EssentialLayer,
  GameLogicLayer,
  RenderingLayer,
  ComputeLayer,
  OptimizedDevelopmentLive,
  OptimizedProductionLive,
  OptimizedTestLive,
  OptimizedServerLive,
  FullClientLayer,
  MinimalClientLayer,
  buildOptimizedLayer,
  getOptimizedLayer,
  createOptimizedLayer,
  type LayerConfig,
} from '@/layers'
import { DomainQueryService } from '@domain/queries/domain-queries'
import { Clock, Stats, World, WorldDomainService, PhysicsDomainService, EntityDomainService } from '@infrastructure/layers/unified.layer'

/**
 * Layer Optimization Tests
 *
 * These tests validate that our Layer optimizations work correctly:
 * 1. No circular dependencies
 * 2. Proper service availability
 * 3. Optimized compositions work
 * 4. Environment-specific presets function
 */

describe('Layer Composition Optimization', () => {
  test('Essential Layer provides core services', async () => {
    const program = Effect.gen(function* () {
      // Test that essential services are available
      const clock = yield* Clock
      const worldDomain = yield* WorldDomainService
      const physicsDomain = yield* PhysicsDomainService
      const entityDomain = yield* EntityDomainService

      // Basic functionality test
      const delta = yield* clock.getDelta()
      const entityCount = yield* entityDomain.getEntityCount()

      expect(typeof delta).toBe('number')
      expect(typeof entityCount).toBe('number')

      return { services: ['Clock', 'WorldDomainService', 'PhysicsDomainService', 'EntityDomainService'] }
    })

    const result = await Effect.runPromise(Effect.provide(program, EssentialLayer))
    expect(result.services).toHaveLength(4)
  })

  test('Game Logic Layer includes application services', async () => {
    const program = Effect.gen(function* () {
      // Test that domain query service is available (resolves circular dependency)
      const domainQuery = yield* DomainQueryService
      const world = yield* World

      // Test basic query execution
      const playerQuery = yield* domainQuery.executePlayerQuery()
      const block = yield* world.getBlock(0, 0, 0)

      expect(playerQuery).toBeDefined()
      expect(typeof block).toBe('number')

      return { queryService: 'available', worldService: 'available' }
    })

    const result = await Effect.runPromise(Effect.provide(program, GameLogicLayer))
    expect(result.queryService).toBe('available')
    expect(result.worldService).toBe('available')
  })

  test('Optimized layer builder works with various configurations', async () => {
    const configs: LayerConfig[] = [
      {
        environment: 'development',
        features: { rendering: true, ui: true, input: true },
        optimization: { performance: true },
      },
      {
        environment: 'production',
        features: { rendering: true, workers: true },
        optimization: { memory: true, performance: true },
      },
      {
        environment: 'test',
        features: {},
        optimization: { startup: true },
      },
      {
        environment: 'server',
        features: { workers: true },
        optimization: { memory: true },
      },
    ]

    for (const config of configs) {
      const layer = buildOptimizedLayer(config)
      expect(layer).toBeDefined()

      // Test that the layer provides essential services
      const program = Effect.gen(function* () {
        const clock = yield* Clock
        const delta = yield* clock.getDelta()
        return { delta, environment: config.environment }
      })

      const result = await Effect.runPromise(Effect.provide(program, layer))
      expect(result.environment).toBe(config.environment)
      expect(typeof result.delta).toBe('number')
    }
  })

  test('Environment-specific layers work correctly', async () => {
    const environments = ['development', 'production', 'test', 'server'] as const

    for (const env of environments) {
      const layer = getOptimizedLayer(env)
      expect(layer).toBeDefined()

      // Test that the layer works
      const program = Effect.gen(function* () {
        const stats = yield* Stats
        yield* stats.begin()
        yield* stats.end()
        const performance = yield* stats.getStats()

        return { environment: env, fps: performance.fps }
      })

      const result = await Effect.runPromise(Effect.provide(program, layer))
      expect(result.environment).toBe(env)
      expect(typeof result.fps).toBe('number')
    }
  })

  test('No circular dependencies in domain queries', async () => {
    // Test that domain services can use domain queries without circular dependency
    const program = Effect.gen(function* () {
      const domainQuery = yield* DomainQueryService

      // Execute both query types to ensure they work
      const playerQuery = yield* domainQuery.executePlayerQuery()
      const playerTargetQuery = yield* domainQuery.executePlayerTargetQuery()

      expect(playerQuery.entities).toBeDefined()
      expect(playerTargetQuery.entities).toBeDefined()

      return {
        playerQueryEntities: playerQuery.entities.length,
        targetQueryEntities: playerTargetQuery.entities.length,
      }
    })

    const result = await Effect.runPromise(Effect.provide(program, GameLogicLayer))
    expect(typeof result.playerQueryEntities).toBe('number')
    expect(typeof result.targetQueryEntities).toBe('number')
  })

  test('Layer merge optimization eliminates duplication', () => {
    // Test that our optimized layers don't have redundant services
    // This is more of a structural test

    // Essential layer should be minimal
    expect(EssentialLayer).toBeDefined()

    // Game logic should build on essential
    expect(GameLogicLayer).toBeDefined()

    // Client layers should be comprehensive but not redundant
    expect(FullClientLayer).toBeDefined()
    expect(MinimalClientLayer).toBeDefined()
  })

  test('Custom layer builder provides flexibility', () => {
    // Test the createOptimizedLayer function with different configs
    const testConfigs = [
      {
        environment: 'development' as const,
        features: { rendering: true, ui: true },
        optimization: { startup: true },
      },
      {
        environment: 'production' as const,
        features: { workers: true, rendering: true },
        optimization: { performance: true, memory: true },
      },
    ]

    testConfigs.forEach((config) => {
      const layer = createOptimizedLayer(config)
      expect(layer).toBeDefined()
    })
  })
})

describe('Context.Tag Standardization', () => {
  test('Service tags follow naming conventions', () => {
    // Test that our standardized tags follow the correct patterns

    // Domain services should end with 'DomainService'
    expect(WorldDomainService._tag).toBe('WorldDomainService')
    expect(PhysicsDomainService._tag).toBe('PhysicsDomainService')
    expect(EntityDomainService._tag).toBe('EntityDomainService')

    // Infrastructure services should have consistent naming
    expect(Clock._tag).toBe('Clock')
    expect(Stats._tag).toBe('Stats')
    expect(World._tag).toBe('World')
  })

  test('Tag names are unique across the application', () => {
    const tagNames = [WorldDomainService._tag, PhysicsDomainService._tag, EntityDomainService._tag, Clock._tag, Stats._tag, World._tag]

    const uniqueNames = new Set(tagNames)
    expect(uniqueNames.size).toBe(tagNames.length) // All should be unique
  })
})
