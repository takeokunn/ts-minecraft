/**
 * Legacy Query System - Deprecated
 * 
 * This module contains legacy query system utilities and profiler
 * that are deprecated in favor of the new Effect-based services.
 * These are kept for backward compatibility but should not be used
 * in new code.
 */

import { QueryMetrics } from './builder'

/**
 * Query system utilities - now requires Effect context
 * Use OptimizedQueryService directly for entity management
 * 
 * @deprecated Use Effect-based services instead
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
 * 
 * @deprecated Use Effect-based profiling services instead
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

    const execTimes = profiles.map((p) => p.executionTime)
    const scannedCounts = profiles.map((p) => p.entitiesScanned)
    const matchedCounts = profiles.map((p) => p.entitiesMatched)

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