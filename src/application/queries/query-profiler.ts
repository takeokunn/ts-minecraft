/**
 * Query Performance Profiler (Functional)
 * 
 * This module provides profiling capabilities for query execution,
 * tracking execution times, entity scan counts, and match rates
 * to help optimize query performance using Effect-TS patterns.
 */

import { Effect, Context, Layer, Ref, pipe } from 'effect'
import { type QueryMetrics } from '@application/queries/builder'

/**
 * Query profiler state interface
 */
export interface QueryProfilerState {
  readonly profiles: Map<string, QueryMetrics[]>
}

/**
 * Query profiler statistics interface
 */
export interface QueryStats {
  readonly executionCount: number
  readonly avgExecutionTime: number
  readonly minExecutionTime: number
  readonly maxExecutionTime: number
  readonly avgEntitiesScanned: number
  readonly avgEntitiesMatched: number
  readonly avgSelectivity: number
}

/**
 * Query profiler service interface
 */
export interface QueryProfilerService {
  readonly record: (queryName: string, metrics: QueryMetrics) => Effect.Effect<void>
  readonly getStats: (queryName: string) => Effect.Effect<QueryStats | null>
  readonly getAllStats: () => Effect.Effect<Record<string, QueryStats | null>>
  readonly clear: () => Effect.Effect<void>
}

/**
 * Query profiler service tag
 */
export const QueryProfiler = Context.GenericTag<QueryProfilerService>('QueryProfiler')

/**
 * Query profiler implementation
 */
export const QueryProfilerLive = Layer.effect(
  QueryProfiler,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<QueryProfilerState>({
      profiles: new Map()
    })

    const record = (queryName: string, metrics: QueryMetrics) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const newProfiles = new Map(state.profiles)
        
        if (!newProfiles.has(queryName)) {
          newProfiles.set(queryName, [])
        }

        const queryProfiles = [...(newProfiles.get(queryName) || [])]
        queryProfiles.push(metrics)

        // Keep only last 100 executions
        if (queryProfiles.length > 100) {
          queryProfiles.shift()
        }

        newProfiles.set(queryName, queryProfiles)

        yield* Ref.set(stateRef, {
          profiles: newProfiles
        })
      })

    const getStats = (queryName: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const profiles = state.profiles.get(queryName)
        
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
        } satisfies QueryStats
      })

    const getAllStats = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const stats: Record<string, QueryStats | null> = {}

        for (const queryName of state.profiles.keys()) {
          stats[queryName] = yield* getStats(queryName)
        }

        return stats
      })

    const clear = () =>
      Effect.gen(function* () {
        yield* Ref.set(stateRef, {
          profiles: new Map()
        })
      })

    return {
      record,
      getStats,
      getAllStats,
      clear
    } satisfies QueryProfilerService
  })
)

/**
 * Functional profiler utilities for convenience
 */
export const QueryProfilerUtils = {
  /**
   * Record query execution metrics
   */
  record: (queryName: string, metrics: QueryMetrics) =>
    Effect.gen(function* () {
      const profiler = yield* QueryProfiler
      yield* profiler.record(queryName, metrics)
    }),

  /**
   * Get performance statistics for a query
   */
  getStats: (queryName: string) =>
    Effect.gen(function* () {
      const profiler = yield* QueryProfiler
      return yield* profiler.getStats(queryName)
    }),

  /**
   * Get all query statistics
   */
  getAllStats: () =>
    Effect.gen(function* () {
      const profiler = yield* QueryProfiler
      return yield* profiler.getAllStats()
    }),

  /**
   * Clear all profiling data
   */
  clear: () =>
    Effect.gen(function* () {
      const profiler = yield* QueryProfiler
      yield* profiler.clear()
    })
}