/**
 * Query System Utilities
 *
 * This module provides utilities for managing the query system,
 * including entity lifecycle management, cache operations,
 * and performance monitoring.
 */

import { OptimizedQuery } from '@application/queries/optimized-query'
import { globalQueryCacheLayer } from '@application/queries/cache'

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
   * Note: These methods require Effect runtime context
   */
  cleanupCache: () => {
    throw new Error('cleanupCache requires Effect runtime context. Use Effect.provide(globalQueryCacheLayer) instead.')
  },

  /**
   * Get cache statistics
   * Note: These methods require Effect runtime context
   */
  getCacheStats: () => {
    throw new Error('getCacheStats requires Effect runtime context. Use Effect.provide(globalQueryCacheLayer) instead.')
  },
}
