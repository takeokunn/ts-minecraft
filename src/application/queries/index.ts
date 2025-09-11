/**
 * Modern Query System for TypeScript Minecraft
 * High-performance entity querying with caching, optimization, and fluent API
 */

// Core query system exports
import { query, soaQuery, aosQuery, type QueryMetrics } from './builder'
import { OptimizedQuery } from './optimized-query'
import { globalQueryCache } from './cache'

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
  ArchetypeQuery,
  type ArchetypeSignature,
  type Archetype,
  type ArchetypeManager,
} from './archetype-query'

export {
  OptimizedQuery,
} from './optimized-query'

export {
  QueryCache,
  globalQueryCache,
  CacheKeyGenerator,
  EvictionPolicy,
  type CacheConfig,
  type CacheStats,
  type CachedQueryResult,
  type CachedQueryMetrics,
} from './cache'

// Legacy query compatibility layer
import { ComponentName } from '@/domain/entities/components'

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

// Predefined optimized queries for common use cases
export const queries = {
  /**
   * Player entity with all movement-related components
   */
  player: query()
    .with('playerControl', 'position', 'velocity', 'camera', 'inventory')
    .named('playerQuery')
    .priority(10)
    .buildOptimized(),

  /**
   * Player entity for block interaction/targeting
   */
  playerTarget: query()
    .with('playerControl', 'position', 'target', 'inventory')
    .named('playerTargetQuery')
    .priority(9)
    .buildOptimized(),

  /**
   * Player entity for collision detection
   */
  playerCollider: query()
    .with('playerControl', 'position', 'velocity', 'collider')
    .named('playerColliderQuery')
    .priority(8)
    .buildOptimized(),

  /**
   * Any entity with position and collider for obstacle detection
   */
  positionCollider: query()
    .with('position', 'collider')
    .named('positionColliderQuery')
    .priority(7)
    .buildOptimized(),

  /**
   * Entities affected by physics (gravity)
   */
  physics: query()
    .with('position', 'velocity', 'playerControl')
    .named('physicsQuery')
    .priority(6)
    .buildOptimized(),

  /**
   * Chunk marker entities
   */
  chunk: query()
    .with('mesh')
    .named('chunkQuery')
    .priority(5)
    .buildOptimized(),

  /**
   * Chunk loader state entity
   */
  chunkLoader: query()
    .with('renderable')
    .named('chunkLoaderQuery')
    .priority(5)
    .buildOptimized(),

  /**
   * Player entity for movement calculations
   */
  playerMovement: query()
    .with('playerControl', 'velocity', 'camera')
    .named('playerMovementQuery')
    .priority(8)
    .buildOptimized(),

  /**
   * Player entity for input handling
   */
  playerInput: query()
    .with('playerControl')
    .named('playerInputQuery')
    .priority(9)
    .buildOptimized(),

  /**
   * Terrain blocks for raycasting and world manipulation
   */
  terrainBlock: query()
    .with('mesh', 'position')
    .named('terrainBlockQuery')
    .priority(6)
    .buildOptimized(),

  /**
   * Movable entities (have velocity and position, not frozen)
   */
  movableEntities: query()
    .with('position', 'velocity')
    .without('playerControl')
    .where(entity => {
      const velocity = entity.get('velocity')
      // Assuming velocity has a magnitude property or method
      return (velocity as any).magnitude > 0
    })
    .named('movableEntitiesQuery')
    .priority(7)
    .buildOptimized(),

  /**
   * Renderable entities with positions
   */
  renderable: query()
    .with('position', 'renderable')
    .named('renderableQuery')
    .priority(8)
    .buildOptimized(),

  /**
   * Instanced mesh renderables for efficient rendering
   */
  instancedMesh: query()
    .with('position', 'renderable')
    .named('instancedMeshQuery')
    .priority(7)
    .buildOptimized(),

  /**
   * Entities with cameras
   */
  camera: query()
    .with('camera', 'position')
    .named('cameraQuery')
    .priority(9)
    .buildOptimized(),

  /**
   * Target blocks for interaction highlighting
   */
  targetBlock: query()
    .with('target', 'position')
    .named('targetBlockQuery')
    .priority(8)
    .buildOptimized(),
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
 * Query system utilities
 */
export const querySystem = {
  /**
   * Add entity to all query optimization indices
   */
  addEntity: OptimizedQuery.addEntity,

  /**
   * Remove entity from all query optimization indices
   */
  removeEntity: OptimizedQuery.removeEntity,

  /**
   * Update entity in all query optimization indices
   */
  updateEntity: OptimizedQuery.updateEntity,

  /**
   * Get comprehensive optimization statistics
   */
  getStats: OptimizedQuery.getOptimizationStats,

  /**
   * Reset all query indices and caches
   */
  reset: OptimizedQuery.reset,

  /**
   * Invalidate cache for specific components
   */
  invalidateCache: OptimizedQuery.invalidateCache,

  /**
   * Cleanup expired cache entries
   */
  cleanupCache: () => globalQueryCache.cleanup(),

  /**
   * Get cache statistics
   */
  getCacheStats: () => globalQueryCache.getStats(),
}

/**
 * Query performance profiler
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