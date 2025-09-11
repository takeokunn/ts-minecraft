/**
 * Modern Query System for TypeScript Minecraft - Functional Effect-TS Implementation
 * High-performance entity querying with caching, optimization, and fluent API
 */

import { Layer } from 'effect'
import { ComponentName } from '@/domain/entities/components'

// Core query system exports
import { 
  query, 
  soaQuery, 
  aosQuery, 
  QueryMetrics,
  QueryBuilderService,
  QueryBuilderServiceLive,
  SoAQueryService,
  SoAQueryServiceLive,
  AoSQueryService,
  AoSQueryServiceLive
} from './builder'

import { 
  OptimizedQueryService,
  OptimizedQueryServiceLive,
  ComponentIndexService,
  ComponentIndexServiceLive
} from './optimized-query'

import {
  ArchetypeQueryService,
  ArchetypeQueryServiceLive,
  ArchetypeManagerService,
  ArchetypeManagerServiceLive,
  ArchetypeService
} from './archetype-query'

import {
  QueryCacheService,
  GlobalQueryCacheServiceLive,
  CacheKeyGeneratorService,
  CacheKeyGeneratorServiceLive,
  EvictionPolicy,
  defaultCacheConfig
} from './cache'

export {
  query,
  soaQuery,
  aosQuery,
  type QueryBuilder,
  type QueryConfig,
  type EntityPredicate,
  type QueryMetrics,
  type QueryContext,
  type SoAQuery,
  type SoAQueryResult,
  type AoSQuery,
  type AoSQueryResult,
  startQueryContext,
  finalizeQueryContext,
} from './builder'

export {
  type ArchetypeSignature,
  type Archetype,
  type ArchetypeManager,
  ArchetypeQuery,
  ArchetypeService,
  ArchetypeManagerService,
  ArchetypeQueryService,
  ArchetypeManagerServiceLive,
  ArchetypeQueryServiceLive,
} from './archetype-query'

export {
  OptimizedQuery,
  OptimizedQueryService,
  OptimizedQueryServiceLive,
  ComponentIndexService,
  ComponentIndexServiceLive,
} from './optimized-query'

export {
  QueryCache,
  QueryCacheService,
  GlobalQueryCacheServiceLive,
  CacheKeyGenerator,
  CacheKeyGeneratorService,
  CacheKeyGeneratorServiceLive,
  EvictionPolicy,
  defaultCacheConfig,
  type CacheConfig,
  type CacheStats,
  type CachedQueryResult,
  type CachedQueryMetrics,
} from './cache'

// Service layer composition
export const QuerySystemLive = Layer.mergeAll(
  QueryBuilderServiceLive,
  SoAQueryServiceLive,
  AoSQueryServiceLive,
  ComponentIndexServiceLive,
  ArchetypeManagerServiceLive,
  ArchetypeQueryServiceLive,
  OptimizedQueryServiceLive,
  CacheKeyGeneratorServiceLive,
  GlobalQueryCacheServiceLive
)

// Legacy query compatibility layer
/**
 * Legacy Query interface for backward compatibility
 */
export interface LegacyQuery<T extends ReadonlyArray<ComponentName> = ReadonlyArray<ComponentName>> {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
}

/**
 * Legacy query result type for backward compatibility
 */
export type LegacyQueryResult<T extends ReadonlyArray<ComponentName>> = {
  [K in keyof T]: T[K] extends ComponentName ? ComponentName : T[K]
}

/**
 * Create legacy query for backward compatibility
 * @deprecated Use the new query builder API instead
 */
export const createQuery = <T extends ReadonlyArray<ComponentName>>(
  name: string, 
  components: T
): LegacyQuery<T> => {
  const set = new Set(components)
  return {
    name,
    components,
    set,
  }
}

// Note: Predefined queries now need to be created within Effect context
// These are example configurations that can be used with the new services

/**
 * Predefined query configurations for common use cases
 */
export const queryConfigs = {
  /**
   * Player entity with all movement-related components
   */
  player: {
    name: 'playerQuery',
    withComponents: ['playerControl', 'position', 'velocity', 'camera', 'inventory'] as const,
    priority: 10,
  },

  /**
   * Player entity for block interaction/targeting
   */
  playerTarget: {
    name: 'playerTargetQuery',
    withComponents: ['playerControl', 'position', 'target', 'inventory'] as const,
    priority: 9,
  },

  /**
   * Player entity for collision detection
   */
  playerCollider: {
    name: 'playerColliderQuery',
    withComponents: ['playerControl', 'position', 'velocity', 'collider'] as const,
    priority: 8,
  },

  /**
   * Any entity with position and collider for obstacle detection
   */
  positionCollider: {
    name: 'positionColliderQuery',
    withComponents: ['position', 'collider'] as const,
    priority: 7,
  },

  /**
   * Entities affected by physics (gravity)
   */
  physics: {
    name: 'physicsQuery',
    withComponents: ['position', 'velocity', 'playerControl'] as const,
    priority: 6,
  },

  /**
   * Chunk marker entities
   */
  chunk: {
    name: 'chunkQuery',
    withComponents: ['mesh'] as const,
    priority: 5,
  },

  /**
   * Chunk loader state entity
   */
  chunkLoader: {
    name: 'chunkLoaderQuery',
    withComponents: ['renderable'] as const,
    priority: 5,
  },

  /**
   * Player entity for movement calculations
   */
  playerMovement: {
    name: 'playerMovementQuery',
    withComponents: ['playerControl', 'velocity', 'camera'] as const,
    priority: 8,
  },

  /**
   * Player entity for input handling
   */
  playerInput: {
    name: 'playerInputQuery',
    withComponents: ['playerControl'] as const,
    priority: 9,
  },

  /**
   * Terrain blocks for raycasting and world manipulation
   */
  terrainBlock: {
    name: 'terrainBlockQuery',
    withComponents: ['mesh', 'position'] as const,
    priority: 6,
  },

  /**
   * Movable entities (have velocity and position, not frozen)
   */
  movableEntities: {
    name: 'movableEntitiesQuery',
    withComponents: ['position', 'velocity'] as const,
    withoutComponents: ['playerControl'],
    predicate: (entity: any) => {
      const velocity = entity.get('velocity')
      // Assuming velocity has a magnitude property or method
      return (velocity as any).magnitude > 0
    },
    priority: 7,
  },

  /**
   * Renderable entities with positions
   */
  renderable: {
    name: 'renderableQuery',
    withComponents: ['position', 'renderable'] as const,
    priority: 8,
  },

  /**
   * Instanced mesh renderables for efficient rendering
   */
  instancedMesh: {
    name: 'instancedMeshQuery',
    withComponents: ['position', 'renderable'] as const,
    priority: 7,
  },

  /**
   * Entities with cameras
   */
  camera: {
    name: 'cameraQuery',
    withComponents: ['camera', 'position'] as const,
    priority: 9,
  },

  /**
   * Target blocks for interaction highlighting
   */
  targetBlock: {
    name: 'targetBlockQuery',
    withComponents: ['target', 'position'] as const,
    priority: 8,
  },
}

// SoA queries for bulk operations
export const soaQueries = {
  /**
   * Position and velocity data for physics calculations
   */
  physics: soaQuery('position', 'velocity'),

  /**
   * Position data for spatial queries
   */
  positions: soaQuery('position'),

  /**
   * Renderable positions for efficient rendering
   */
  renderables: soaQuery('position', 'renderable'),
}

// AoS queries for entity-centric operations
export const aosQueries = {
  /**
   * Player entities with full component data
   */
  players: aosQuery('playerControl', 'position', 'velocity'),

  /**
   * Terrain blocks with position data
   */
  terrainBlocks: aosQuery('mesh', 'position'),
}

/**
 * Query system utilities - now requires Effect context
 * Use OptimizedQueryService directly for entity management
 */
export const querySystem = {
  /**
   * Note: These functions now require Effect context and services
   * Use OptimizedQueryService.addEntity, etc. directly within Effect programs
   */
  addEntity: () => {
    throw new Error('Legacy querySystem.addEntity not supported. Use OptimizedQueryService.addEntity within Effect context.')
  },
  removeEntity: () => {
    throw new Error('Legacy querySystem.removeEntity not supported. Use OptimizedQueryService.removeEntity within Effect context.')
  },
  updateEntity: () => {
    throw new Error('Legacy querySystem.updateEntity not supported. Use OptimizedQueryService.updateEntity within Effect context.')
  },
  getStats: () => {
    throw new Error('Legacy querySystem.getStats not supported. Use OptimizedQueryService.getOptimizationStats within Effect context.')
  },
  reset: () => {
    throw new Error('Legacy querySystem.reset not supported. Use OptimizedQueryService.reset within Effect context.')
  },
  invalidateCache: () => {
    throw new Error('Legacy querySystem.invalidateCache not supported. Use OptimizedQueryService.invalidateCache within Effect context.')
  },
  cleanupCache: () => {
    throw new Error('Legacy querySystem.cleanupCache not supported. Use QueryCacheService.cleanup within Effect context.')
  },
  getCacheStats: () => {
    throw new Error('Legacy querySystem.getCacheStats not supported. Use QueryCacheService.getStats within Effect context.')
  },
}

/**
 * Query performance profiler - requires Effect context for new implementation
 */
export class QueryProfiler {
  private static profiles: Map<string, QueryMetrics[]> = new Map()

  /**
   * Record query execution metrics
   */
  static record(queryName: string, metrics: QueryMetrics): void {
    if (!this.profiles.has(queryName)) {
      this.profiles.set(queryName, [])
    }
    
    const queryProfiles = this.profiles.get(queryName)!
    queryProfiles.push(metrics)
    
    // Keep only last 100 executions
    if (queryProfiles.length > 100) {
      queryProfiles.shift()
    }
  }

  /**
   * Get performance statistics for a query
   */
  static getStats(queryName: string) {
    const profiles = this.profiles.get(queryName)
    if (!profiles || profiles.length === 0) {
      return null
    }

    const execTimes = profiles.map(p => p.executionTime)
    const scannedCounts = profiles.map(p => p.entitiesScanned)
    const matchedCounts = profiles.map(p => p.entitiesMatched)

    return {
      executionCount: profiles.length,
      avgExecutionTime: execTimes.reduce((a, b) => a + b, 0) / execTimes.length,
      minExecutionTime: Math.min(...execTimes),
      maxExecutionTime: Math.max(...execTimes),
      avgEntitiesScanned: scannedCounts.reduce((a, b) => a + b, 0) / scannedCounts.length,
      avgEntitiesMatched: matchedCounts.reduce((a, b) => a + b, 0) / matchedCounts.length,
      avgSelectivity: matchedCounts.reduce((a, b) => a + b, 0) / scannedCounts.reduce((a, b) => a + b, 0),
    }
  }

  /**
   * Get all query statistics
   */
  static getAllStats() {
    const stats: Record<string, any> = {}
    
    for (const queryName of this.profiles.keys()) {
      stats[queryName] = this.getStats(queryName)
    }
    
    return stats
  }

  /**
   * Clear all profiling data
   */
  static clear(): void {
    this.profiles.clear()
  }
}

// Export services for direct use in Effect programs
export {
  QueryBuilderService,
  QueryBuilderServiceLive,
  SoAQueryService,
  SoAQueryServiceLive,
  AoSQueryService,
  AoSQueryServiceLive,
  OptimizedQueryService,
  OptimizedQueryServiceLive,
  ComponentIndexService,
  ComponentIndexServiceLive,
  ArchetypeQueryService,
  ArchetypeQueryServiceLive,
  ArchetypeManagerService,
  ArchetypeManagerServiceLive,
  QueryCacheService,
  GlobalQueryCacheServiceLive,
  CacheKeyGeneratorService,
  CacheKeyGeneratorServiceLive,
}