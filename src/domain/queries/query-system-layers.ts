/**
 * Query System Layer Composition
 * 
 * This module provides Effect Layer composition for the query system services.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import { Layer } from 'effect'
import {
  QueryBuilderServiceLive,
  SoAQueryServiceLive,
  AoSQueryServiceLive,
} from './builder'
import { 
  ComponentIndexServiceLive,
  ArchetypeManagerServiceLive,
  ArchetypeQueryServiceLive,
  OptimizedQueryServiceLive,
} from './optimized-query'
import {
  CacheKeyGeneratorServiceLive,
  GlobalQueryCacheServiceLive,
} from './cache'

/**
 * Complete Query System Layer
 * Merges all query-related services into a single layer
 */
export const QuerySystemLive = Layer.mergeAll(
  QueryBuilderServiceLive,
  SoAQueryServiceLive,
  AoSQueryServiceLive,
  ComponentIndexServiceLive,
  ArchetypeManagerServiceLive,
  ArchetypeQueryServiceLive,
  OptimizedQueryServiceLive,
  CacheKeyGeneratorServiceLive,
  GlobalQueryCacheServiceLive,
)