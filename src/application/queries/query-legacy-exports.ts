/**
 * Query Legacy Exports - Backward compatibility layer
 * 
 * This module contains legacy compatibility exports that were previously
 * mixed in the index.ts file. These exports are maintained during migration
 * but will be deprecated in future versions.
 */

// === LEGACY COMPATIBILITY EXPORTS ===
// These are maintained during migration but will be deprecated
export { query, QueryBuilder, soaQuery, SoAQuery, aosQuery, AoSQuery } from '@application/queries/builder'
export { ArchetypeQuery, Archetype, ArchetypeManager } from '@application/queries/archetype-query'
export { OptimizedQuery } from '@application/queries/optimized-query'
export { QueryCache, EvictionPolicy, globalQueryCacheLayer, CacheKeyGenerator } from '@application/queries/cache'