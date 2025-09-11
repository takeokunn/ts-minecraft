/**
 * Query Performance Profiler
 * 
 * This module provides profiling capabilities for query execution,
 * tracking execution times, entity scan counts, and match rates
 * to help optimize query performance.
 */

import { type QueryMetrics } from './builder'

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