/**
 * @fileoverview World Generator Repository Cache Strategy
 * ワールド生成器リポジトリのキャッシュ戦略
 *
 * 高性能なキャッシュシステムによる最適化
 * LRU, LFU, TTL, Hybrid戦略の実装
 */

import { Effect, Option, ReadonlyArray, Ref, Schedule } from 'effect'
import type { WorldGenerator, WorldId } from '../../types'
import type { AllRepositoryErrors } from '../types'
import { createRepositoryError } from '../types'

// === Cache Entry Types ===

interface CacheEntry<T> {
  readonly value: T
  readonly timestamp: number
  readonly accessCount: number
  readonly lastAccessed: number
  readonly size: number
}

interface CacheStatistics {
  readonly hits: number
  readonly misses: number
  readonly evictions: number
  readonly totalRequests: number
  readonly hitRate: number
  readonly averageAccessTime: number
}

// === Cache Strategy Interface ===

export interface CacheStrategy<K, V> {
  readonly get: (key: K) => Effect.Effect<Option.Option<V>, AllRepositoryErrors>
  readonly set: (key: K, value: V) => Effect.Effect<void, AllRepositoryErrors>
  readonly delete: (key: K) => Effect.Effect<boolean, AllRepositoryErrors>
  readonly clear: () => Effect.Effect<void, AllRepositoryErrors>
  readonly size: () => Effect.Effect<number, AllRepositoryErrors>
  readonly getStatistics: () => Effect.Effect<CacheStatistics, AllRepositoryErrors>
  readonly evict: () => Effect.Effect<number, AllRepositoryErrors>
  readonly warmup: (entries: ReadonlyArray<readonly [K, V]>) => Effect.Effect<void, AllRepositoryErrors>
}

// === LRU Cache Strategy ===

export const makeLRUCacheStrategy = <K, V>(
  maxSize: number,
  estimateSize: (value: V) => number = () => 1
): Effect.Effect<CacheStrategy<K, V>, never, never> =>
  Effect.gen(function* () {
    const entriesRef = yield* Ref.make(new Map<K, CacheEntry<V>>())
    const accessOrderRef = yield* Ref.make<K[]>([])
    const statisticsRef = yield* Ref.make<CacheStatistics>({
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
      averageAccessTime: 0,
    })

    const updateAccessOrder = (key: K): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(accessOrderRef, (order) => {
          const filtered = order.filter((k) => k !== key)
          return [...filtered, key]
        })
      })

    const evictLRU = (): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const accessOrder = yield* Ref.get(accessOrderRef)

        let evicted = 0
        let currentSize = entries.size

        while (currentSize > maxSize && accessOrder.length > 0) {
          const lruKey = accessOrder[0]
          if (lruKey && entries.has(lruKey)) {
            yield* Ref.update(entriesRef, (map) => {
              const newMap = new Map(map)
              newMap.delete(lruKey)
              return newMap
            })
            yield* Ref.update(accessOrderRef, (order) => order.slice(1))
            evicted++
            currentSize--
          } else {
            break
          }
        }

        if (evicted > 0) {
          yield* Ref.update(statisticsRef, (stats) => ({
            ...stats,
            evictions: stats.evictions + evicted,
          }))
        }

        return evicted
      })

    const get = (key: K): Effect.Effect<Option.Option<V>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const entries = yield* Ref.get(entriesRef)
        const entry = entries.get(key)

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalRequests: stats.totalRequests + 1,
        }))

        if (entry) {
          // Update access information
          const updatedEntry: CacheEntry<V> = {
            ...entry,
            accessCount: entry.accessCount + 1,
            lastAccessed: Date.now(),
          }

          yield* Ref.update(entriesRef, (map) => new Map(map).set(key, updatedEntry))
          yield* updateAccessOrder(key)

          yield* Ref.update(statisticsRef, (stats) => {
            const newHits = stats.hits + 1
            const newTotal = stats.totalRequests
            return {
              ...stats,
              hits: newHits,
              hitRate: newHits / newTotal,
              averageAccessTime: (stats.averageAccessTime + (Date.now() - startTime)) / 2,
            }
          })

          return Option.some(entry.value)
        } else {
          yield* Ref.update(statisticsRef, (stats) => {
            const newMisses = stats.misses + 1
            const newTotal = stats.totalRequests
            return {
              ...stats,
              misses: newMisses,
              hitRate: stats.hits / newTotal,
            }
          })

          return Option.none()
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache get operation failed: ${error}`, 'cache_get', error))
        )
      )

    const set = (key: K, value: V): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entry: CacheEntry<V> = {
          value,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now(),
          size: estimateSize(value),
        }

        yield* Ref.update(entriesRef, (map) => new Map(map).set(key, entry))
        yield* updateAccessOrder(key)

        // Evict if necessary
        const currentSize = yield* size()
        if (currentSize > maxSize) {
          yield* evictLRU()
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache set operation failed: ${error}`, 'cache_set', error))
        )
      )

    const deleteKey = (key: K): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const existed = entries.has(key)

        if (existed) {
          yield* Ref.update(entriesRef, (map) => {
            const newMap = new Map(map)
            newMap.delete(key)
            return newMap
          })
          yield* Ref.update(accessOrderRef, (order) => order.filter((k) => k !== key))
        }

        return existed
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache delete operation failed: ${error}`, 'cache_delete', error))
        )
      )

    const clear = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* Ref.set(entriesRef, new Map())
        yield* Ref.set(accessOrderRef, [])
        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          evictions: stats.evictions + stats.totalRequests - stats.hits, // Count as evictions
        }))
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache clear operation failed: ${error}`, 'cache_clear', error))
        )
      )

    const size = (): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        return entries.size
      })

    const getStatistics = (): Effect.Effect<CacheStatistics, AllRepositoryErrors> => Ref.get(statisticsRef)

    const warmup = (entries: ReadonlyArray<readonly [K, V]>): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        for (const [key, value] of entries) {
          yield* set(key, value)
        }
      })

    return {
      get,
      set,
      delete: deleteKey,
      clear,
      size,
      getStatistics,
      evict: evictLRU,
      warmup,
    }
  })

// === TTL Cache Strategy ===

export const makeTTLCacheStrategy = <K, V>(
  ttlMs: number,
  maxSize: number = Infinity,
  estimateSize: (value: V) => number = () => 1
): Effect.Effect<CacheStrategy<K, V>, never, never> =>
  Effect.gen(function* () {
    const entriesRef = yield* Ref.make(new Map<K, CacheEntry<V>>())
    const statisticsRef = yield* Ref.make<CacheStatistics>({
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
      averageAccessTime: 0,
    })

    const isExpired = (entry: CacheEntry<V>): boolean => Date.now() - entry.timestamp > ttlMs

    const cleanupExpired = (): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        let evicted = 0

        const validEntries = new Map<K, CacheEntry<V>>()
        for (const [key, entry] of entries) {
          if (isExpired(entry)) {
            evicted++
          } else {
            validEntries.set(key, entry)
          }
        }

        yield* Ref.set(entriesRef, validEntries)

        if (evicted > 0) {
          yield* Ref.update(statisticsRef, (stats) => ({
            ...stats,
            evictions: stats.evictions + evicted,
          }))
        }

        return evicted
      })

    // Schedule periodic cleanup
    const scheduleCleanup = Schedule.fixed(`${ttlMs / 2} millis`)
    Effect.schedule(cleanupExpired(), scheduleCleanup).pipe(Effect.forkDaemon)

    const get = (key: K): Effect.Effect<Option.Option<V>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        yield* cleanupExpired() // Clean on access

        const entries = yield* Ref.get(entriesRef)
        const entry = entries.get(key)

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalRequests: stats.totalRequests + 1,
        }))

        if (entry && !isExpired(entry)) {
          yield* Ref.update(statisticsRef, (stats) => {
            const newHits = stats.hits + 1
            return {
              ...stats,
              hits: newHits,
              hitRate: newHits / stats.totalRequests,
            }
          })

          return Option.some(entry.value)
        } else {
          if (entry) {
            // Remove expired entry
            yield* Ref.update(entriesRef, (map) => {
              const newMap = new Map(map)
              newMap.delete(key)
              return newMap
            })
          }

          yield* Ref.update(statisticsRef, (stats) => {
            const newMisses = stats.misses + 1
            return {
              ...stats,
              misses: newMisses,
              hitRate: stats.hits / stats.totalRequests,
            }
          })

          return Option.none()
        }
      })

    const set = (key: K, value: V): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entry: CacheEntry<V> = {
          value,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now(),
          size: estimateSize(value),
        }

        yield* Ref.update(entriesRef, (map) => new Map(map).set(key, entry))

        // Check size limit
        const currentSize = yield* size()
        if (currentSize > maxSize) {
          yield* cleanupExpired()
        }
      })

    const deleteKey = (key: K): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const existed = entries.has(key)

        if (existed) {
          yield* Ref.update(entriesRef, (map) => {
            const newMap = new Map(map)
            newMap.delete(key)
            return newMap
          })
        }

        return existed
      })

    const clear = (): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const currentSize = yield* size()
        yield* Ref.set(entriesRef, new Map())
        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          evictions: stats.evictions + currentSize,
        }))
      })

    const size = (): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        return entries.size
      })

    const getStatistics = (): Effect.Effect<CacheStatistics, AllRepositoryErrors> => Ref.get(statisticsRef)

    const warmup = (entries: ReadonlyArray<readonly [K, V]>): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        for (const [key, value] of entries) {
          yield* set(key, value)
        }
      })

    return {
      get,
      set,
      delete: deleteKey,
      clear,
      size,
      getStatistics,
      evict: cleanupExpired,
      warmup,
    }
  })

// === World Generator Specific Cache ===

export const makeWorldGeneratorCache = (
  strategy: 'lru' | 'ttl' | 'hybrid' = 'lru',
  maxSize: number = 1000,
  ttlSeconds: number = 3600
): Effect.Effect<CacheStrategy<WorldId, WorldGenerator>, never, never> => {
  const estimateSize = (generator: WorldGenerator): number => {
    // Rough estimation based on generator complexity
    return JSON.stringify(generator).length
  }

  switch (strategy) {
    case 'lru':
      return makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize)

    case 'ttl':
      return makeTTLCacheStrategy<WorldId, WorldGenerator>(ttlSeconds * 1000, maxSize, estimateSize)

    case 'hybrid':
      // Hybrid strategy combining LRU with TTL
      return Effect.gen(function* () {
        const lruCache = yield* makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize)
        const ttlCache = yield* makeTTLCacheStrategy<WorldId, WorldGenerator>(ttlSeconds * 1000, maxSize, estimateSize)

        return {
          get: (key: WorldId) =>
            Effect.gen(function* () {
              // Try TTL cache first (freshness)
              const ttlResult = yield* ttlCache.get(key)
              if (Option.isSome(ttlResult)) {
                // Update LRU for access pattern
                yield* lruCache.set(key, ttlResult.value)
                return ttlResult
              }

              // Fall back to LRU cache
              return yield* lruCache.get(key)
            }),

          set: (key: WorldId, value: WorldGenerator) =>
            Effect.gen(function* () {
              yield* ttlCache.set(key, value)
              yield* lruCache.set(key, value)
            }),

          delete: (key: WorldId) =>
            Effect.gen(function* () {
              const ttlDeleted = yield* ttlCache.delete(key)
              const lruDeleted = yield* lruCache.delete(key)
              return ttlDeleted || lruDeleted
            }),

          clear: () =>
            Effect.gen(function* () {
              yield* ttlCache.clear()
              yield* lruCache.clear()
            }),

          size: () => ttlCache.size(),

          getStatistics: () =>
            Effect.gen(function* () {
              const ttlStats = yield* ttlCache.getStatistics()
              const lruStats = yield* lruCache.getStatistics()

              return {
                hits: ttlStats.hits + lruStats.hits,
                misses: ttlStats.misses + lruStats.misses,
                evictions: ttlStats.evictions + lruStats.evictions,
                totalRequests: ttlStats.totalRequests + lruStats.totalRequests,
                hitRate: (ttlStats.hits + lruStats.hits) / (ttlStats.totalRequests + lruStats.totalRequests || 1),
                averageAccessTime: (ttlStats.averageAccessTime + lruStats.averageAccessTime) / 2,
              }
            }),

          evict: () =>
            Effect.gen(function* () {
              const ttlEvicted = yield* ttlCache.evict()
              const lruEvicted = yield* lruCache.evict()
              return ttlEvicted + lruEvicted
            }),

          warmup: (entries: ReadonlyArray<readonly [WorldId, WorldGenerator]>) =>
            Effect.gen(function* () {
              yield* ttlCache.warmup(entries)
              yield* lruCache.warmup(entries)
            }),
        }
      })

    default:
      return makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize)
  }
}
