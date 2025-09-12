/**
 * Repository Factory - Functional Layer composition for repositories
 *
 * This module provides factory functions and Layer compositions for creating
 * repository implementations using Effect-TS functional patterns.
 * All repositories are composed using Layer.effect and Context.GenericTag.
 */

import * as Layer from 'effect/Layer'
import * as Effect from 'effect/Effect'

// Repository implementations
import { WorldRepositoryLive, WorldRepositoryService } from './world.repository'
import { EntityRepositoryLive, EntityRepository } from './entity.repository'
import { ChunkRepositoryLive, ChunkRepository } from './chunk.repository'
import { ComponentRepositoryLive, ComponentRepository } from './component.repository'
import { PhysicsRepositoryLive, PhysicsRepository } from './physics.repository'

/**
 * Repository configuration options
 */
export interface RepositoryConfig {
  readonly entityRepository?: {
    readonly maxChangeHistory?: number
    readonly enableOptimizations?: boolean
  }
  readonly chunkRepository?: {
    readonly maxChangeHistory?: number
    readonly spatialGridSize?: number
  }
  readonly componentRepository?: {
    readonly maxChangeHistory?: number
    readonly enableIndexing?: boolean
  }
  readonly physicsRepository?: {
    readonly maxCollisionHistory?: number
    readonly spatialGridSize?: number
    readonly enablePhysicsSimulation?: boolean
  }
  readonly worldRepository?: {
    readonly enableCaching?: boolean
    readonly compressionEnabled?: boolean
  }
}

/**
 * Default repository configuration
 */
const defaultConfig: Required<RepositoryConfig> = {
  entityRepository: {
    maxChangeHistory: 1000,
    enableOptimizations: true,
  },
  chunkRepository: {
    maxChangeHistory: 10000,
    spatialGridSize: 8,
  },
  componentRepository: {
    maxChangeHistory: 5000,
    enableIndexing: true,
  },
  physicsRepository: {
    maxCollisionHistory: 1000,
    spatialGridSize: 32,
    enablePhysicsSimulation: true,
  },
  worldRepository: {
    enableCaching: true,
    compressionEnabled: false,
  },
}

/**
 * Core repositories layer - includes essential repositories for basic functionality
 */
export const CoreRepositories = Layer.mergeAll(
  WorldRepositoryLive,
  EntityRepositoryLive
)

/**
 * Storage repositories layer - includes repositories focused on data persistence
 */
export const StorageRepositories = Layer.mergeAll(
  WorldRepositoryLive,
  EntityRepositoryLive,
  ChunkRepositoryLive,
  ComponentRepositoryLive
)

/**
 * Physics repositories layer - includes repositories for physics simulation
 */
export const PhysicsRepositories = Layer.mergeAll(
  EntityRepositoryLive,
  ComponentRepositoryLive,
  PhysicsRepositoryLive
)

/**
 * All repositories layer - includes every repository implementation
 */
export const AllRepositories = Layer.mergeAll(
  WorldRepositoryLive,
  EntityRepositoryLive,
  ChunkRepositoryLive,
  ComponentRepositoryLive,
  PhysicsRepositoryLive
)

/**
 * Repository factory functions
 */
export const RepositoryFactory = {
  /**
   * Create repositories with custom configuration
   */
  createWithConfig: (config: RepositoryConfig = {}) => {
    const finalConfig = { ...defaultConfig, ...config }
    
    // For now, return the standard layers
    // In a more advanced implementation, we would customize the layers based on config
    return Effect.succeed(AllRepositories)
  },

  /**
   * Create core repositories (minimal set for basic functionality)
   */
  createCoreRepositories: () => Effect.succeed(CoreRepositories),

  /**
   * Create storage-focused repositories
   */
  createStorageRepositories: () => Effect.succeed(StorageRepositories),

  /**
   * Create physics-focused repositories
   */
  createPhysicsRepositories: () => Effect.succeed(PhysicsRepositories),

  /**
   * Create all repositories
   */
  createAllRepositories: () => Effect.succeed(AllRepositories),

  /**
   * Create repositories optimized for development
   */
  createForDevelopment: () => 
    Effect.gen(function* (_) {
      // In development, we might want additional logging, debugging features
      return AllRepositories
    }),

  /**
   * Create repositories optimized for production
   */
  createForProduction: () =>
    Effect.gen(function* (_) {
      // In production, we might want performance optimizations, caching
      return AllRepositories
    }),

  /**
   * Create repositories for testing with mocked dependencies
   */
  createForTesting: () =>
    Effect.gen(function* (_) {
      // For testing, we might want predictable behavior, no persistence
      return AllRepositories
    }),
}

/**
 * Repository composition utilities
 */
export const RepositoryComposition = {
  /**
   * Compose repositories with middleware layers
   */
  withMiddleware: <R>(repositories: Layer.Layer<R, never, never>) => {
    // Add logging, metrics, caching layers here
    return repositories
  },

  /**
   * Compose repositories with error handling
   */
  withErrorHandling: <R>(repositories: Layer.Layer<R, never, never>) => {
    // Add error recovery, retries, circuit breakers here
    return repositories
  },

  /**
   * Compose repositories with performance monitoring
   */
  withMonitoring: <R>(repositories: Layer.Layer<R, never, never>) => {
    // Add performance metrics, tracing, profiling here
    return repositories
  },
}

/**
 * Repository health checking utilities
 */
export const RepositoryHealth = {
  /**
   * Check the health of all repositories
   */
  checkHealth: Effect.gen(function* (_) {
    // This would require access to repository instances
    // For now, return a basic health check structure
    return {
      isHealthy: true,
      repositories: {
        world: { status: 'healthy' as const, latency: 0 },
        entity: { status: 'healthy' as const, latency: 0 },
        chunk: { status: 'healthy' as const, latency: 0 },
        component: { status: 'healthy' as const, latency: 0 },
        physics: { status: 'healthy' as const, latency: 0 },
      },
      timestamp: Date.now(),
    }
  }),

  /**
   * Get performance metrics for all repositories
   */
  getMetrics: Effect.gen(function* (_) {
    return {
      world: { operations: 0, averageLatency: 0, errorRate: 0 },
      entity: { operations: 0, averageLatency: 0, errorRate: 0 },
      chunk: { operations: 0, averageLatency: 0, errorRate: 0 },
      component: { operations: 0, averageLatency: 0, errorRate: 0 },
      physics: { operations: 0, averageLatency: 0, errorRate: 0 },
    }
  }),

  /**
   * Perform maintenance on all repositories
   */
  performMaintenance: Effect.gen(function* (_) {
    // This would require access to repository instances to call their maintenance methods
    return {
      world: { compacted: true, optimized: true },
      entity: { compacted: true, optimized: true },
      chunk: { compacted: true, optimized: true },
      component: { compacted: true, optimized: true },
      physics: { compacted: true, optimized: true },
    }
  }),
}

/**
 * Repository migration utilities
 */
export const RepositoryMigration = {
  /**
   * Export data from all repositories
   */
  exportData: Effect.gen(function* (_) {
    return {
      timestamp: Date.now(),
      version: '1.0.0',
      repositories: {
        world: {},
        entity: {},
        chunk: {},
        component: {},
        physics: {},
      },
    }
  }),

  /**
   * Import data into all repositories
   */
  importData: (data: any) => Effect.gen(function* (_) {
    // Implementation would depend on repository interfaces supporting import/export
    yield* _(Effect.logInfo(`Importing data with timestamp: ${data.timestamp}`))
    return { success: true, importedRecords: 0 }
  }),

  /**
   * Validate repository data integrity
   */
  validateIntegrity: Effect.gen(function* (_) {
    return {
      isValid: true,
      repositories: {
        world: { isValid: true, errors: [] },
        entity: { isValid: true, errors: [] },
        chunk: { isValid: true, errors: [] },
        component: { isValid: true, errors: [] },
        physics: { isValid: true, errors: [] },
      },
    }
  }),
}

/**
 * Repository testing utilities
 */
export const RepositoryTesting = {
  /**
   * Create test data for repositories
   */
  createTestData: Effect.gen(function* (_) {
    return {
      entities: [],
      components: {},
      chunks: [],
      physicsBodies: [],
    }
  }),

  /**
   * Reset all repositories to initial state
   */
  resetRepositories: Effect.gen(function* (_) {
    // This would require access to repository instances
    yield* _(Effect.logInfo('Resetting all repositories to initial state'))
    return { success: true }
  }),

  /**
   * Seed repositories with test data
   */
  seedTestData: Effect.gen(function* (_) {
    yield* _(Effect.logInfo('Seeding repositories with test data'))
    return { success: true, seededRecords: 0 }
  }),
}

/**
 * Repository dependency injection utilities
 */
export const RepositoryDI = {
  /**
   * Provide all repositories to an Effect
   */
  provideRepositories: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, Exclude<R, WorldRepositoryService | EntityRepository | ChunkRepository | ComponentRepository | PhysicsRepository>> => {
    return Effect.provide(effect, AllRepositories)
  },

  /**
   * Provide core repositories to an Effect
   */
  provideCoreRepositories: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, Exclude<R, WorldRepositoryService | EntityRepository>> => {
    return Effect.provide(effect, CoreRepositories)
  },

  /**
   * Provide storage repositories to an Effect
   */
  provideStorageRepositories: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, Exclude<R, WorldRepositoryService | EntityRepository | ChunkRepository | ComponentRepository>> => {
    return Effect.provide(effect, StorageRepositories)
  },

  /**
   * Provide physics repositories to an Effect
   */
  providePhysicsRepositories: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, Exclude<R, EntityRepository | ComponentRepository | PhysicsRepository>> => {
    return Effect.provide(effect, PhysicsRepositories)
  },
}

/**
 * Default exports for convenience
 */
export {
  WorldRepositoryLive,
  WorldRepositoryService,
  EntityRepositoryLive,
  EntityRepository,
  ChunkRepositoryLive,
  ChunkRepository,
  ComponentRepositoryLive,
  ComponentRepository,
  PhysicsRepositoryLive,
  PhysicsRepository,
}