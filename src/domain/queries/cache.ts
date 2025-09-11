/**
 * Query Cache System - Functional Effect-TS Implementation
 * Provides intelligent caching for query results with TTL and invalidation strategies
 */

import { Effect, Ref, Context, Layer, HashMap, Option } from 'effect'
import { ComponentName } from '@/domain/entities/components'
import { QueryMetrics } from './builder'

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = any> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  ttl: number
  size: number
  dependencies: Set<ComponentName>
}

/**
 * Cache eviction policies
 */
export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  TTL = 'ttl',
  FIFO = 'fifo',
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number
  defaultTtl: number
  evictionPolicy: EvictionPolicy
  enableMetrics: boolean
  autoCleanupInterval: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalEntries: number
  memoryUsage: number
  hitRate: number
}

/**
 * Query Cache Service
 */
export const QueryCacheService = Context.GenericTag<{
  readonly get: <T>(key: string) => Effect.Effect<Option.Option<T>>
  readonly set: <T>(key: string, data: T, dependencies?: ComponentName[], ttl?: number) => Effect.Effect<void>
  readonly invalidate: (modifiedComponents: ComponentName[]) => Effect.Effect<number>
  readonly invalidateKey: (key: string) => Effect.Effect<boolean>
  readonly clear: () => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<CacheStats>
  readonly cleanup: () => Effect.Effect<number>
  readonly getEntries: () => Effect.Effect<Array<{ key: string; entry: CacheEntry }>>
}>('QueryCacheService')

/**
 * Internal cache state
 */
interface CacheState {
  cache: HashMap.HashMap<string, CacheEntry>
  stats: CacheStats
  cleanupTimer?: NodeJS.Timeout
}

/**
 * Get cached query result
 */
const getCached = <T>(key: string, cacheRef: Ref.Ref<CacheState>): Effect.Effect<Option.Option<T>> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    const entryOption = HashMap.get(state.cache, key)

    if (Option.isNone(entryOption)) {
      yield* Ref.update(cacheRef, (state) => ({
        ...state,
        stats: {
          ...state.stats,
          misses: state.stats.misses + 1,
          hitRate: updateHitRate(state.stats.hits, state.stats.misses + 1),
        },
      }))
      return Option.none()
    }

    const entry = entryOption.value
    const now = Date.now()

    // Check TTL expiration
    if (now - entry.timestamp > entry.ttl) {
      yield* Ref.update(cacheRef, (state) => ({
        ...state,
        cache: HashMap.remove(state.cache, key),
        stats: {
          ...state.stats,
          misses: state.stats.misses + 1,
          evictions: state.stats.evictions + 1,
          totalEntries: state.stats.totalEntries - 1,
          hitRate: updateHitRate(state.stats.hits, state.stats.misses + 1),
        },
      }))
      return Option.none()
    }

    // Update access metadata
    const updatedEntry = {
      ...entry,
      accessCount: entry.accessCount + 1,
      lastAccessed: now,
    }

    yield* Ref.update(cacheRef, (state) => ({
      ...state,
      cache: HashMap.set(state.cache, key, updatedEntry),
      stats: {
        ...state.stats,
        hits: state.stats.hits + 1,
        hitRate: updateHitRate(state.stats.hits + 1, state.stats.misses),
      },
    }))

    return Option.some(entry.data as T)
  })

/**
 * Cache query result with dependencies
 */
const setCached = <T>(key: string, data: T, dependencies: ComponentName[] = [], ttl: number | undefined, cacheRef: Ref.Ref<CacheState>, config: CacheConfig): Effect.Effect<void> =>
  Effect.gen(function* () {
    const now = Date.now()
    const entryTtl = ttl ?? config.defaultTtl
    const size = estimateSize(data)

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      ttl: entryTtl,
      size,
      dependencies: new Set(dependencies),
    }

    // Evict if necessary
    yield* evictIfNecessary(size, cacheRef, config)

    yield* Ref.update(cacheRef, (state) => {
      const newCache = HashMap.set(state.cache, key, entry)
      return {
        ...state,
        cache: newCache,
        stats: {
          ...state.stats,
          totalEntries: HashMap.size(newCache),
          memoryUsage: calculateMemoryUsage(newCache),
        },
      }
    })
  })

/**
 * Invalidate cache entries that depend on modified components
 */
const invalidateCached = (modifiedComponents: ComponentName[], cacheRef: Ref.Ref<CacheState>): Effect.Effect<number> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    const modifiedSet = new Set(modifiedComponents)
    let invalidated = 0

    const newCache = HashMap.filter(state.cache, (_key, entry) => {
      const hasIntersection = [...entry.dependencies].some((dep) => modifiedSet.has(dep))
      if (hasIntersection) {
        invalidated++
        return false
      }
      return true
    })

    yield* Ref.set(cacheRef, {
      ...state,
      cache: newCache,
      stats: {
        ...state.stats,
        totalEntries: HashMap.size(newCache),
        memoryUsage: calculateMemoryUsage(newCache),
      },
    })

    return invalidated
  })

/**
 * Invalidate specific cache entry
 */
const invalidateKeyCached = (key: string, cacheRef: Ref.Ref<CacheState>): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    const hadKey = HashMap.has(state.cache, key)

    if (hadKey) {
      const newCache = HashMap.remove(state.cache, key)
      yield* Ref.set(cacheRef, {
        ...state,
        cache: newCache,
        stats: {
          ...state.stats,
          totalEntries: HashMap.size(newCache),
          memoryUsage: calculateMemoryUsage(newCache),
        },
      })
    }

    return hadKey
  })

/**
 * Clear all cache entries
 */
const clearCached = (cacheRef: Ref.Ref<CacheState>): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    const evictions = state.stats.totalEntries

    yield* Ref.set(cacheRef, {
      ...state,
      cache: HashMap.empty(),
      stats: {
        ...state.stats,
        evictions: state.stats.evictions + evictions,
        totalEntries: 0,
        memoryUsage: 0,
      },
    })
  })

/**
 * Get cache statistics
 */
const getStatsCached = (cacheRef: Ref.Ref<CacheState>): Effect.Effect<CacheStats> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    return { ...state.stats }
  })

/**
 * Cleanup expired entries
 */
const cleanupCached = (cacheRef: Ref.Ref<CacheState>): Effect.Effect<number> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    const now = Date.now()
    let cleaned = 0

    const newCache = HashMap.filter(state.cache, (_key, entry) => {
      const isExpired = now - entry.timestamp > entry.ttl
      if (isExpired) {
        cleaned++
        return false
      }
      return true
    })

    if (cleaned > 0) {
      yield* Ref.set(cacheRef, {
        ...state,
        cache: newCache,
        stats: {
          ...state.stats,
          evictions: state.stats.evictions + cleaned,
          totalEntries: HashMap.size(newCache),
          memoryUsage: calculateMemoryUsage(newCache),
        },
      })
    }

    return cleaned
  })

/**
 * Get cache entries for debugging
 */
const getEntriesCached = (cacheRef: Ref.Ref<CacheState>): Effect.Effect<Array<{ key: string; entry: CacheEntry }>> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)
    return HashMap.toEntries(state.cache).map(([key, entry]) => ({
      key,
      entry: { ...entry, dependencies: Array.from(entry.dependencies) } as any,
    }))
  })

/**
 * Check if eviction is needed
 */
const shouldEvict = (newEntrySize: number, memoryUsage: number, maxSize: number): boolean => memoryUsage + newEntrySize > maxSize

/**
 * Evict entries if necessary
 */
const evictIfNecessary = (newEntrySize: number, cacheRef: Ref.Ref<CacheState>, config: CacheConfig): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(cacheRef)

    let currentState = state
    while (shouldEvict(newEntrySize, currentState.stats.memoryUsage, config.maxSize)) {
      if (HashMap.isEmpty(currentState.cache)) break

      const keyToEvict = findKeyToEvict(currentState.cache, config.evictionPolicy)
      const newCache = HashMap.remove(currentState.cache, keyToEvict)

      currentState = {
        ...currentState,
        cache: newCache,
        stats: {
          ...currentState.stats,
          evictions: currentState.stats.evictions + 1,
          totalEntries: HashMap.size(newCache),
          memoryUsage: calculateMemoryUsage(newCache),
        },
      }
    }

    if (currentState !== state) {
      yield* Ref.set(cacheRef, currentState)
    }
  })

/**
 * Find key to evict based on policy
 */
const findKeyToEvict = (cache: HashMap.HashMap<string, CacheEntry>, policy: EvictionPolicy): string => {
  const entries = HashMap.toEntries(cache)

  switch (policy) {
    case EvictionPolicy.LRU:
      return entries.reduce((oldest, [key, entry]) => (entry.lastAccessed < oldest.lastAccessed ? { key, lastAccessed: entry.lastAccessed } : oldest), {
        key: entries[0]![0],
        lastAccessed: entries[0]![1].lastAccessed,
      }).key

    case EvictionPolicy.LFU:
      return entries.reduce((lowest, [key, entry]) => (entry.accessCount < lowest.accessCount ? { key, accessCount: entry.accessCount } : lowest), {
        key: entries[0]![0],
        accessCount: entries[0]![1].accessCount,
      }).key

    case EvictionPolicy.TTL:
      return entries.reduce((oldest, [key, entry]) => (entry.timestamp < oldest.timestamp ? { key, timestamp: entry.timestamp } : oldest), {
        key: entries[0]![0],
        timestamp: entries[0]![1].timestamp,
      }).key

    case EvictionPolicy.FIFO:
    default:
      return entries[0]![0]
  }
}

/**
 * Estimate data size
 */
const estimateSize = (data: any): number => {
  try {
    return JSON.stringify(data).length * 2 // Rough estimation
  } catch {
    return 1024 // Default size for non-serializable data
  }
}

/**
 * Calculate total memory usage
 */
const calculateMemoryUsage = (cache: HashMap.HashMap<string, CacheEntry>): number => HashMap.reduce(cache, 0, (sum, entry) => sum + entry.size)

/**
 * Update hit rate
 */
const updateHitRate = (hits: number, misses: number): number => {
  const total = hits + misses
  return total === 0 ? 0 : hits / total
}

/**
 * Query Cache Service Implementation
 */
export const QueryCacheServiceLive = (config: CacheConfig) =>
  Layer.effect(
    QueryCacheService,
    Effect.gen(function* () {
      const cacheRef = yield* Ref.make<CacheState>({
        cache: HashMap.empty(),
        stats: {
          hits: 0,
          misses: 0,
          evictions: 0,
          totalEntries: 0,
          memoryUsage: 0,
          hitRate: 0,
        },
        cleanupTimer: undefined,
      })

      // Setup cleanup timer if needed
      if (config.autoCleanupInterval > 0) {
        const timer = setInterval(() => {
          Effect.runPromise(cleanupCached(cacheRef))
        }, config.autoCleanupInterval)

        yield* Ref.update(cacheRef, (state) => ({ ...state, cleanupTimer: timer }))
      }

      return QueryCacheService.of({
        get: <T>(key: string) => getCached<T>(key, cacheRef),
        set: <T>(key: string, data: T, dependencies?: ComponentName[], ttl?: number) => setCached(key, data, dependencies || [], ttl, cacheRef, config),
        invalidate: (modifiedComponents) => invalidateCached(modifiedComponents, cacheRef),
        invalidateKey: (key) => invalidateKeyCached(key, cacheRef),
        clear: () => clearCached(cacheRef),
        getStats: () => getStatsCached(cacheRef),
        cleanup: () => cleanupCached(cacheRef),
        getEntries: () => getEntriesCached(cacheRef),
      })
    }),
  )

/**
 * Default cache configuration
 */
export const defaultCacheConfig: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTtl: 30000, // 30 seconds
  evictionPolicy: EvictionPolicy.LRU,
  enableMetrics: true,
  autoCleanupInterval: 10000, // 10 seconds
}

/**
 * Global query cache layer with default configuration
 */
export const GlobalQueryCacheServiceLive = QueryCacheServiceLive(defaultCacheConfig)

/**
 * Cache Key Generator Service
 */
export const CacheKeyGeneratorService = Context.GenericTag<{
  readonly forComponents: (required: ReadonlyArray<ComponentName>, forbidden?: ReadonlyArray<ComponentName>, predicateHash?: string) => string
  readonly forEntityList: (entityIds: ReadonlyArray<string>) => string
  readonly hashPredicate: (predicate: Function) => string
}>('CacheKeyGeneratorService')

/**
 * Generate cache key for component-based query
 */
const forComponents = (required: ReadonlyArray<ComponentName>, forbidden: ReadonlyArray<ComponentName> = [], predicateHash?: string): string => {
  const requiredStr = [...required].sort().join(',')
  const forbiddenStr = [...forbidden].sort().join(',')
  const predicateStr = predicateHash ? `|pred:${predicateHash}` : ''

  return `comp:${requiredStr}|!${forbiddenStr}${predicateStr}`
}

/**
 * Generate cache key for entity list query
 */
const forEntityList = (entityIds: ReadonlyArray<string>): string => `entities:${[...entityIds].sort().join(',')}`

/**
 * Generate hash for predicate function
 */
const hashPredicate = (predicate: Function): string => {
  const funcStr = predicate.toString()
  return simpleHash(funcStr).toString(36)
}

/**
 * Simple hash function
 */
const simpleHash = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash
}

/**
 * Cache Key Generator Service Implementation
 */
export const CacheKeyGeneratorServiceLive = Layer.succeed(
  CacheKeyGeneratorService,
  CacheKeyGeneratorService.of({
    forComponents,
    forEntityList,
    hashPredicate,
  }),
)

/**
 * Cache-aware query metrics
 */
export interface CachedQueryMetrics extends QueryMetrics {
  cacheKey?: string
  cacheHit: boolean
  cacheInvalidations: number
}

/**
 * Query result with caching metadata
 */
export interface CachedQueryResult<T> {
  data: T
  metrics: CachedQueryMetrics
  fromCache: boolean
  cacheKey?: string
}

/**
 * Convenience functions for backward compatibility
 */
export const CacheKeyGenerator = {
  forComponents,
  forEntityList,
  hashPredicate,
}

/**
 * Legacy QueryCache class wrapper for backward compatibility
 */
export class QueryCache {
  constructor(private config: CacheConfig) {}

  get<T>(key: string): T | undefined {
    throw new Error('Legacy QueryCache.get() not supported. Use QueryCacheService instead.')
  }

  set<T>(key: string, data: T, dependencies: ComponentName[] = [], ttl?: number): void {
    throw new Error('Legacy QueryCache.set() not supported. Use QueryCacheService instead.')
  }

  invalidate(modifiedComponents: ComponentName[]): number {
    throw new Error('Legacy QueryCache.invalidate() not supported. Use QueryCacheService instead.')
  }

  invalidateKey(key: string): boolean {
    throw new Error('Legacy QueryCache.invalidateKey() not supported. Use QueryCacheService instead.')
  }

  clear(): void {
    throw new Error('Legacy QueryCache.clear() not supported. Use QueryCacheService instead.')
  }

  getStats(): CacheStats {
    throw new Error('Legacy QueryCache.getStats() not supported. Use QueryCacheService instead.')
  }

  cleanup(): number {
    throw new Error('Legacy QueryCache.cleanup() not supported. Use QueryCacheService instead.')
  }

  getEntries(): Array<{ key: string; entry: CacheEntry }> {
    throw new Error('Legacy QueryCache.getEntries() not supported. Use QueryCacheService instead.')
  }

  dispose(): void {
    throw new Error('Legacy QueryCache.dispose() not supported. Use QueryCacheService instead.')
  }
}

/**
 * Legacy global query cache instance (deprecated)
 */
export const globalQueryCache = new QueryCache(defaultCacheConfig)
