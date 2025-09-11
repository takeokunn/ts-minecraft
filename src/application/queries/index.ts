/**
 * Application Queries - Barrel Exports
 * 
 * This module provides a clean interface for all query-related functionality
 * in the application layer, following DDD principles by keeping the index
 * as a pure barrel export without logic.
 */

// Core query system exports
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

export { ArchetypeQuery, type ArchetypeSignature, type Archetype, type ArchetypeManager } from './archetype-query'

export { OptimizedQuery } from './optimized-query'

export { QueryCache, globalQueryCache, CacheKeyGenerator, EvictionPolicy, type CacheConfig, type CacheStats, type CachedQueryResult, type CachedQueryMetrics } from './cache'

// Predefined queries
export { queries, soaQueries, aosQueries } from './predefined-queries'

// Query profiler
export { QueryProfiler } from './query-profiler'

// Query system utilities
export { querySystem } from './query-system'

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
export const createQuery = <T extends ReadonlyArray<ComponentName>>(name: string, components: T): LegacyQuery<T> => {
  const set = new Set(components)
  return {
    name,
    components,
    set,
  }
}
