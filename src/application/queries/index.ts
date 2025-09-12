// Query Builder - Core query interface used by external modules
export { query, QueryBuilder, soaQuery, aosQuery } from './builder'

// Query Cache - Performance layer used by external modules  
export { QueryCache, globalQueryCacheLayer } from './cache'

// Unified Query System - Main query interface used by external modules
export {
  UnifiedQuerySystemService,
  UnifiedQuerySystemLive,
} from './unified-query-system'

// Internal exports for within-directory usage
export { createArchetypeQuery } from './archetype-query'
