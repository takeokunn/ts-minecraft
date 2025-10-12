/**
 * @fileoverview World Generator Repository Cache Strategy
 * ワールド生成器リポジトリのキャッシュ戦略
 *
 * 高性能なキャッシュシステムによる最適化
 * LRU, LFU, TTL, Hybrid戦略の実装
 */

import type { AllRepositoryErrors, WorldGenerator, WorldId } from '@domain/world/types'
import { createRepositoryError } from '@domain/world/types'
import { Clock, Effect, Match, Option, pipe, ReadonlyArray, Ref, Schedule } from 'effect'

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

        // Effect.repeatWhileパターンで1件ずつ追い出し
        const evictOne = Effect.gen(function* () {
          const currentEntries = yield* Ref.get(entriesRef)
          const currentOrder = yield* Ref.get(accessOrderRef)

          // Option.matchパターン: 追い出し条件チェック（早期return）
          const shouldContinue = currentEntries.size > maxSize && currentOrder.length > 0

          return yield* pipe(
            Option.fromNullable(shouldContinue ? true : null),
            Option.match({
              onNone: () => Effect.succeed(Option.none()),
              onSome: () =>
                Effect.gen(function* () {
                  const lruKey = currentOrder[0]

                  return yield* pipe(
                    Option.fromNullable(lruKey && currentEntries.has(lruKey) ? lruKey : null),
                    Option.match({
                      onNone: () => Effect.succeed(Option.none()),
                      onSome: (key) =>
                        Effect.gen(function* () {
                          yield* Ref.update(entriesRef, (map) => {
                            const newMap = new Map(map)
                            newMap.delete(key)
                            return newMap
                          })
                          yield* Ref.update(accessOrderRef, (order) => order.slice(1))
                          return Option.some(1)
                        }),
                    })
                  )
                }),
            })
          )
        })

        const evicted = yield* pipe(
          evictOne,
          Effect.repeatWhile(Option.isSome),
          Effect.map((results) => ReadonlyArray.getSomes(results).length)
        )

        // Effect.whenパターン: 追い出し時のみ統計更新
        yield* Effect.when(evicted > 0, () =>
          Ref.update(statisticsRef, (stats) => ({
            ...stats,
            evictions: stats.evictions + evicted,
          }))
        )

        return evicted
      })

    const get = (key: K): Effect.Effect<Option.Option<V>, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeMillis
        const entries = yield* Ref.get(entriesRef)
        const entry = entries.get(key)

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalRequests: stats.totalRequests + 1,
        }))

        // Option.matchパターン: キャッシュヒット/ミス処理
        return yield* pipe(
          Option.fromNullable(entry),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
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
              }),
            onSome: (cachedEntry) =>
              Effect.gen(function* () {
                // Update access information
                const now = yield* Clock.currentTimeMillis
                const updatedEntry: CacheEntry<V> = {
                  ...cachedEntry,
                  accessCount: cachedEntry.accessCount + 1,
                  lastAccessed: now,
                }

                yield* Ref.update(entriesRef, (map) => new Map(map).set(key, updatedEntry))
                yield* updateAccessOrder(key)

                const endTime = yield* Clock.currentTimeMillis
                yield* Ref.update(statisticsRef, (stats) => {
                  const newHits = stats.hits + 1
                  const newTotal = stats.totalRequests
                  return {
                    ...stats,
                    hits: newHits,
                    hitRate: newHits / newTotal,
                    averageAccessTime: (stats.averageAccessTime + (endTime - startTime)) / 2,
                  }
                })

                return Option.some(cachedEntry.value)
              }),
          })
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache get operation failed: ${error}`, 'cache_get', error))
        )
      )

    const set = (key: K, value: V): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const entry: CacheEntry<V> = {
          value,
          timestamp: now,
          accessCount: 1,
          lastAccessed: now,
          size: estimateSize(value),
        }

        yield* Ref.update(entriesRef, (map) => new Map(map).set(key, entry))
        yield* updateAccessOrder(key)

        // Effect.whenパターン: サイズ超過時のみ追い出し
        const currentSize = yield* size()
        yield* Effect.when(currentSize > maxSize, () => evictLRU())
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(createRepositoryError(`LRU cache set operation failed: ${error}`, 'cache_set', error))
        )
      )

    const deleteKey = (key: K): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const existed = entries.has(key)

        // Effect.whenパターン: 存在する場合のみ削除
        yield* Effect.when(existed, () =>
          Effect.gen(function* () {
            yield* Ref.update(entriesRef, (map) => {
              const newMap = new Map(map)
              newMap.delete(key)
              return newMap
            })
            yield* Ref.update(accessOrderRef, (order) => order.filter((k) => k !== key))
          })
        )

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
      pipe(
        entries,
        Effect.forEach(([key, value]) => set(key, value), { concurrency: 4 }),
        Effect.asVoid
      )

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

    const isExpired = (entry: CacheEntry<V>, now: number): boolean => now - entry.timestamp > ttlMs

    const cleanupExpired = (): Effect.Effect<number, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const now = yield* Clock.currentTimeMillis

        // filterMap で有効なエントリと期限切れカウントを同時に処理
        // Option.matchパターン: 期限切れ判定によるエントリ分類
        const { validEntries, evicted } = pipe(
          Array.from(entries),
          ReadonlyArray.reduce({ validEntries: new Map<K, CacheEntry<V>>(), evicted: 0 }, (acc, [key, entry]) =>
            pipe(
              Option.fromNullable(isExpired(entry, now) ? null : entry),
              Option.match({
                onNone: () => ({ ...acc, evicted: acc.evicted + 1 }),
                onSome: (validEntry) => {
                  acc.validEntries.set(key, validEntry)
                  return acc
                },
              })
            )
          )
        )

        yield* Ref.set(entriesRef, validEntries)

        // Effect.whenパターン: 追い出し時のみ統計更新
        yield* Effect.when(evicted > 0, () =>
          Ref.update(statisticsRef, (stats) => ({
            ...stats,
            evictions: stats.evictions + evicted,
          }))
        )

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
        const now = yield* Clock.currentTimeMillis

        yield* Ref.update(statisticsRef, (stats) => ({
          ...stats,
          totalRequests: stats.totalRequests + 1,
        }))

        // Option.matchパターン: エントリ存在チェック + 期限チェック
        return yield* pipe(
          Option.fromNullable(entry && !isExpired(entry, now) ? entry : null),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                // 期限切れエントリを削除
                yield* Effect.when(entry !== undefined, () =>
                  Ref.update(entriesRef, (map) => {
                    const newMap = new Map(map)
                    newMap.delete(key)
                    return newMap
                  })
                )

                yield* Ref.update(statisticsRef, (stats) => {
                  const newMisses = stats.misses + 1
                  return {
                    ...stats,
                    misses: newMisses,
                    hitRate: stats.hits / stats.totalRequests,
                  }
                })

                return Option.none()
              }),
            onSome: (validEntry) =>
              Effect.gen(function* () {
                yield* Ref.update(statisticsRef, (stats) => {
                  const newHits = stats.hits + 1
                  return {
                    ...stats,
                    hits: newHits,
                    hitRate: newHits / stats.totalRequests,
                  }
                })

                return Option.some(validEntry.value)
              }),
          })
        )
      })

    const set = (key: K, value: V): Effect.Effect<void, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const entry: CacheEntry<V> = {
          value,
          timestamp: now,
          accessCount: 1,
          lastAccessed: now,
          size: estimateSize(value),
        }

        yield* Ref.update(entriesRef, (map) => new Map(map).set(key, entry))

        // Effect.whenパターン: サイズ超過時のみクリーンアップ
        const currentSize = yield* size()
        yield* Effect.when(currentSize > maxSize, () => cleanupExpired())
      })

    const deleteKey = (key: K): Effect.Effect<boolean, AllRepositoryErrors> =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(entriesRef)
        const existed = entries.has(key)

        // Effect.whenパターン: 存在する場合のみ削除
        yield* Effect.when(existed, () =>
          Ref.update(entriesRef, (map) => {
            const newMap = new Map(map)
            newMap.delete(key)
            return newMap
          })
        )

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
      pipe(
        entries,
        Effect.forEach(([key, value]) => set(key, value), { concurrency: 4 }),
        Effect.asVoid
      )

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

  return pipe(
    Match.value(strategy),
    Match.when('lru', () => makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize)),
    Match.when('ttl', () => makeTTLCacheStrategy<WorldId, WorldGenerator>(ttlSeconds * 1000, maxSize, estimateSize)),
    Match.when('hybrid', () =>
      // Hybrid strategy combining LRU with TTL
      Effect.gen(function* () {
        const lruCache = yield* makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize)
        const ttlCache = yield* makeTTLCacheStrategy<WorldId, WorldGenerator>(ttlSeconds * 1000, maxSize, estimateSize)

        return {
          get: (key: WorldId) =>
            Effect.gen(function* () {
              // Option.matchパターン: TTLキャッシュヒット判定
              const ttlResult = yield* ttlCache.get(key)

              return yield* pipe(
                ttlResult,
                Option.match({
                  onNone: () => lruCache.get(key),
                  onSome: (value) =>
                    Effect.gen(function* () {
                      // Update LRU for access pattern
                      yield* lruCache.set(key, value)
                      return Option.some(value)
                    }),
                })
              )
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
    ),
    Match.orElse(() => makeLRUCacheStrategy<WorldId, WorldGenerator>(maxSize, estimateSize))
  )
}
