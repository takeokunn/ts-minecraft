/**
 * Query System Utilities
 * 
 * This module provides utilities for managing the query system,
 * including entity lifecycle management, cache operations,
 * and performance monitoring.
 */

import { OptimizedQuery } from './optimized-query'
import { globalQueryCache } from './cache'

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