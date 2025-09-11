/**
 * Query Cache System
 * Provides intelligent caching for query results with TTL and invalidation strategies
 */

import { Context, Effect, Layer, Ref } from 'effect'
import { ComponentName } from '@domain/entities/components'

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
 * Query cache service interface
 */
export interface QueryCacheService {
  readonly get: <T>(key: string) => Effect.Effect<T | undefined>
  readonly set: <T>(key: string, data: T, dependencies?: ComponentName[], ttl?: number) => Effect.Effect<void>
  readonly invalidate: (modifiedComponents: ComponentName[]) => Effect.Effect<number>
  readonly invalidateKey: (key: string) => Effect.Effect<boolean>
  readonly clear: Effect.Effect<void>
  readonly getStats: Effect.Effect<CacheStats>
  readonly cleanup: Effect.Effect<number>
  readonly getEntries: Effect.Effect<Array<{ key: string; entry: CacheEntry }>>
}

/**
 * Query cache context tag
 */
export const QueryCache = Context.GenericTag<QueryCacheService>('QueryCache')

/**
 * Helper functions for cache operations
 */
const shouldEvict = (currentMemoryUsage: number, newEntrySize: number, maxSize: number): boolean =>
  currentMemoryUsage + newEntrySize > maxSize

const findLRUKey = (cache: Map<string, CacheEntry>): string => {
  let oldestTime = Infinity
  let lruKey = ''

  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed
      lruKey = key
    }
  }

  return lruKey
}

const findLFUKey = (cache: Map<string, CacheEntry>): string => {
  let lowestCount = Infinity
  let lfuKey = ''

  for (const [key, entry] of cache.entries()) {
    if (entry.accessCount < lowestCount) {
      lowestCount = entry.accessCount
      lfuKey = key
    }
  }

  return lfuKey
}

const findOldestTTLKey = (cache: Map<string, CacheEntry>): string => {
  let oldestTimestamp = Infinity
  let oldestKey = ''

  for (const [key, entry] of cache.entries()) {
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp
      oldestKey = key
    }
  }

  return oldestKey
}

const estimateSize = (data: any): number => {
  try {
    return JSON.stringify(data).length * 2 // Rough estimation
  } catch {
    return 1024 // Default size for non-serializable data
  }
}

// Removed unused updateStats function

/**
 * Create a live query cache implementation
 */
export const queryCacheLive = (config: CacheConfig) =>
  Layer.effect(
    QueryCache,
    Effect.gen(function* () {
      const cache = yield* Ref.make(new Map<string, CacheEntry>())
      const stats = yield* Ref.make<CacheStats>({
        hits: 0,
        misses: 0,
        evictions: 0,
        totalEntries: 0,
        memoryUsage: 0,
        hitRate: 0,
      })

      // Setup cleanup interval if configured
      if (config.autoCleanupInterval > 0) {
        // Note: In a real implementation, you'd want to use Effect.schedule for this
        // setInterval(() => cleanup(), config.autoCleanupInterval)
      }

      const evictOne = (currentCache: Map<string, CacheEntry>): string | null => {
        if (currentCache.size === 0) return null

        let keyToEvict: string

        switch (config.evictionPolicy) {
          case EvictionPolicy.LRU:
            keyToEvict = findLRUKey(currentCache)
            break
          case EvictionPolicy.LFU:
            keyToEvict = findLFUKey(currentCache)
            break
          case EvictionPolicy.TTL:
            keyToEvict = findOldestTTLKey(currentCache)
            break
          case EvictionPolicy.FIFO:
          default:
            const firstKey = currentCache.keys().next().value
            keyToEvict = firstKey ?? ''
            break
        }

        return keyToEvict || null
      }

      const updateHitRate = (currentStats: CacheStats): CacheStats => {
        const total = currentStats.hits + currentStats.misses
        return {
          ...currentStats,
          hitRate: total === 0 ? 0 : currentStats.hits / total
        }
      }

      return QueryCache.of({
        get: <T>(key: string) =>
          Effect.gen(function* () {
            const currentCache = yield* Ref.get(cache)
            const entry = currentCache.get(key)

            if (!entry) {
              yield* Ref.update(stats, (s) => updateHitRate({ ...s, misses: s.misses + 1 }))
              return undefined
            }

            const now = Date.now()

            // Check TTL expiration
            if (now - entry.timestamp > entry.ttl) {
              yield* Ref.update(cache, (c) => {
                c.delete(key)
                return new Map(c)
              })
              yield* Ref.update(stats, (s) => updateHitRate({
                ...s,
                misses: s.misses + 1,
                evictions: s.evictions + 1
              }))
              return undefined
            }

            // Update access metadata
            entry.accessCount++
            entry.lastAccessed = now

            yield* Ref.update(stats, (s) => updateHitRate({ ...s, hits: s.hits + 1 }))

            return entry.data as T
          }),

        set: <T>(key: string, data: T, dependencies: ComponentName[] = [], ttl?: number) =>
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

            let currentCache = yield* Ref.get(cache)
            let currentStats = yield* Ref.get(stats)

            // Evict if necessary
            while (shouldEvict(currentStats.memoryUsage, size, config.maxSize)) {
              const keyToEvict = evictOne(currentCache)
              if (!keyToEvict) break

              currentCache.delete(keyToEvict)
              currentStats = { ...currentStats, evictions: currentStats.evictions + 1 }
            }

            currentCache.set(key, entry)
            
            yield* Ref.set(cache, new Map(currentCache))
            yield* Ref.set(stats, {
              ...currentStats,
              totalEntries: currentCache.size,
              memoryUsage: Array.from(currentCache.values()).reduce((sum, e) => sum + e.size, 0)
            })
          }),

        invalidate: (modifiedComponents: ComponentName[]) =>
          Effect.gen(function* () {
            const currentCache = yield* Ref.get(cache)
            let invalidated = 0
            const modifiedSet = new Set(modifiedComponents)

            for (const [key, entry] of currentCache.entries()) {
              const hasIntersection = [...entry.dependencies].some((dep) => modifiedSet.has(dep))

              if (hasIntersection) {
                currentCache.delete(key)
                invalidated++
              }
            }

            yield* Ref.set(cache, new Map(currentCache))
            yield* Ref.update(stats, (s) => ({
              ...s,
              totalEntries: currentCache.size,
              memoryUsage: Array.from(currentCache.values()).reduce((sum, e) => sum + e.size, 0)
            }))

            return invalidated
          }),

        invalidateKey: (key: string) =>
          Effect.gen(function* () {
            const currentCache = yield* Ref.get(cache)
            const deleted = currentCache.delete(key)
            
            if (deleted) {
              yield* Ref.set(cache, new Map(currentCache))
              yield* Ref.update(stats, (s) => ({
                ...s,
                totalEntries: currentCache.size,
                memoryUsage: Array.from(currentCache.values()).reduce((sum, e) => sum + e.size, 0)
              }))
            }
            
            return deleted
          }),

        clear: Effect.gen(function* () {
          const currentStats = yield* Ref.get(stats)
          yield* Ref.set(cache, new Map())
          yield* Ref.set(stats, {
            ...currentStats,
            evictions: currentStats.evictions + currentStats.totalEntries,
            totalEntries: 0,
            memoryUsage: 0
          })
        }),

        getStats: Ref.get(stats),

        cleanup: Effect.gen(function* () {
          const now = Date.now()
          const currentCache = yield* Ref.get(cache)
          let cleaned = 0

          for (const [key, entry] of currentCache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
              currentCache.delete(key)
              cleaned++
            }
          }

          if (cleaned > 0) {
            yield* Ref.set(cache, new Map(currentCache))
            yield* Ref.update(stats, (s) => ({
              ...s,
              evictions: s.evictions + cleaned,
              totalEntries: currentCache.size,
              memoryUsage: Array.from(currentCache.values()).reduce((sum, e) => sum + e.size, 0)
            }))
          }

          return cleaned
        }),

        getEntries: Effect.gen(function* () {
          const currentCache = yield* Ref.get(cache)
          return Array.from(currentCache.entries()).map(([key, entry]) => ({
            key,
            entry,
          }))
        }),
      })
    })
  )

/**
 * Global query cache layer
 */
export const globalQueryCacheLayer = queryCacheLive({
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTtl: 30000, // 30 seconds
  evictionPolicy: EvictionPolicy.LRU,
  enableMetrics: true,
  autoCleanupInterval: 10000, // 10 seconds
})

/**
 * Cache key generation utilities
 */
export const CacheKeyGenerator = {
  /**
   * Generate cache key for component-based query
   */
  forComponents: (required: ReadonlyArray<ComponentName>, forbidden: ReadonlyArray<ComponentName> = [], predicateHash?: string): string => {
    const requiredStr = [...required].sort().join(',')
    const forbiddenStr = [...forbidden].sort().join(',')
    const predicateStr = predicateHash ? `|pred:${predicateHash}` : ''

    return `comp:${requiredStr}|!${forbiddenStr}${predicateStr}`
  },

  /**
   * Generate cache key for entity list query
   */
  forEntityList: (entityIds: ReadonlyArray<string>): string => {
    return `entities:${[...entityIds].sort().join(',')}`
  },

  /**
   * Generate hash for predicate function
   */
  hashPredicate: (predicate: Function): string => {
    const funcStr = predicate.toString()
    return simpleHash(funcStr).toString(36)
  },
} as const

/**
 * Simple hash function for strings
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
