/**
 * @fileoverview Biome System Cache Implementation
 * バイオームシステム専用キャッシュ実装
 *
 * 空間的局所性を活用した高性能キャッシュ
 * バイオームクエリの最適化とメモリ効率
 */

import { Effect, Option, Ref } from 'effect'
import type { BiomeId, WorldCoordinate } from '../../types'
import type { AllRepositoryErrors } from '../types'
import { createCacheError } from '../types'
import type {
  SpatialBounds,
  SpatialCoordinate,
  SpatialQueryResult,
  calculateDistance,
  coordinateInBounds,
  coordinateToKey,
} from './interface'

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

    const getCurrentTimestamp = (): number => Date.now()

    const isExpired = (timestamp: number): boolean => getCurrentTimestamp() - timestamp > config.ttlSeconds * 1000

    const getGridKey = (coordinate: SpatialCoordinate): string => {
      const gridX = Math.floor(coordinate.x / config.spatialGridSize) * config.spatialGridSize
      const gridZ = Math.floor(coordinate.z / config.spatialGridSize) * config.spatialGridSize
      return `${gridX},${gridZ}`
    }

    const hashQuery = (bounds: SpatialBounds, filters?: any): string => {
      const data = JSON.stringify({ bounds, filters })
      // Simple hash implementation
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString()
    }

    // === LRU Eviction ===

    const evictLRUSpatial = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(spatialCache)
        if (cache.size <= config.maxSpatialEntries) return

        const entries = Array.from(cache.entries())
        entries.sort(([, a], [, b]) => a.lastAccess - b.lastAccess)

        const toEvict = entries.slice(0, cache.size - config.maxSpatialEntries + 100) // Evict extra for performance
        const updated = new Map(cache)

        for (const [key] of toEvict) {
          updated.delete(key)
        }

        yield* Ref.set(spatialCache, updated)
        yield* Ref.update(spatialStats, (stats) => ({
          ...stats,
          evictionCount: stats.evictionCount + toEvict.length,
        }))
      })

    const evictLRUQuery = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(queryCache)
        if (cache.size <= config.maxQueryEntries) return

        const entries = Array.from(cache.entries())
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)

        const toEvict = entries.slice(0, cache.size - config.maxQueryEntries + 50)
        const updated = new Map(cache)

        for (const [key] of toEvict) {
          updated.delete(key)
        }

        yield* Ref.set(queryCache, updated)
        yield* Ref.update(queryStats, (stats) => ({
          ...stats,
          evictionCount: stats.evictionCount + toEvict.length,
        }))
      })

    // === Implementation ===

    return {
      // === Spatial Caching ===

      getBiomeAt: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          const startTime = getCurrentTimestamp()
          const key = coordinateToKey(coordinate)
          const cache = yield* Ref.get(spatialCache)
          const entry = cache.get(key)

          if (entry && !isExpired(entry.timestamp)) {
            // Update access statistics
            const updated = new Map(cache)
            updated.set(key, {
              ...entry,
              lastAccess: getCurrentTimestamp(),
              accessCount: entry.accessCount + 1,
            })
            yield* Ref.set(spatialCache, updated)

            yield* Ref.update(spatialStats, (stats) => ({
              ...stats,
              hitCount: stats.hitCount + 1,
              totalAccessTime: stats.totalAccessTime + (getCurrentTimestamp() - startTime),
              accessCount: stats.accessCount + 1,
            }))

            return Option.some(entry.biomeId)
          }

          yield* Ref.update(spatialStats, (stats) => ({
            ...stats,
            missCount: stats.missCount + 1,
            totalAccessTime: stats.totalAccessTime + (getCurrentTimestamp() - startTime),
            accessCount: stats.accessCount + 1,
          }))

          return Option.none()
        }),

      setBiomeAt: (coordinate: SpatialCoordinate, biomeId: BiomeId, confidence = 1.0) =>
        Effect.gen(function* () {
          const key = coordinateToKey(coordinate)
          const cache = yield* Ref.get(spatialCache)
          const timestamp = getCurrentTimestamp()

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
          const results: SpatialQueryResult[] = []

          for (const [key, entry] of cache) {
            if (isExpired(entry.timestamp)) continue

            const coordinate = {
              x: parseFloat(key.split(',')[0]) as WorldCoordinate,
              z: parseFloat(key.split(',')[1]) as WorldCoordinate,
            }

            if (coordinateInBounds(coordinate, bounds)) {
              results.push({
                biomeId: entry.biomeId,
                coordinate,
                distance: 0,
                confidence: entry.confidence,
              })
            }
          }

          return results.length > 0 ? Option.some(results) : Option.none()
        }),

      setBiomesInBounds: (bounds: SpatialBounds, results: ReadonlyArray<SpatialQueryResult>) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(spatialCache)
          const updated = new Map(cache)
          const timestamp = getCurrentTimestamp()

          for (const result of results) {
            if (coordinateInBounds(result.coordinate, bounds)) {
              const key = coordinateToKey(result.coordinate)
              updated.set(key, {
                biomeId: result.biomeId,
                confidence: result.confidence,
                timestamp,
                accessCount: 1,
                lastAccess: timestamp,
              })
            }
          }

          yield* Ref.set(spatialCache, updated)
          yield* evictLRUSpatial()
        }),

      // === Query Caching ===

      getCachedQuery: (queryHash: string) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(queryCache)
          const entry = cache.get(queryHash)

          if (entry && !isExpired(entry.timestamp)) {
            // Update access statistics
            const updated = new Map(cache)
            updated.set(queryHash, {
              ...entry,
              accessCount: entry.accessCount + 1,
            })
            yield* Ref.set(queryCache, updated)

            yield* Ref.update(queryStats, (stats) => ({
              ...stats,
              hitCount: stats.hitCount + 1,
            }))

            return Option.some(entry.results)
          }

          yield* Ref.update(queryStats, (stats) => ({
            ...stats,
            missCount: stats.missCount + 1,
          }))

          return Option.none()
        }),

      setCachedQuery: (queryHash: string, results: ReadonlyArray<SpatialQueryResult>, bounds: SpatialBounds) =>
        Effect.gen(function* () {
          if (!config.enableQueryCaching) return

          const cache = yield* Ref.get(queryCache)
          const entry: QueryCacheEntry = {
            queryHash,
            results,
            timestamp: getCurrentTimestamp(),
            accessCount: 1,
            bounds,
          }

          const updated = new Map(cache)
          updated.set(queryHash, entry)
          yield* Ref.set(queryCache, updated)

          yield* evictLRUQuery()
        }),

      // === Spatial Clustering ===

      getCluster: (coordinate: SpatialCoordinate) =>
        Effect.gen(function* () {
          if (!config.enableSpatialClustering) return Option.none()

          const gridKey = getGridKey(coordinate)
          const clusters = yield* Ref.get(spatialClusters)
          const cluster = clusters.get(gridKey)

          if (cluster && !isExpired(cluster.lastUpdate)) {
            return Option.some(cluster)
          }

          return Option.none()
        }),

      updateCluster: (coordinate: SpatialCoordinate, biomeDistribution: Map<BiomeId, number>) =>
        Effect.gen(function* () {
          if (!config.enableSpatialClustering) return

          const gridKey = getGridKey(coordinate)
          const clusters = yield* Ref.get(spatialClusters)

          // Find dominant biome
          let dominantBiome: BiomeId = 'unknown' as BiomeId
          let maxCount = 0
          for (const [biomeId, count] of biomeDistribution) {
            if (count > maxCount) {
              maxCount = count
              dominantBiome = biomeId
            }
          }

          const totalBiomes = Array.from(biomeDistribution.values()).reduce((sum, count) => sum + count, 0)
          const confidence = totalBiomes > 0 ? maxCount / totalBiomes : 0

          const cluster: SpatialCluster = {
            centerCoordinate: {
              x: (Math.floor(coordinate.x / config.spatialGridSize) * config.spatialGridSize +
                config.spatialGridSize / 2) as WorldCoordinate,
              z: (Math.floor(coordinate.z / config.spatialGridSize) * config.spatialGridSize +
                config.spatialGridSize / 2) as WorldCoordinate,
            },
            radius: config.spatialGridSize / 2,
            dominantBiome,
            biomeDistribution,
            confidence,
            lastUpdate: getCurrentTimestamp(),
          }

          const updated = new Map(clusters)
          updated.set(gridKey, cluster)
          yield* Ref.set(spatialClusters, updated)
        }),

      getNearbyCluster: (coordinate: SpatialCoordinate, radius: number) =>
        Effect.gen(function* () {
          const clusters = yield* Ref.get(spatialClusters)
          const nearby: SpatialCluster[] = []

          for (const cluster of clusters.values()) {
            if (isExpired(cluster.lastUpdate)) continue

            const distance = calculateDistance(coordinate, cluster.centerCoordinate)
            if (distance <= radius) {
              nearby.push(cluster)
            }
          }

          return nearby.sort(
            (a, b) =>
              calculateDistance(coordinate, a.centerCoordinate) - calculateDistance(coordinate, b.centerCoordinate)
          )
        }),

      // === Cache Management ===

      clear: (bounds?: SpatialBounds) =>
        Effect.gen(function* () {
          if (!bounds) {
            yield* Ref.set(spatialCache, new Map())
            yield* Ref.set(queryCache, new Map())
            yield* Ref.set(spatialClusters, new Map())
            return
          }

          // Clear within bounds
          const spatialMap = yield* Ref.get(spatialCache)
          const filteredSpatial = new Map<string, BiomeCacheEntry>()

          for (const [key, entry] of spatialMap) {
            const coordinate = {
              x: parseFloat(key.split(',')[0]) as WorldCoordinate,
              z: parseFloat(key.split(',')[1]) as WorldCoordinate,
            }

            if (!coordinateInBounds(coordinate, bounds)) {
              filteredSpatial.set(key, entry)
            }
          }

          yield* Ref.set(spatialCache, filteredSpatial)

          // Clear query cache entries that intersect with bounds
          const queryMap = yield* Ref.get(queryCache)
          const filteredQuery = new Map<string, QueryCacheEntry>()

          for (const [key, entry] of queryMap) {
            if (!boundsIntersect(entry.bounds, bounds)) {
              filteredQuery.set(key, entry)
            }
          }

          yield* Ref.set(queryCache, filteredQuery)
        }),

      evictExpired: () =>
        Effect.gen(function* () {
          const currentTime = getCurrentTimestamp()
          let evictedCount = 0

          // Evict expired spatial entries
          const spatialMap = yield* Ref.get(spatialCache)
          const filteredSpatial = new Map<string, BiomeCacheEntry>()

          for (const [key, entry] of spatialMap) {
            if (!isExpired(entry.timestamp)) {
              filteredSpatial.set(key, entry)
            } else {
              evictedCount++
            }
          }

          yield* Ref.set(spatialCache, filteredSpatial)

          // Evict expired query entries
          const queryMap = yield* Ref.get(queryCache)
          const filteredQuery = new Map<string, QueryCacheEntry>()

          for (const [key, entry] of queryMap) {
            if (!isExpired(entry.timestamp)) {
              filteredQuery.set(key, entry)
            } else {
              evictedCount++
            }
          }

          yield* Ref.set(queryCache, filteredQuery)

          // Evict expired clusters
          const clusterMap = yield* Ref.get(spatialClusters)
          const filteredClusters = new Map<string, SpatialCluster>()

          for (const [key, cluster] of clusterMap) {
            if (!isExpired(cluster.lastUpdate)) {
              filteredClusters.set(key, cluster)
            } else {
              evictedCount++
            }
          }

          yield* Ref.set(spatialClusters, filteredClusters)

          return evictedCount
        }),

      optimize: () =>
        Effect.gen(function* () {
          // Evict expired entries
          yield* Effect.fork(this.evictExpired())

          // Optimize spatial clusters
          if (config.enableSpatialClustering) {
            const clusters = yield* Ref.get(spatialClusters)
            const spatialMap = yield* Ref.get(spatialCache)

            // Update cluster statistics based on cache hits
            for (const [gridKey, cluster] of clusters) {
              const biomeDistribution = new Map<BiomeId, number>()

              for (const [coordKey, entry] of spatialMap) {
                const coordinate = {
                  x: parseFloat(coordKey.split(',')[0]) as WorldCoordinate,
                  z: parseFloat(coordKey.split(',')[1]) as WorldCoordinate,
                }

                if (getGridKey(coordinate) === gridKey) {
                  const count = biomeDistribution.get(entry.biomeId) || 0
                  biomeDistribution.set(entry.biomeId, count + 1)
                }
              }

              if (biomeDistribution.size > 0) {
                yield* this.updateCluster(cluster.centerCoordinate, biomeDistribution)
              }
            }
          }
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
