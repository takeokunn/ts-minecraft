/**
 * @fileoverview Biome System Cache Implementation
 * バイオームシステム専用キャッシュ実装
 *
 * 空間的局所性を活用した高性能キャッシュ
 * バイオームクエリの最適化とメモリ効率
 */

import { makeUnsafeWorldCoordinate2D } from '@/domain/biome/value_object/coordinates'
import type { AllRepositoryErrors, BiomeId } from '@domain/world/types'
import { createBiomeId, createCacheError } from '@domain/world/types'
import { Clock, Effect, Option, pipe, ReadonlyArray, Ref } from 'effect'
import type {
  calculateDistance,
  coordinateInBounds,
  coordinateToKey,
  SpatialBounds,
  SpatialCoordinate,
  SpatialQueryResult,
} from './index'

// === Cache Configuration ===

export interface BiomeCacheConfig {
  readonly maxSpatialEntries: number
  readonly maxQueryEntries: number
  readonly ttlSeconds: number
  readonly spatialGridSize: number
  readonly enableSpatialClustering: boolean
  readonly enableQueryCaching: boolean
  readonly compressionEnabled: boolean
}

export const defaultBiomeCacheConfig: BiomeCacheConfig = {
  maxSpatialEntries: 10000,
  maxQueryEntries: 1000,
  ttlSeconds: 300, // 5 minutes
  spatialGridSize: 64,
  enableSpatialClustering: true,
  enableQueryCaching: true,
  compressionEnabled: false,
}

// === Cache Entry Types ===

interface BiomeCacheEntry {
  readonly biomeId: BiomeId
  readonly confidence: number
  readonly timestamp: number
  readonly accessCount: number
  readonly lastAccess: number
}

interface SpatialCluster {
  readonly centerCoordinate: SpatialCoordinate
  readonly radius: number
  readonly dominantBiome: BiomeId
  readonly biomeDistribution: Map<BiomeId, number>
  readonly confidence: number
  readonly lastUpdate: number
}

interface QueryCacheEntry {
  readonly queryHash: string
  readonly results: ReadonlyArray<SpatialQueryResult>
  readonly timestamp: number
  readonly accessCount: number
  readonly bounds: SpatialBounds
}

// === Cache Statistics ===

export interface BiomeCacheStatistics {
  readonly spatialCache: {
    readonly size: number
    readonly maxSize: number
    readonly hitCount: number
    readonly missCount: number
    readonly evictionCount: number
    readonly averageAccessTime: number
    readonly clusterCount: number
  }
  readonly queryCache: {
    readonly size: number
    readonly maxSize: number
    readonly hitCount: number
    readonly missCount: number
    readonly evictionCount: number
    readonly averageQueryTime: number
  }
  readonly memory: {
    readonly estimatedSize: number
    readonly compressionRatio: number
  }
  readonly performance: {
    readonly cacheEfficiency: number
    readonly spatialLocality: number
    readonly temporalLocality: number
  }
}

// === Cache Implementation ===

export interface BiomeCache {
  // === Spatial Caching ===
  readonly getBiomeAt: (coordinate: SpatialCoordinate) => Effect.Effect<Option.Option<BiomeId>, AllRepositoryErrors>
  readonly setBiomeAt: (
    coordinate: SpatialCoordinate,
    biomeId: BiomeId,
    confidence?: number
  ) => Effect.Effect<void, AllRepositoryErrors>
  readonly getBiomesInBounds: (
    bounds: SpatialBounds
  ) => Effect.Effect<Option.Option<ReadonlyArray<SpatialQueryResult>>, AllRepositoryErrors>
  readonly setBiomesInBounds: (
    bounds: SpatialBounds,
    results: ReadonlyArray<SpatialQueryResult>
  ) => Effect.Effect<void, AllRepositoryErrors>

  // === Query Caching ===
  readonly getCachedQuery: (
    queryHash: string
  ) => Effect.Effect<Option.Option<ReadonlyArray<SpatialQueryResult>>, AllRepositoryErrors>
  readonly setCachedQuery: (
    queryHash: string,
    results: ReadonlyArray<SpatialQueryResult>,
    bounds: SpatialBounds
  ) => Effect.Effect<void, AllRepositoryErrors>

  // === Spatial Clustering ===
  readonly getCluster: (
    coordinate: SpatialCoordinate
  ) => Effect.Effect<Option.Option<SpatialCluster>, AllRepositoryErrors>
  readonly updateCluster: (
    coordinate: SpatialCoordinate,
    biomeDistribution: Map<BiomeId, number>
  ) => Effect.Effect<void, AllRepositoryErrors>
  readonly getNearbyCluster: (
    coordinate: SpatialCoordinate,
    radius: number
  ) => Effect.Effect<ReadonlyArray<SpatialCluster>, AllRepositoryErrors>

  // === Cache Management ===
  readonly clear: (bounds?: SpatialBounds) => Effect.Effect<void, AllRepositoryErrors>
  readonly evictExpired: () => Effect.Effect<number, AllRepositoryErrors>
  readonly optimize: () => Effect.Effect<void, AllRepositoryErrors>
  readonly getStatistics: () => Effect.Effect<BiomeCacheStatistics, AllRepositoryErrors>

  // === Preloading & Warmup ===
  readonly warmupRegion: (bounds: SpatialBounds) => Effect.Effect<void, AllRepositoryErrors>
  readonly preloadCluster: (
    centerCoordinate: SpatialCoordinate,
    radius: number
  ) => Effect.Effect<void, AllRepositoryErrors>
}

// === Cache Implementation ===

export const createBiomeCache = (
  config: BiomeCacheConfig = defaultBiomeCacheConfig
): Effect.Effect<BiomeCache, AllRepositoryErrors> =>
  Effect.gen(function* () {
    // Cache state references
    const spatialCache = yield* Ref.make(new Map<string, BiomeCacheEntry>())
    const queryCache = yield* Ref.make(new Map<string, QueryCacheEntry>())
    const spatialClusters = yield* Ref.make(new Map<string, SpatialCluster>())

    // Statistics tracking
    const spatialStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      totalAccessTime: 0,
      accessCount: 0,
    })

    const queryStats = yield* Ref.make({
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      totalQueryTime: 0,
      queryCount: 0,
    })

    // === Utility Functions ===

    const getCurrentTimestamp = (): Effect.Effect<number> => Clock.currentTimeMillis

    const isExpired = (timestamp: number): Effect.Effect<boolean> =>
      Effect.map(getCurrentTimestamp(), (currentTime) => currentTime - timestamp > config.ttlSeconds * 1000)

    const getGridKey = (coordinate: SpatialCoordinate): string => {
      const gridX = Math.floor(coordinate.x / config.spatialGridSize) * config.spatialGridSize
      const gridZ = Math.floor(coordinate.z / config.spatialGridSize) * config.spatialGridSize
      return `${gridX},${gridZ}`
    }

    const hashQuery = (bounds: SpatialBounds, filters?: any): string => {
      const data = JSON.stringify({ bounds, filters })
      // ReadonlyArray.reduceを使用したハッシュ計算
      const hash = pipe(
        data.split(''),
        ReadonlyArray.reduce(0, (hash, char) => {
          const code = char.charCodeAt(0)
          return ((hash << 5) - hash + code) & hash // Convert to 32-bit integer
        })
      )
      return hash.toString()
    }

    // === LRU Eviction ===

    const evictLRUSpatial = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(spatialCache)

        // Effect.whenで早期return → 条件付き実行
        yield* Effect.when(cache.size > config.maxSpatialEntries, () =>
          Effect.gen(function* () {
            const entries = Array.from(cache.entries())
            entries.sort(([, a], [, b]) => a.lastAccess - b.lastAccess)

            const toEvict = entries.slice(0, cache.size - config.maxSpatialEntries + 100) // Evict extra for performance
            const updated = new Map(cache)

            // Effect.syncでMap削除をラップ
            yield* pipe(
              toEvict,
              Effect.forEach(([key]) => Effect.sync(() => updated.delete(key)), { concurrency: 4 })
            )

            yield* Ref.set(spatialCache, updated)
            yield* Ref.update(spatialStats, (stats) => ({
              ...stats,
              evictionCount: stats.evictionCount + toEvict.length,
            }))
          })
        )
      })

    const evictLRUQuery = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(queryCache)

        // Effect.whenで早期return → 条件付き実行
        yield* Effect.when(cache.size > config.maxQueryEntries, () =>
          Effect.gen(function* () {
            const entries = Array.from(cache.entries())
            entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)

            const toEvict = entries.slice(0, cache.size - config.maxQueryEntries + 50)
            const updated = new Map(cache)

            // Effect.syncでMap削除をラップ
            yield* pipe(
              toEvict,
              Effect.forEach(([key]) => Effect.sync(() => updated.delete(key)), { concurrency: 4 })
            )

            yield* Ref.set(queryCache, updated)
            yield* Ref.update(queryStats, (stats) => ({
              ...stats,
              evictionCount: stats.evictionCount + toEvict.length,
            }))
          })
        )
      })

    // === Implementation ===

    return {
      // === Spatial Caching ===

      getBiomeAt: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          const startTime = yield* getCurrentTimestamp()
          const key = coordinateToKey(coordinate)
          const cache = yield* Ref.get(spatialCache)
          const entry = cache.get(key)

          // Option.matchでnull安全なキャッシュヒット処理
          return yield* pipe(
            Option.fromNullable(entry),
            Option.flatMap((e) =>
              Effect.gen(function* () {
                const expired = yield* isExpired(e.timestamp)
                return expired ? Option.none<typeof e>() : Option.some(e)
              })
            ),
            Option.match({
              onSome: (validEntry) =>
                Effect.gen(function* () {
                  // Update access statistics
                  const currentTime = yield* getCurrentTimestamp()
                  const updated = new Map(cache)
                  updated.set(key, {
                    ...validEntry,
                    lastAccess: currentTime,
                    accessCount: validEntry.accessCount + 1,
                  })
                  yield* Ref.set(spatialCache, updated)

                  const endTime = yield* getCurrentTimestamp()
                  yield* Ref.update(spatialStats, (stats) => ({
                    ...stats,
                    hitCount: stats.hitCount + 1,
                    totalAccessTime: stats.totalAccessTime + (endTime - startTime),
                    accessCount: stats.accessCount + 1,
                  }))

                  return Option.some(validEntry.biomeId)
                }),
              onNone: () =>
                Effect.gen(function* () {
                  const endTime = yield* getCurrentTimestamp()
                  yield* Ref.update(spatialStats, (stats) => ({
                    ...stats,
                    missCount: stats.missCount + 1,
                    totalAccessTime: stats.totalAccessTime + (endTime - startTime),
                    accessCount: stats.accessCount + 1,
                  }))

                  return Option.none()
                }),
            })
          )
        }),

      setBiomeAt: (coordinate: SpatialCoordinate, biomeId: BiomeId, confidence = 1.0) =>
        Effect.gen(function* () {
          const key = coordinateToKey(coordinate)
          const cache = yield* Ref.get(spatialCache)
          const timestamp = yield* getCurrentTimestamp()

          const entry: BiomeCacheEntry = {
            biomeId,
            confidence,
            timestamp,
            accessCount: 1,
            lastAccess: timestamp,
          }

          const updated = new Map(cache)
          updated.set(key, entry)
          yield* Ref.set(spatialCache, updated)

          // Evict if necessary
          yield* evictLRUSpatial()
        }),

      getBiomesInBounds: (bounds: SpatialBounds) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(spatialCache)
          const cacheEntries = Array.from(cache)

          // Effect.forEachで各エントリをチェック
          const results = yield* pipe(
            cacheEntries,
            Effect.forEach(
              ([key, entry]) =>
                Effect.gen(function* () {
                  const expired = yield* isExpired(entry.timestamp)
                  // 期限切れの場合はOption.none
                  return yield* pipe(
                    expired,
                    Effect.if({
                      onTrue: () => Effect.succeed(Option.none()),
                      onFalse: () =>
                        Effect.gen(function* () {
                          const coordinate = makeUnsafeWorldCoordinate2D(
                            parseFloat(key.split(',')[0]),
                            parseFloat(key.split(',')[1])
                          )

                          // 境界チェック
                          return coordinateInBounds(coordinate, bounds)
                            ? Option.some({
                                biomeId: entry.biomeId,
                                coordinate,
                                distance: 0,
                                confidence: entry.confidence,
                              })
                            : Option.none()
                        }),
                    })
                  )
                }),
              { concurrency: 4 }
            ),
            Effect.map(ReadonlyArray.getSomes)
          )

          return results.length > 0 ? Option.some(results) : Option.none()
        }),

      setBiomesInBounds: (bounds: SpatialBounds, results: ReadonlyArray<SpatialQueryResult>) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(spatialCache)
          const updated = new Map(cache)
          const timestamp = yield* getCurrentTimestamp()

          // 条件に合致する結果のみフィルタしてMap.setを実行
          yield* pipe(
            results,
            ReadonlyArray.filter((result) => coordinateInBounds(result.coordinate, bounds)),
            Effect.forEach(
              (result) =>
                Effect.sync(() => {
                  const key = coordinateToKey(result.coordinate)
                  updated.set(key, {
                    biomeId: result.biomeId,
                    confidence: result.confidence,
                    timestamp,
                    accessCount: 1,
                    lastAccess: timestamp,
                  })
                }),
              { concurrency: 4 }
            )
          )

          yield* Ref.set(spatialCache, updated)
          yield* evictLRUSpatial()
        }),

      // === Query Caching ===

      getCachedQuery: (queryHash: string) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(queryCache)
          const entry = cache.get(queryHash)

          // Option.matchでキャッシュヒット処理
          return yield* pipe(
            Option.fromNullable(entry),
            Option.flatMap((e) =>
              Effect.gen(function* () {
                const expired = yield* isExpired(e.timestamp)
                return expired ? Option.none<typeof e>() : Option.some(e)
              })
            ),
            Option.match({
              onSome: (validEntry) =>
                Effect.gen(function* () {
                  // Update access statistics
                  const updated = new Map(cache)
                  updated.set(queryHash, {
                    ...validEntry,
                    accessCount: validEntry.accessCount + 1,
                  })
                  yield* Ref.set(queryCache, updated)

                  yield* Ref.update(queryStats, (stats) => ({
                    ...stats,
                    hitCount: stats.hitCount + 1,
                  }))

                  return Option.some(validEntry.results)
                }),
              onNone: () =>
                Effect.gen(function* () {
                  yield* Ref.update(queryStats, (stats) => ({
                    ...stats,
                    missCount: stats.missCount + 1,
                  }))

                  return Option.none()
                }),
            })
          )
        }),

      setCachedQuery: (queryHash: string, results: ReadonlyArray<SpatialQueryResult>, bounds: SpatialBounds) =>
        Effect.gen(function* () {
          // Effect.whenで設定チェック
          yield* Effect.when(config.enableQueryCaching, () =>
            Effect.gen(function* () {
              const cache = yield* Ref.get(queryCache)
              const timestamp = yield* getCurrentTimestamp()
              const entry: QueryCacheEntry = {
                queryHash,
                results,
                timestamp,
                accessCount: 1,
                bounds,
              }

              const updated = new Map(cache)
              updated.set(queryHash, entry)
              yield* Ref.set(queryCache, updated)

              yield* evictLRUQuery()
            })
          )
        }),

      // === Spatial Clustering ===

      getCluster: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          // 設定無効時は即座にOption.none
          return yield* Effect.if(config.enableSpatialClustering, {
            onTrue: () =>
              Effect.gen(function* () {
                const gridKey = getGridKey(coordinate)
                const clusters = yield* Ref.get(spatialClusters)
                const cluster = clusters.get(gridKey)

                // Option.matchで有効期限チェック
                return yield* pipe(
                  Option.fromNullable(cluster),
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<SpatialCluster>()),
                    onSome: (c) =>
                      Effect.gen(function* () {
                        const expired = yield* isExpired(c.lastUpdate)
                        return expired ? Option.none<SpatialCluster>() : Option.some(c)
                      }),
                  })
                )
              }),
            onFalse: () => Effect.succeed(Option.none<SpatialCluster>()),
          })
        }),

      updateCluster: (coordinate: SpatialCoordinate, biomeDistribution: Map<BiomeId, number>) =>
        Effect.gen(function* () {
          // Effect.whenで設定チェック
          yield* Effect.when(config.enableSpatialClustering, () =>
            Effect.gen(function* () {
              const gridKey = getGridKey(coordinate)
              const clusters = yield* Ref.get(spatialClusters)

              // Find dominant biome - ReadonlyArray.reduceで最大値検索
              const { dominantBiome, maxCount } = pipe(
                Array.from(biomeDistribution.entries()),
                ReadonlyArray.reduce(
                  { dominantBiome: createBiomeId('minecraft:unknown'), maxCount: 0 },
                  (acc, [biomeId, count]) => (count > acc.maxCount ? { dominantBiome: biomeId, maxCount: count } : acc)
                )
              )

              const totalBiomes = pipe(
                Array.from(biomeDistribution.values()),
                ReadonlyArray.reduce(0, (sum, count) => sum + count)
              )
              const confidence = totalBiomes > 0 ? maxCount / totalBiomes : 0

              const timestamp = yield* getCurrentTimestamp()
              const cluster: SpatialCluster = {
                centerCoordinate: makeUnsafeWorldCoordinate2D(
                  Math.floor(coordinate.x / config.spatialGridSize) * config.spatialGridSize +
                    config.spatialGridSize / 2,
                  Math.floor(coordinate.z / config.spatialGridSize) * config.spatialGridSize +
                    config.spatialGridSize / 2
                ),
                radius: config.spatialGridSize / 2,
                dominantBiome,
                biomeDistribution,
                confidence,
                lastUpdate: timestamp,
              }

              const updated = new Map(clusters)
              updated.set(gridKey, cluster)
              yield* Ref.set(spatialClusters, updated)
            })
          )
        }),

      getNearbyCluster: (coordinate: SpatialCoordinate, radius: number) =>
        Effect.gen(function* () {
          const clusters = yield* Ref.get(spatialClusters)
          const clusterValues = Array.from(clusters.values())

          // Effect.forEachで各クラスタをチェック
          const validClusters = yield* pipe(
            clusterValues,
            Effect.forEach(
              (cluster) =>
                Effect.gen(function* () {
                  const expired = yield* isExpired(cluster.lastUpdate)
                  if (expired) return Option.none()

                  const distance = calculateDistance(coordinate, cluster.centerCoordinate)
                  if (distance <= radius) {
                    return Option.some(cluster)
                  }
                  return Option.none()
                }),
              { concurrency: 4 }
            ),
            Effect.map(ReadonlyArray.getSomes)
          )

          return pipe(
            validClusters,
            ReadonlyArray.sort(
              (a, b) =>
                calculateDistance(coordinate, a.centerCoordinate) - calculateDistance(coordinate, b.centerCoordinate)
            )
          )
        }),

      // === Cache Management ===

      clear: (bounds?: SpatialBounds) =>
        Effect.gen(function* () {
          // Option.matchでbounds有無判定
          yield* pipe(
            Option.fromNullable(bounds),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  yield* Ref.set(spatialCache, new Map())
                  yield* Ref.set(queryCache, new Map())
                  yield* Ref.set(spatialClusters, new Map())
                }),
              onSome: (validBounds) =>
                Effect.gen(function* () {
                  // Clear within bounds - ReadonlyArray.filterでbounds外のエントリのみ残す
                  const spatialMap = yield* Ref.get(spatialCache)
                  const filteredSpatialEntries = pipe(
                    Array.from(spatialMap.entries()),
                    ReadonlyArray.filter(([key, entry]) => {
                      const coordinate = makeUnsafeWorldCoordinate2D(
                        parseFloat(key.split(',')[0]),
                        parseFloat(key.split(',')[1])
                      )
                      return !coordinateInBounds(coordinate, validBounds)
                    })
                  )
                  yield* Ref.set(spatialCache, new Map(filteredSpatialEntries))

                  // Clear query cache entries that intersect with bounds
                  const queryMap = yield* Ref.get(queryCache)
                  const filteredQueryEntries = pipe(
                    Array.from(queryMap.entries()),
                    ReadonlyArray.filter(([key, entry]) => !boundsIntersect(entry.bounds, validBounds))
                  )
                  yield* Ref.set(queryCache, new Map(filteredQueryEntries))
                }),
            })
          )
        }),

      evictExpired: () =>
        Effect.gen(function* () {
          // Evict expired spatial entries - Effect.forEachで期限切れチェック
          const spatialMap = yield* Ref.get(spatialCache)
          const spatialEntries = Array.from(spatialMap.entries())
          const spatialChecks = yield* pipe(
            spatialEntries,
            Effect.forEach(
              ([key, entry]) =>
                Effect.gen(function* () {
                  const expired = yield* isExpired(entry.timestamp)
                  return { entry: [key, entry] as const, expired }
                }),
              { concurrency: 4 }
            )
          )
          const validSpatial = spatialChecks.filter((c) => !c.expired).map((c) => c.entry)
          const expiredSpatialCount = spatialChecks.filter((c) => c.expired).length
          yield* Ref.set(spatialCache, new Map(validSpatial))

          // Evict expired query entries
          const queryMap = yield* Ref.get(queryCache)
          const queryEntries = Array.from(queryMap.entries())
          const queryChecks = yield* pipe(
            queryEntries,
            Effect.forEach(
              ([key, entry]) =>
                Effect.gen(function* () {
                  const expired = yield* isExpired(entry.timestamp)
                  return { entry: [key, entry] as const, expired }
                }),
              { concurrency: 4 }
            )
          )
          const validQuery = queryChecks.filter((c) => !c.expired).map((c) => c.entry)
          const expiredQueryCount = queryChecks.filter((c) => c.expired).length
          yield* Ref.set(queryCache, new Map(validQuery))

          // Evict expired clusters
          const clusterMap = yield* Ref.get(spatialClusters)
          const clusterEntries = Array.from(clusterMap.entries())
          const clusterChecks = yield* pipe(
            clusterEntries,
            Effect.forEach(
              ([key, cluster]) =>
                Effect.gen(function* () {
                  const expired = yield* isExpired(cluster.lastUpdate)
                  return { entry: [key, cluster] as const, expired }
                }),
              { concurrency: 4 }
            )
          )
          const validClusters = clusterChecks.filter((c) => !c.expired).map((c) => c.entry)
          const expiredClusterCount = clusterChecks.filter((c) => c.expired).length
          yield* Ref.set(spatialClusters, new Map(validClusters))

          return expiredSpatialCount + expiredQueryCount + expiredClusterCount
        }),

      optimize: () =>
        Effect.gen(function* () {
          // Evict expired entries
          yield* Effect.fork(this.evictExpired())

          // Optimize spatial clusters - Effect.whenで設定チェック
          yield* Effect.when(config.enableSpatialClustering, () =>
            Effect.gen(function* () {
              const clusters = yield* Ref.get(spatialClusters)
              const spatialMap = yield* Ref.get(spatialCache)

              // Update cluster statistics based on cache hits
              yield* Effect.forEach(
                Array.from(clusters.entries()),
                ([gridKey, cluster]) =>
                  Effect.gen(function* () {
                    // ReadonlyArray.reduceでバイオーム分布を集計
                    const biomeDistribution = pipe(
                      Array.from(spatialMap.entries()),
                      ReadonlyArray.filter(([coordKey, entry]) => {
                        const coordinate = makeUnsafeWorldCoordinate2D(
                          parseFloat(coordKey.split(',')[0]),
                          parseFloat(coordKey.split(',')[1])
                        )
                        return getGridKey(coordinate) === gridKey
                      }),
                      ReadonlyArray.reduce(new Map<BiomeId, number>(), (dist, [coordKey, entry]) => {
                        const count = dist.get(entry.biomeId) || 0
                        dist.set(entry.biomeId, count + 1)
                        return dist
                      })
                    )

                    // Effect.whenで非空チェック
                    yield* Effect.when(biomeDistribution.size > 0, () =>
                      this.updateCluster(cluster.centerCoordinate, biomeDistribution)
                    )
                  }),
                { concurrency: 4 }
              )
            })
          )
        }),

      getStatistics: () =>
        Effect.gen(function* () {
          const spatialMap = yield* Ref.get(spatialCache)
          const queryMap = yield* Ref.get(queryCache)
          const clusterMap = yield* Ref.get(spatialClusters)
          const sStats = yield* Ref.get(spatialStats)
          const qStats = yield* Ref.get(queryStats)

          const spatialTotal = sStats.hitCount + sStats.missCount
          const queryTotal = qStats.hitCount + qStats.missCount

          return {
            spatialCache: {
              size: spatialMap.size,
              maxSize: config.maxSpatialEntries,
              hitCount: sStats.hitCount,
              missCount: sStats.missCount,
              evictionCount: sStats.evictionCount,
              averageAccessTime: sStats.accessCount > 0 ? sStats.totalAccessTime / sStats.accessCount : 0,
              clusterCount: clusterMap.size,
            },
            queryCache: {
              size: queryMap.size,
              maxSize: config.maxQueryEntries,
              hitCount: qStats.hitCount,
              missCount: qStats.missCount,
              evictionCount: qStats.evictionCount,
              averageQueryTime: qStats.queryCount > 0 ? qStats.totalQueryTime / qStats.queryCount : 0,
            },
            memory: {
              estimatedSize: spatialMap.size * 64 + queryMap.size * 512 + clusterMap.size * 256, // Rough estimation
              compressionRatio: config.compressionEnabled ? 0.7 : 1.0,
            },
            performance: {
              cacheEfficiency: spatialTotal > 0 ? sStats.hitCount / spatialTotal : 0,
              spatialLocality: clusterMap.size > 0 ? spatialMap.size / clusterMap.size : 0,
              temporalLocality: 0.8, // Mock value
            },
          }
        }),

      // === Preloading & Warmup ===

      warmupRegion: (bounds: SpatialBounds) => Effect.succeed(undefined), // Mock implementation

      preloadCluster: (centerCoordinate: SpatialCoordinate, radius: number) => Effect.succeed(undefined), // Mock implementation
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(createCacheError(`Failed to create biome cache: ${error}`, 'createBiomeCache', error))
    )
  )

// === Default Export ===

export const defaultBiomeCache = createBiomeCache(defaultBiomeCacheConfig)
